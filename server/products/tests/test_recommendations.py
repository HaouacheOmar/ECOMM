from datetime import timedelta
from decimal import Decimal

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from orders.models import Order, OrderItem, PickupPoint
from products.models import Category, Product, Review
from products.tasks import precompute_bestsellers

pytestmark = pytest.mark.django_db


@pytest.fixture
def kitchen():
    return Category.objects.create(name='Kitchen')


@pytest.fixture
def bags():
    return Category.objects.create(name='Bags')


def product(category, name, stock=20, **extra):
    return Product.objects.create(category=category, name=name, price=Decimal('1000'), stock=stock, **extra)


def sell(item, units, status=Order.Status.CONFIRMED, days_ago=0, customer=None):
    customer = customer or User.objects.get_or_create(email='buyer@eshop.test')[0]
    order = Order.objects.create(customer=customer, status=status, delivery_method='HOME_DELIVERY',
                                 delivery_address='1 Rue A', total_amount=item.price * units)
    Order.objects.filter(pk=order.pk).update(created_at=timezone.now() - timedelta(days=days_ago))
    OrderItem.objects.create(order=order, product=item, quantity=units, price_at_purchase=item.price)


def names(response):
    assert response.status_code == 200
    return [p['name'] for p in response.data]


def bestsellers():
    return names(APIClient().get('/api/bestsellers/'))


def customer_client(email='cust@eshop.test'):
    customer = User.objects.create_user(email, 'x', is_email_verified=True)
    client = APIClient()
    client.force_authenticate(customer)
    return customer, client


def with_reviews(item, ratings):
    for n, rating in enumerate(ratings):
        Review.objects.create(product=item, customer=User.objects.get_or_create(email=f'r{n}@eshop.test')[0], rating=rating)
    Product.objects.filter(pk=item.pk).update(rating_avg=Decimal(sum(ratings)) / len(ratings), review_count=len(ratings))


def test_bestsellers_rank_units_sold_in_the_last_30_days_without_cancelled_orders(kitchen):
    mug, board, lamp, old = (product(kitchen, n) for n in ('Mug', 'Board', 'Lamp', 'Old favourite'))
    sell(mug, 3)
    sell(board, 5)
    sell(lamp, 10, status=Order.Status.CANCELLED)  # cancelled: doesn't count
    sell(old, 50, days_ago=31)  # outside the window
    sell(mug, 4, status=Order.Status.DELIVERED)

    assert bestsellers()[:2] == ['Mug', 'Board']  # 7 units, then 5


def test_fewer_than_8_bestsellers_are_padded_with_the_newest_products(kitchen):
    items = [product(kitchen, f'P{n}') for n in range(10)]  # P9 is the newest
    sell(items[0], 1)
    product(kitchen, 'Archived', is_archived=True)

    assert bestsellers() == ['P0', 'P9', 'P8', 'P7', 'P6', 'P5', 'P4', 'P3']


def test_bestsellers_are_precomputed_and_served_from_the_cache(kitchen):
    mug, board = product(kitchen, 'Mug'), product(kitchen, 'Board')
    sell(mug, 3)
    precompute_bestsellers.delay()

    sell(board, 9)  # not reflected until the next run
    assert bestsellers()[0] == 'Mug'
    precompute_bestsellers.delay()
    assert bestsellers()[0] == 'Board'


def test_a_customer_with_no_purchases_gets_the_bestsellers(kitchen):
    sell(product(kitchen, 'Mug'), 3)
    _, client = customer_client()
    assert names(client.get('/api/recommendations/')) == bestsellers()


def test_one_five_star_review_does_not_outrank_a_well_reviewed_4_8(kitchen):
    bought = product(kitchen, 'Bought mug')
    one_review = product(kitchen, 'One review')
    established = product(kitchen, 'Established')
    so_so = product(kitchen, 'So-so')
    with_reviews(one_review, [5])
    with_reviews(established, [5, 5, 5, 5, 5, 5, 5, 5, 4, 4])  # 4.8 from 10 Reviews
    with_reviews(so_so, [2] * 10)  # brings the shop average down to a realistic level
    customer, client = customer_client()
    sell(bought, 1, customer=customer)

    ranked = names(client.get('/api/recommendations/'))

    assert ranked.index('Established') < ranked.index('One review') < ranked.index('So-so')
    assert 'Bought mug' not in ranked


def test_recommendations_come_from_bought_categories_with_ties_by_units_sold(kitchen, bags):
    bought, quiet, popular = product(kitchen, 'Bought'), product(kitchen, 'Quiet'), product(kitchen, 'Popular')
    product(bags, 'Tote')
    sell(popular, 6)
    customer, client = customer_client()
    sell(bought, 1, customer=customer)

    ranked = names(client.get('/api/recommendations/'))

    assert ranked[:2] == ['Popular', 'Quiet']  # no Reviews: same score, more units first
    assert ranked[2:] == ['Tote']  # topped up from the Bestsellers (never what they bought)


def test_confirming_an_order_changes_recommendations_and_cancelling_reverts_them(kitchen, bags):
    tote, satchel = product(bags, 'Tote'), product(bags, 'Satchel')
    mug = product(kitchen, 'Mug')
    sell(mug, 5)
    point = PickupPoint.objects.create(name='Hydra', city='Algiers', address='1 Rue B')
    _, client = customer_client()
    before = names(client.get('/api/recommendations/'))
    assert before == bestsellers()

    client.post('/api/cart/items/', {'product': str(tote.id), 'quantity': 1}, format='json')
    order = client.post('/api/orders/', {'delivery_method': 'PICKUP_POINT', 'pickup_point': str(point.id)}, format='json').data

    after = names(client.get('/api/recommendations/'))
    assert after[0] == 'Satchel' and 'Tote' not in after

    client.post(f'/api/orders/{order["id"]}/cancel/')
    assert names(client.get('/api/recommendations/')) == bestsellers()


@pytest.mark.parametrize('role,status', [(None, 401), (User.Role.EMPLOYEE, 403)])
def test_recommendations_are_for_customers(role, status):
    client = APIClient()
    if role:
        client.force_authenticate(User.objects.create_user('e@eshop.test', 'x', role=role))
    assert client.get('/api/recommendations/').status_code == status
