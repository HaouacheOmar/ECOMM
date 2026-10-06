import threading
from decimal import Decimal

import pytest
from django.db import connection
from rest_framework.test import APIClient

from accounts.models import User
from products.models import Category, Product, Review

pytestmark = pytest.mark.django_db


def client_for(role=None, email=None, **extra):
    client = APIClient()
    if role:
        client.force_authenticate(User.objects.create_user(email or f'{role.lower()}@eshop.test', 'x', role=role, **extra))
    return client


@pytest.fixture
def mug():
    return Product.objects.create(category=Category.objects.create(name='Kitchen'), name='Mug', price=Decimal('1200'), stock=0)


def review(client, product, rating, text=''):
    return client.post(f'/api/products/{product.id}/reviews/', {'rating': rating, 'text': text}, format='json')


def totals(product):
    product.refresh_from_db()
    return product.rating_avg, product.review_count


def test_a_customer_reviews_and_the_products_average_and_count_update(mug):
    amina = client_for(User.Role.CUSTOMER, 'amina@eshop.test', first_name='Amina')
    karim = client_for(User.Role.CUSTOMER, 'karim.b@eshop.test')

    first = review(amina, mug, 5, '  Lovely glaze.  ')
    assert first.status_code == 201
    assert first.data['review']['author'] == 'Amina' and first.data['review']['text'] == 'Lovely glaze.'
    assert (first.data['rating_avg'], first.data['review_count']) == ('5.00', 1)

    review(karim, mug, 2)
    assert totals(mug) == (Decimal('3.50'), 2)

    listed = APIClient().get(f'/api/products/{mug.id}/reviews/').data  # anyone can read them
    assert [(r['author'], r['rating']) for r in listed['results']] == [('karim.b', 2), ('Amina', 5)]
    shown = APIClient().get(f'/api/products/{mug.id}/').data  # out of stock, still reviewable
    assert (shown['rating_avg'], shown['review_count']) == ('3.50', 2)


def test_posting_again_edits_the_existing_review(mug):
    amina = client_for(User.Role.CUSTOMER)
    review(amina, mug, 5, 'Great')

    again = review(amina, mug, 3, 'Chipped after a month')

    assert again.status_code == 200
    assert Review.objects.count() == 1
    assert totals(mug) == (Decimal('3.00'), 1)
    mine = amina.get(f'/api/products/{mug.id}/reviews/mine/').data
    assert (mine['rating'], mine['text']) == (3, 'Chipped after a month')


@pytest.mark.parametrize('role,status', [(None, 401), (User.Role.EMPLOYEE, 403), (User.Role.ADMIN, 403)])
def test_guests_and_staff_cannot_post_reviews(mug, role, status):
    assert review(client_for(role), mug, 4).status_code == status
    assert totals(mug) == (Decimal('0'), 0)


@pytest.mark.parametrize('rating', [0, 6, 'five', None])
def test_a_rating_must_be_1_to_5(mug, rating):
    assert 'rating' in review(client_for(User.Role.CUSTOMER), mug, rating).data


def test_archived_products_cannot_be_reviewed_or_listed(mug):
    Product.objects.filter(pk=mug.pk).update(is_archived=True)
    assert review(client_for(User.Role.CUSTOMER), mug, 4).status_code == 404
    assert APIClient().get(f'/api/products/{mug.id}/reviews/').status_code == 404


def test_no_review_yet_is_a_404_for_mine(mug):
    assert client_for(User.Role.CUSTOMER).get(f'/api/products/{mug.id}/reviews/mine/').status_code == 404


@pytest.mark.django_db(transaction=True)
def test_simultaneous_reviews_keep_the_totals_exact(mug):
    customers = [User.objects.create_user(f'c{n}@eshop.test', 'x') for n in range(4)]
    start = threading.Barrier(len(customers))

    def rate(customer, rating):
        client = APIClient()
        client.force_authenticate(customer)
        try:
            start.wait()
            review(client, mug, rating)
        finally:
            connection.close()

    threads = [threading.Thread(target=rate, args=(c, r)) for c, r in zip(customers, [5, 4, 2, 1])]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert totals(mug) == (Decimal('3.00'), 4)
