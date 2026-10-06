from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from products.models import Category, Product

pytestmark = pytest.mark.django_db


def client_for(role=None, email=None):
    client = APIClient()
    if role:
        client.force_authenticate(User.objects.create_user(email or f'{role.lower()}@eshop.test', 'pw-123456', role=role))
    return client


@pytest.fixture
def customer():
    return client_for(User.Role.CUSTOMER)


@pytest.fixture
def kitchen():
    return Category.objects.create(name='Kitchen')


def product(kitchen, name='Mug', price='1200', stock=5, **extra):
    return Product.objects.create(category=kitchen, name=name, price=Decimal(price), stock=stock, **extra)


def lines(response):
    return [(i['product']['name'], i['quantity'], i['available']) for i in response.data['items']]


def add(client, prod, quantity=1):
    return client.post('/api/cart/items/', {'product': str(prod.id), 'quantity': quantity}, format='json')


@pytest.mark.parametrize('role,status', [(None, 401), (User.Role.EMPLOYEE, 403), (User.Role.ADMIN, 403)])
def test_only_customers_have_a_saved_cart(role, status):
    assert client_for(role).get('/api/cart/').status_code == status


def test_new_customer_starts_with_an_empty_cart(customer):
    assert customer.get('/api/cart/').data == {'items': [], 'count': 0, 'subtotal': '0'}


def test_adding_sums_quantities_and_caps_at_stock(customer, kitchen):
    mug = product(kitchen, stock=5)

    add(customer, mug, 2)
    response = add(customer, mug, 10)

    assert lines(response) == [('Mug', 5, True)]
    assert response.data['count'] == 5
    assert Decimal(response.data['subtotal']) == Decimal('6000')


def test_out_of_stock_and_archived_products_cannot_be_added(customer, kitchen):
    sold_out = product(kitchen, 'Sold out', stock=0)
    archived = product(kitchen, 'Old', is_archived=True)

    assert add(customer, sold_out).status_code == 400
    assert add(customer, archived).status_code == 400


def test_set_quantity_caps_at_stock_and_remove(customer, kitchen):
    mug = product(kitchen, stock=4)
    add(customer, mug)

    assert lines(customer.patch(f'/api/cart/items/{mug.id}/', {'quantity': 9}, format='json')) == [('Mug', 4, True)]
    assert lines(customer.delete(f'/api/cart/items/{mug.id}/')) == []


def test_an_item_that_sells_out_stays_but_is_unavailable(customer, kitchen):
    mug = product(kitchen, stock=3)
    add(customer, mug, 3)
    Product.objects.filter(pk=mug.pk).update(stock=1)

    assert lines(customer.get('/api/cart/')) == [('Mug', 3, False)]


def test_archived_products_leave_the_cart(customer, kitchen):
    mug = product(kitchen)
    add(customer, mug)
    Product.objects.filter(pk=mug.pk).update(is_archived=True)

    assert lines(customer.get('/api/cart/')) == []


def test_cart_shows_current_prices(customer, kitchen):
    mug = product(kitchen, price='1200')
    add(customer, mug, 2)
    Product.objects.filter(pk=mug.pk).update(price=Decimal('1500'))

    response = customer.get('/api/cart/')
    assert Decimal(response.data['items'][0]['product']['price']) == Decimal('1500')
    assert Decimal(response.data['subtotal']) == Decimal('3000')


def test_merge_sums_with_the_saved_cart_and_caps_at_stock(customer, kitchen):
    mug = product(kitchen, 'Mug', stock=5)
    board = product(kitchen, 'Board', stock=2)
    sold_out = product(kitchen, 'Sold out', stock=0)
    archived = product(kitchen, 'Old', is_archived=True)
    add(customer, mug, 2)

    response = customer.post('/api/cart/merge/', {'items': [
        {'product': str(mug.id), 'quantity': 4},
        {'product': str(board.id), 'quantity': 1},
        {'product': str(sold_out.id), 'quantity': 1},
        {'product': str(archived.id), 'quantity': 1},
        {'product': '00000000-0000-0000-0000-000000000000', 'quantity': 1},
    ]}, format='json')

    assert lines(response) == [('Mug', 5, True), ('Board', 1, True)]


def test_each_customer_has_their_own_cart(kitchen):
    mug = product(kitchen)
    alice, bob = client_for(User.Role.CUSTOMER, 'alice@eshop.test'), client_for(User.Role.CUSTOMER, 'bob@eshop.test')
    add(alice, mug)

    assert bob.get('/api/cart/').data['count'] == 0


def test_guests_can_price_their_browser_cart_without_saving(kitchen):
    mug = product(kitchen, price='1200', stock=1)
    archived = product(kitchen, 'Old', is_archived=True)

    response = APIClient().post('/api/cart/preview/', {'items': [
        {'product': str(mug.id), 'quantity': 2},
        {'product': str(archived.id), 'quantity': 1},
    ]}, format='json')

    assert response.status_code == 200
    assert lines(response) == [('Mug', 2, False)]
    assert Decimal(response.data['subtotal']) == Decimal('2400')


def test_preview_rejects_bad_lines():
    response = APIClient().post('/api/cart/preview/', {'items': [{'product': 'nope', 'quantity': 0}]}, format='json')

    assert response.status_code == 400
