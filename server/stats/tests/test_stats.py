from datetime import UTC, date, datetime
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from orders.models import Order, OrderItem, PickupPoint
from products.models import Category, Product
from stock.models import Restock, RestockLine, Supplier

pytestmark = pytest.mark.django_db

MARCH = '2026-03'


def client_for(role=None):
    client = APIClient()
    if role:
        client.force_authenticate(User.objects.create_user(f'{role.lower()}@eshop.test', 'pw-123456', role=role))
    return client


@pytest.fixture
def admin():
    return client_for(User.Role.ADMIN)


@pytest.fixture
def shop():
    """Two Categories, three Products (the Lamp has Cost missing), a Customer, a Pickup Point, a Supplier."""
    kitchen, decor = Category.objects.create(name='Kitchen'), Category.objects.create(name='Home decor')
    return {
        'mug': Product.objects.create(category=kitchen, name='Mug', price=Decimal('1000'), cost_price=Decimal('400'), stock=10),
        'board': Product.objects.create(category=kitchen, name='Board', price=Decimal('3000'), cost_price=Decimal('2000'), stock=10),
        'lamp': Product.objects.create(category=decor, name='Lamp', price=Decimal('5000'), stock=10),
        'customer': User.objects.create_user('c@eshop.test', 'pw-123456', role=User.Role.CUSTOMER),
        'point': PickupPoint.objects.create(name='Hydra', city='Algiers', address='1 Rue'),
        'supplier': Supplier.objects.create(name='Atlas'),
    }


def order(shop, *lines, status=Order.Status.DELIVERED, delivered_at=None):
    """lines: (product, quantity); each line keeps the Product's current price and Cost price."""
    made = Order.objects.create(
        customer=shop['customer'], delivery_method='PICKUP_POINT', pickup_point=shop['point'], status=status,
        delivered_at=delivered_at, total_amount=sum(p.price * q for p, q in lines),
    )
    for product, quantity in lines:
        OrderItem.objects.create(order=made, product=product, quantity=quantity, price_at_purchase=product.price, cost_at_purchase=product.cost_price)
    return made


def delivered(shop, *lines, at):
    return order(shop, *lines, delivered_at=at)


def bought(shop, product, quantity, unit_cost, on, cancelled=False):
    restock = Restock.objects.create(supplier=shop['supplier'], date=on, cancelled_at=timezone.now() if cancelled else None)
    RestockLine.objects.create(restock=restock, product=product, quantity=quantity, unit_cost=Decimal(unit_cost))


def at(day, hour=12, month=3):
    return datetime(2026, month, day, hour, tzinfo=UTC)


@pytest.mark.parametrize('role', [None, User.Role.CUSTOMER, User.Role.EMPLOYEE])
def test_statistics_are_for_the_admin_only(role):
    client = client_for(role)
    for path in ('month', 'products', 'history', 'low-stock'):
        assert client.get(f'/api/stats/{path}/').status_code in (401, 403)


def test_a_bad_month_is_rejected(admin):
    assert admin.get('/api/stats/month/?month=2026-13').status_code == 400
    assert admin.get('/api/stats/month/?month=march').status_code == 400


def test_revenue_counts_delivered_orders_in_the_month_they_were_delivered(admin, shop):
    mug = shop['mug']
    delivered(shop, (mug, 2), at=at(10))                                    # March: 2 000
    order(shop, (mug, 1), status=Order.Status.DELIVERED, delivered_at=at(2, month=4))  # April
    order(shop, (mug, 5), status=Order.Status.CONFIRMED)
    order(shop, (mug, 5), status=Order.Status.SHIPPED)
    order(shop, (mug, 5), status=Order.Status.CANCELLED)

    month = admin.get(f'/api/stats/month/?month={MARCH}').data['current']

    assert (month['revenue'], month['delivered_orders']) == ('2000.00', 1)


def test_months_follow_algeria_time(admin, shop):
    # 23:30 UTC on 31 March is 00:30 on 1 April in Algiers (UTC+1).
    delivered(shop, (shop['mug'], 1), at=datetime(2026, 3, 31, 23, 30, tzinfo=UTC))

    assert admin.get('/api/stats/month/?month=2026-03').data['current']['revenue'] == '0.00'
    assert admin.get('/api/stats/month/?month=2026-04').data['current']['revenue'] == '1000.00'


def test_gross_profit_uses_the_kept_cost_and_is_incomplete_with_cost_missing(admin, shop):
    delivered(shop, (shop['mug'], 2), (shop['lamp'], 1), at=at(10))  # mug profit 2 x 600; lamp has no cost
    Product.objects.filter(pk=shop['mug'].pk).update(cost_price=Decimal('900'))  # later edits don't count

    month = admin.get(f'/api/stats/month/?month={MARCH}').data['current']

    assert (month['revenue'], month['gross_profit']) == ('7000.00', '1200.00')
    assert month['profit_incomplete'] is True
    assert month['cost_missing_products'] == [{'id': str(shop['lamp'].id), 'name': 'Lamp'}]


def test_spent_counts_restocks_dated_in_the_month_unless_cancelled(admin, shop):
    bought(shop, shop['mug'], 10, '400', date(2026, 3, 5))     # 4 000
    bought(shop, shop['board'], 2, '2000', date(2026, 3, 31))  # 4 000
    bought(shop, shop['board'], 9, '2000', date(2026, 3, 6), cancelled=True)
    bought(shop, shop['mug'], 1, '400', date(2026, 4, 1))

    assert admin.get(f'/api/stats/month/?month={MARCH}').data['current']['spent'] == '8000.00'


def test_the_month_comes_with_the_previous_month_for_comparison(admin, shop):
    delivered(shop, (shop['mug'], 1), at=at(20, month=2))
    delivered(shop, (shop['mug'], 3), at=at(20))

    data = admin.get(f'/api/stats/month/?month={MARCH}').data

    assert (data['current']['month'], data['current']['revenue']) == ('2026-03', '3000.00')
    assert (data['previous']['month'], data['previous']['revenue']) == ('2026-02', '1000.00')


def test_history_has_twelve_months_and_every_year(admin, shop):
    delivered(shop, (shop['mug'], 1), at=at(10))
    delivered(shop, (shop['board'], 1), at=datetime(2025, 6, 1, 12, tzinfo=UTC))
    bought(shop, shop['mug'], 5, '400', date(2026, 1, 15))

    data = admin.get(f'/api/stats/history/?month={MARCH}').data

    assert [m['period'] for m in data['months']] == [f'2025-{n:02d}' for n in range(4, 13)] + ['2026-01', '2026-02', '2026-03']
    by_month = {m['period']: m for m in data['months']}
    assert (by_month['2026-03']['revenue'], by_month['2026-03']['gross_profit']) == ('1000.00', '600.00')
    assert by_month['2026-01']['spent'] == '2000.00'
    assert by_month['2025-06']['revenue'] == '3000.00'
    assert by_month['2025-05']['revenue'] == '0.00'
    assert [(y['period'], y['revenue'], y['spent']) for y in data['years']] == [('2025', '3000.00', '0.00'), ('2026', '1000.00', '2000.00')]


def test_product_rankings_and_categories_for_the_month(admin, shop):
    mug, board, lamp = shop['mug'], shop['board'], shop['lamp']
    delivered(shop, (mug, 5), (board, 1), at=at(10))   # mug: 5 units, 5 000, profit 3 000; board: 1 unit, 3 000, profit 1 000
    delivered(shop, (lamp, 1), at=at(11))              # lamp: 1 unit, 5 000, Cost missing
    delivered(shop, (board, 9), at=at(1, month=4))     # April, not counted
    Product.objects.filter(pk=board.pk).update(stock=0)  # out of stock: not "slow"

    data = admin.get(f'/api/stats/products/?month={MARCH}').data

    assert [p['name'] for p in data['top_units']] == ['Mug', 'Board', 'Lamp']
    assert [p['name'] for p in data['top_revenue']] == ['Lamp', 'Mug', 'Board']
    assert [(p['name'], p['gross_profit']) for p in data['top_profit']] == [('Mug', '3000.00'), ('Board', '1000.00'), ('Lamp', '0.00')]
    assert [(p['name'], p['units']) for p in data['slow']] == [('Lamp', 1), ('Mug', 5)]
    assert [(c['name'], c['revenue'], c['gross_profit']) for c in data['categories']] == [('Kitchen', '8000.00', '4000.00'), ('Home decor', '5000.00', '0.00')]


def test_low_stock_lists_products_at_or_below_their_reorder_level(admin, shop):
    mug, board, lamp = shop['mug'], shop['board'], shop['lamp']
    Product.objects.filter(pk=mug.pk).update(stock=5, usual_supplier=shop['supplier'])  # at the default level of 5
    Product.objects.filter(pk=board.pk).update(stock=8, reorder_level=10)
    Product.objects.filter(pk=lamp.pk).update(stock=0, is_archived=True)               # archived: not listed

    listed = admin.get('/api/stats/low-stock/').data

    assert [(p['name'], p['stock'], p['reorder_level']) for p in listed] == [('Mug', 5, 5), ('Board', 8, 10)]
    assert listed[0]['usual_supplier'] == {'id': str(shop['supplier'].id), 'name': 'Atlas'}


def test_the_admin_sets_a_reorder_level(admin, shop):
    response = admin.patch(f'/api/products/{shop["mug"].id}/', {'reorder_level': 12}, format='json')
    assert response.status_code == 200 and response.data['reorder_level'] == 12
    assert admin.patch(f'/api/products/{shop["mug"].id}/', {'reorder_level': -1}, format='json').status_code == 400
