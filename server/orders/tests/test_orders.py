import threading
from decimal import Decimal

import pytest
from django.core import mail
from django.db import connection
from rest_framework.test import APIClient

from accounts.models import User
from orders.models import Order, PickupPoint
from products.models import Category, Product

pytestmark = pytest.mark.django_db


def client_for(role=None, email=None, verified=True):
    client = APIClient()
    if role:
        user = User.objects.create_user(email or f'{role.lower()}@eshop.test', 'pw-123456', role=role, is_email_verified=verified)
        client.force_authenticate(user)
    return client


@pytest.fixture
def customer():
    return client_for(User.Role.CUSTOMER)


@pytest.fixture
def admin():
    return client_for(User.Role.ADMIN)


@pytest.fixture
def kitchen():
    return Category.objects.create(name='Kitchen')


@pytest.fixture
def algiers():
    return PickupPoint.objects.create(name='Hydra office', city='Algiers', address='12 Rue Didouche')


def product(kitchen, name='Mug', price='1200', stock=5, **extra):
    return Product.objects.create(category=kitchen, name=name, price=Decimal(price), stock=stock, **extra)


def add(client, prod, quantity=1):
    return client.post('/api/cart/items/', {'product': str(prod.id), 'quantity': quantity}, format='json')


def checkout(client, point):
    return client.post('/api/orders/', {'delivery_method': 'PICKUP_POINT', 'pickup_point': str(point.id)}, format='json')


def stock(prod):
    prod.refresh_from_db()
    return prod.stock


# --- Pickup Points ---

def test_admin_manages_pickup_points_and_others_see_only_active_ones(admin, customer):
    created = admin.post('/api/pickup-points/', {'name': 'Oran office', 'city': 'Oran', 'address': '3 Bd Front de Mer'}, format='json')
    assert created.status_code == 201
    point = created.data['id']
    assert admin.patch(f'/api/pickup-points/{point}/', {'is_active': False}, format='json').status_code == 200

    assert [p['city'] for p in admin.get('/api/pickup-points/').data] == ['Oran']
    assert APIClient().get('/api/pickup-points/').data == []
    assert customer.post('/api/pickup-points/', {'name': 'x', 'city': 'y', 'address': 'z'}, format='json').status_code == 403


def test_a_pickup_point_used_by_orders_cannot_be_deleted(admin, customer, kitchen, algiers):
    add(customer, product(kitchen))
    checkout(customer, algiers)
    assert admin.delete(f'/api/pickup-points/{algiers.id}/').status_code == 409


# --- Checkout ---

def test_checkout_with_a_pickup_point_creates_a_confirmed_order(customer, kitchen, algiers, django_capture_on_commit_callbacks):
    mug, board = product(kitchen, stock=5), product(kitchen, 'Board', price='3800', stock=3)
    add(customer, mug, 2)
    add(customer, board, 1)

    with django_capture_on_commit_callbacks(execute=True):
        response = checkout(customer, algiers)

    assert response.status_code == 201
    assert response.data['status'] == 'CONFIRMED'
    assert response.data['pickup_point']['name'] == 'Hydra office'
    assert Decimal(response.data['total_amount']) == Decimal('6200')
    assert [(i['product']['name'], i['quantity']) for i in response.data['items']] == [('Mug', 2), ('Board', 1)]
    assert (stock(mug), stock(board)) == (3, 2)
    assert customer.get('/api/cart/').data['items'] == []
    assert len(mail.outbox) == 1 and 'confirmed' in mail.outbox[0].subject
    assert '6200' in mail.outbox[0].body and 'Hydra office' in mail.outbox[0].body


def test_home_delivery_needs_an_address(customer, kitchen):
    add(customer, product(kitchen))
    missing = customer.post('/api/orders/', {'delivery_method': 'HOME_DELIVERY', 'delivery_address': ' '}, format='json')
    assert missing.status_code == 400 and 'delivery_address' in missing.data

    ok = customer.post('/api/orders/', {'delivery_method': 'HOME_DELIVERY', 'delivery_address': '5 Rue Larbi Ben Mhidi, Algiers'}, format='json')
    assert ok.status_code == 201 and ok.data['pickup_point'] is None


def test_inactive_pickup_points_and_empty_carts_are_refused(customer, kitchen, algiers):
    assert checkout(customer, algiers).status_code == 400  # empty Cart
    add(customer, product(kitchen))
    unchosen = customer.post('/api/orders/', {'delivery_method': 'PICKUP_POINT', 'pickup_point': None}, format='json')
    assert unchosen.data == {'pickup_point': ['Choose a pickup point.']}
    PickupPoint.objects.filter(pk=algiers.pk).update(is_active=False)
    assert checkout(customer, algiers).status_code == 400


def test_unverified_customers_cannot_confirm_an_order(kitchen, algiers):
    unverified = client_for(User.Role.CUSTOMER, verified=False)
    add(unverified, product(kitchen))
    response = checkout(unverified, algiers)
    assert response.status_code == 403 and response.data['code'] == 'email_not_verified'


@pytest.mark.parametrize('role,status', [(None, 401), (User.Role.EMPLOYEE, 403), (User.Role.ADMIN, 403)])
def test_only_customers_check_out(role, status):
    assert client_for(role).post('/api/orders/', {}, format='json').status_code == status


def test_a_stock_shortfall_is_a_409_naming_the_items_and_nothing_changes(customer, kitchen, algiers):
    mug, board = product(kitchen, stock=5), product(kitchen, 'Board', stock=3)
    add(customer, mug, 2)
    add(customer, board, 3)
    Product.objects.filter(pk=board.pk).update(stock=1)

    response = checkout(customer, algiers)

    assert response.status_code == 409
    assert response.data['code'] == 'out_of_stock'
    assert response.data['items'] == [{'product': str(board.id), 'available': 1}]
    assert (stock(mug), stock(board)) == (5, 1)
    assert not Order.objects.exists()
    cart = customer.get('/api/cart/').data
    assert [(i['product']['name'], i['available']) for i in cart['items']] == [('Mug', True), ('Board', False)]


@pytest.mark.django_db(transaction=True)
def test_two_concurrent_checkouts_of_the_last_unit_exactly_one_wins(kitchen, algiers):
    last = product(kitchen, stock=1)
    buyers = [client_for(User.Role.CUSTOMER, f'buyer{n}@eshop.test') for n in range(2)]
    for buyer in buyers:
        add(buyer, last)

    start = threading.Barrier(2)
    statuses = []

    def buy(client):
        try:
            start.wait()
            statuses.append(checkout(client, algiers).status_code)
        finally:
            connection.close()

    threads = [threading.Thread(target=buy, args=(b,)) for b in buyers]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(statuses) == [201, 409]
    assert stock(last) == 0
    assert Order.objects.count() == 1


def test_price_changes_after_purchase_do_not_alter_the_order(customer, kitchen, algiers):
    mug = product(kitchen, price='1200')
    add(customer, mug, 2)
    order = checkout(customer, algiers).data
    Product.objects.filter(pk=mug.pk).update(price=Decimal('9999'))

    again = customer.get(f'/api/orders/{order["id"]}/').data
    assert Decimal(again['items'][0]['price_at_purchase']) == Decimal('1200')
    assert Decimal(again['total_amount']) == Decimal('2400')


# --- My Orders ---

def test_customers_see_only_their_own_orders_newest_first(customer, kitchen, algiers):
    mug = product(kitchen, stock=10)
    add(customer, mug)
    first = checkout(customer, algiers).data['id']
    add(customer, mug)
    second = checkout(customer, algiers).data['id']

    other = client_for(User.Role.CUSTOMER, 'other@eshop.test')
    add(other, mug)
    theirs = checkout(other, algiers).data['id']

    assert [o['id'] for o in customer.get('/api/orders/').data['results']] == [second, first]
    assert customer.get(f'/api/orders/{theirs}/').status_code == 404


def test_cancel_before_shipped_restores_stock(customer, kitchen, algiers):
    mug = product(kitchen, stock=5)
    add(customer, mug, 3)
    order = checkout(customer, algiers).data

    response = customer.post(f'/api/orders/{order["id"]}/cancel/')

    assert response.status_code == 200 and response.data['status'] == 'CANCELLED'
    assert stock(mug) == 5
    assert customer.post(f'/api/orders/{order["id"]}/cancel/').status_code == 409  # no double restock
    assert stock(mug) == 5


@pytest.mark.parametrize('status', ['SHIPPED', 'DELIVERED'])
def test_cancel_after_shipped_is_refused(customer, kitchen, algiers, status):
    mug = product(kitchen, stock=5)
    add(customer, mug, 2)
    order = checkout(customer, algiers).data
    Order.objects.filter(pk=order['id']).update(status=status)

    response = customer.post(f'/api/orders/{order["id"]}/cancel/')

    assert response.status_code == 409 and response.data['code'] == 'invalid_transition'
    assert stock(mug) == 3


# --- Staff Order management ---

@pytest.fixture
def placed(customer, kitchen, algiers):
    """A Confirmed Order of 2 Mugs (stock 5 -> 3)."""
    mug = product(kitchen, stock=5)
    add(customer, mug, 2)
    return checkout(customer, algiers).data, mug


@pytest.mark.parametrize('role', [User.Role.ADMIN, User.Role.EMPLOYEE])
def test_staff_see_every_order_with_its_customer(role, placed):
    order, _ = placed
    staff = client_for(role)
    listed = staff.get('/api/orders/').data['results']
    assert [(o['id'], o['customer']) for o in listed] == [(order['id'], 'customer@eshop.test')]
    assert staff.get(f'/api/orders/{order["id"]}/').status_code == 200


def test_staff_filter_orders_by_status_and_search_by_customer_email(admin, placed):
    order, _ = placed
    assert admin.get('/api/orders/?status=CONFIRMED').data['count'] == 1
    assert admin.get('/api/orders/?status=SHIPPED').data['count'] == 0
    assert admin.get('/api/orders/?search=customer@').data['count'] == 1
    assert admin.get('/api/orders/?search=nobody').data['count'] == 0


@pytest.mark.parametrize('role', [User.Role.ADMIN, User.Role.EMPLOYEE])
def test_staff_ship_then_deliver_an_order(role, placed):
    order, mug = placed
    staff = client_for(role)

    shipped = staff.post(f'/api/orders/{order["id"]}/ship/')
    assert shipped.status_code == 200 and shipped.data['status'] == 'SHIPPED'
    delivered = staff.post(f'/api/orders/{order["id"]}/deliver/')
    assert delivered.status_code == 200 and delivered.data['status'] == 'DELIVERED'
    assert stock(mug) == 3


@pytest.mark.parametrize('moves,refused', [
    ([], 'deliver'),                      # Confirmed cannot skip to Delivered
    (['ship'], 'ship'),                   # no shipping twice
    (['ship'], 'cancel'),                 # too late to cancel
    (['ship', 'deliver'], 'cancel'),      # Delivered is final
    (['ship', 'deliver'], 'deliver'),
    (['cancel'], 'ship'),                 # Cancelled is final
])
def test_invalid_transitions_are_refused(admin, placed, moves, refused):
    order, mug = placed
    for move in moves:
        assert admin.post(f'/api/orders/{order["id"]}/{move}/').status_code == 200
    before = stock(mug)

    response = admin.post(f'/api/orders/{order["id"]}/{refused}/')

    assert response.status_code == 409 and response.data['code'] == 'invalid_transition'
    assert stock(mug) == before


def test_staff_cancel_restores_stock(admin, placed):
    order, mug = placed
    assert admin.post(f'/api/orders/{order["id"]}/cancel/').data['status'] == 'CANCELLED'
    assert stock(mug) == 5


def test_customers_cannot_ship_or_deliver(customer, placed):
    order, _ = placed
    assert customer.post(f'/api/orders/{order["id"]}/ship/').status_code == 403
    assert customer.post(f'/api/orders/{order["id"]}/deliver/').status_code == 403
    assert Order.objects.get(pk=order['id']).status == 'CONFIRMED'


def test_customers_cannot_cancel_or_see_others_orders(placed):
    order, _ = placed
    other = client_for(User.Role.CUSTOMER, 'other@eshop.test')
    assert other.get('/api/orders/').data['count'] == 0
    assert other.post(f'/api/orders/{order["id"]}/cancel/').status_code == 404


def test_status_is_never_patched(admin, placed):
    order, _ = placed
    assert admin.patch(f'/api/orders/{order["id"]}/', {'status': 'DELIVERED'}, format='json').status_code == 405
    assert Order.objects.get(pk=order['id']).status == 'CONFIRMED'
