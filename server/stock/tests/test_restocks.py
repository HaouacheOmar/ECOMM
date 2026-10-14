from datetime import timedelta
from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from orders.models import Order, OrderItem, PickupPoint
from products.models import Category, Product
from stock.models import Supplier
from stock.serializers import shop_today

pytestmark = pytest.mark.django_db


def client_for(role=None, email=None):
    client = APIClient()
    if role:
        client.force_authenticate(User.objects.create_user(email or f'{role.lower()}@eshop.test', 'pw-123456', role=role, is_email_verified=True))
    return client


@pytest.fixture
def admin():
    return client_for(User.Role.ADMIN)


@pytest.fixture
def atlas():
    return Supplier.objects.create(name='Atlas Ceramics')


@pytest.fixture
def kitchen():
    return Category.objects.create(name='Kitchen')


@pytest.fixture
def mug(kitchen):
    return Product.objects.create(category=kitchen, name='Mug', price=Decimal('1200'), cost_price=Decimal('500'), stock=2)


@pytest.fixture
def bowl(kitchen):
    return Product.objects.create(category=kitchen, name='Bowl', price=Decimal('900'), stock=0)  # Cost missing


def stock(product):
    product.refresh_from_db()
    return product.stock


def line(product, quantity, unit_cost, extra=None):
    return {'product': str(product.id), 'quantity': quantity, 'unit_cost': unit_cost, **(extra or {})}


def restock(admin, supplier, *lines, date=None):
    """Each line: (product, quantity, unit_cost[, extra fields])."""
    return admin.post('/api/restocks/', {
        'supplier': str(supplier.id), 'date': str(date or shop_today()), 'lines': [line(*spec) for spec in lines],
    }, format='json')


@pytest.mark.parametrize('role', [None, User.Role.CUSTOMER, User.Role.EMPLOYEE])
def test_only_the_admin_reaches_restocks_corrections_and_history(role, atlas, mug):
    client = client_for(role)
    assert client.get('/api/restocks/').status_code in (401, 403)
    assert restock(client, atlas, (mug, 1, '500')).status_code in (401, 403)
    assert client.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': 1, 'reason': 'MISCOUNT'}).status_code in (401, 403)
    assert client.get(f'/api/products/{mug.id}/stock-history/').status_code in (401, 403)


def test_a_restock_adds_stock_and_counts_toward_its_supplier(admin, atlas, mug, bowl):
    response = restock(admin, atlas, (mug, 10, '480'), (bowl, 4, '350'))

    assert response.status_code == 201
    assert Decimal(response.data['total']) == Decimal('6200')  # 10 x 480 + 4 x 350
    assert [(line['product']['name'], line['quantity']) for line in response.data['lines']] == [('Mug', 10), ('Bowl', 4)]
    assert (stock(mug), stock(bowl)) == (12, 4)
    assert Decimal(admin.get(f'/api/suppliers/{atlas.id}/').data['total_spent']) == Decimal('6200')
    assert [r['id'] for r in admin.get(f'/api/restocks/?supplier={atlas.id}').data['results']] == [response.data['id']]


def test_a_restock_may_update_the_cost_price_only_when_asked(admin, atlas, mug, bowl):
    restock(admin, atlas, (mug, 1, '520'), (bowl, 1, '350', {'update_cost_price': True}))
    mug.refresh_from_db()
    bowl.refresh_from_db()
    assert (mug.cost_price, bowl.cost_price) == (Decimal('500'), Decimal('350'))


def test_restocking_a_cost_missing_product_completes_its_earlier_order_lines(admin, atlas, bowl):
    customer = User.objects.create_user('c@eshop.test', 'pw-123456', role=User.Role.CUSTOMER)
    point = PickupPoint.objects.create(name='Hydra', city='Algiers', address='1 Rue')
    order = Order.objects.create(customer=customer, delivery_method='PICKUP_POINT', pickup_point=point, total_amount=Decimal('900'))
    line = OrderItem.objects.create(order=order, product=bowl, quantity=1, price_at_purchase=Decimal('900'))

    restock(admin, atlas, (bowl, 3, '350', {'update_cost_price': True}))

    line.refresh_from_db()
    assert line.cost_at_purchase == Decimal('350')


def test_restock_validation(admin, atlas, mug):
    tomorrow = shop_today() + timedelta(days=1)
    assert set(restock(admin, atlas, (mug, 1, '500'), date=tomorrow).data) == {'date'}
    assert restock(admin, atlas, (mug, 1, '500'), date=shop_today() - timedelta(days=12)).status_code == 201

    assert set(admin.post('/api/restocks/', {'supplier': str(atlas.id), 'date': str(shop_today()), 'lines': []}, format='json').data) == {'lines'}
    assert set(restock(admin, atlas, (mug, 1, '500'), (mug, 2, '500')).data) == {'lines'}
    assert restock(admin, atlas, (mug, 0, '500')).status_code == 400
    assert restock(admin, atlas, (mug, 1, '-1')).status_code == 400

    Product.objects.filter(pk=mug.pk).update(is_archived=True)
    assert restock(admin, atlas, (mug, 1, '500')).status_code == 400
    assert stock(mug) == 3


def test_an_archived_supplier_cannot_be_restocked_from(admin, atlas, mug):
    atlas.is_archived = True
    atlas.save()
    assert set(restock(admin, atlas, (mug, 1, '500')).data) == {'supplier'}


def test_restocks_are_listed_by_month(admin, atlas, mug):
    today = shop_today()
    last_month = today.replace(day=1) - timedelta(days=1)
    restock(admin, atlas, (mug, 1, '500'), date=last_month)
    restock(admin, atlas, (mug, 2, '500'), date=today)

    listed = admin.get(f'/api/restocks/?month={last_month:%Y-%m}').data['results']
    assert [r['date'] for r in listed] == [str(last_month)]


def test_cancelling_a_restock_takes_its_stock_and_spending_back(admin, atlas, mug):
    restock_id = restock(admin, atlas, (mug, 5, '500')).data['id']

    cancelled = admin.post(f'/api/restocks/{restock_id}/cancel/')

    assert cancelled.status_code == 200 and cancelled.data['cancelled_at'] is not None
    assert stock(mug) == 2
    assert Decimal(admin.get(f'/api/suppliers/{atlas.id}/').data['total_spent']) == Decimal('0')
    assert admin.post(f'/api/restocks/{restock_id}/cancel/').status_code == 409
    assert admin.get(f'/api/restocks/{restock_id}/').status_code == 200  # stays in history


def test_a_restock_whose_stock_was_sold_cannot_be_cancelled(admin, atlas, mug):
    restock_id = restock(admin, atlas, (mug, 5, '500')).data['id']
    Product.objects.filter(pk=mug.pk).update(stock=4)  # 3 of the 5 were sold

    refused = admin.post(f'/api/restocks/{restock_id}/cancel/')

    assert refused.status_code == 409 and refused.data['items'] == [{'product': str(mug.id), 'available': 4}]
    assert stock(mug) == 4
    assert admin.get(f'/api/restocks/{restock_id}/').data['cancelled_at'] is None


def test_restocks_are_never_edited_or_deleted(admin, atlas, mug):
    restock_id = restock(admin, atlas, (mug, 1, '500')).data['id']
    assert admin.patch(f'/api/restocks/{restock_id}/', {'note': 'x'}, format='json').status_code == 405
    assert admin.delete(f'/api/restocks/{restock_id}/').status_code == 405


def test_a_stock_correction_changes_stock_with_a_reason_but_never_below_zero(admin, mug):
    lost = admin.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': -1, 'reason': 'BREAKAGE'}, format='json')
    assert lost.status_code == 201 and stock(mug) == 1

    found = admin.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': 3, 'reason': 'MISCOUNT'}, format='json')
    assert found.status_code == 201 and stock(mug) == 4

    too_many = admin.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': -5, 'reason': 'LOSS'}, format='json')
    assert too_many.status_code == 409 and stock(mug) == 4

    assert set(admin.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': 0, 'reason': 'LOSS'}, format='json').data) == {'quantity'}
    assert set(admin.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': 1}, format='json').data) == {'reason'}
    assert set(admin.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': 1, 'reason': 'OTHER'}, format='json').data) == {'note'}
    assert len(admin.get(f'/api/stock-corrections/?product={mug.id}').data['results']) == 2


def test_stock_history_lists_every_change_newest_first(admin, atlas, mug):
    restock_id = restock(admin, atlas, (mug, 5, '500')).data['id']
    admin.post('/api/stock-corrections/', {'product': str(mug.id), 'quantity': -1, 'reason': 'LOSS'}, format='json')
    admin.post(f'/api/restocks/{restock_id}/cancel/')

    history = admin.get(f'/api/products/{mug.id}/stock-history/').data

    assert history['stock'] == 1
    assert [(e['kind'], e['change']) for e in history['events']] == [('RESTOCK_CANCELLED', -5), ('CORRECTION', -1), ('RESTOCK', 5)]
    assert history['events'][2]['supplier'] == 'Atlas Ceramics'
