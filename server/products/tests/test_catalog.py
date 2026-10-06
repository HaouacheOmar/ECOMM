from decimal import Decimal

import pytest
from django.db import IntegrityError
from rest_framework.test import APIClient

from products.models import Category, Product

pytestmark = pytest.mark.django_db


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def kitchen():
    return Category.objects.create(name='Kitchen')


@pytest.fixture
def bags():
    return Category.objects.create(name='Bags')


def product(category, name, price='1000', stock=5, **extra):
    return Product.objects.create(category=category, name=name, price=Decimal(price), stock=stock, **extra)


def names(response):
    return [p['name'] for p in response.data['results']]


def test_guests_can_browse_without_logging_in(client, kitchen):
    product(kitchen, 'Mug')

    response = client.get('/api/products/')

    assert response.status_code == 200
    assert names(response) == ['Mug']
    assert response.data['results'][0]['category']['name'] == 'Kitchen'


def test_archived_products_are_never_listed_or_shown(client, kitchen):
    archived = product(kitchen, 'Old lamp', is_archived=True)
    product(kitchen, 'Mug')

    assert names(client.get('/api/products/')) == ['Mug']
    assert client.get(f'/api/products/{archived.id}/').status_code == 404


def test_filter_by_category(client, kitchen, bags):
    product(kitchen, 'Mug')
    product(bags, 'Tote')

    assert names(client.get(f'/api/products/?category={bags.id}')) == ['Tote']
    assert client.get('/api/products/?category=not-a-uuid').data['count'] == 0


def test_search_by_name_is_case_insensitive(client, kitchen):
    product(kitchen, 'Blue ceramic mug')
    product(kitchen, 'Oak board')

    assert names(client.get('/api/products/?search=MUG')) == ['Blue ceramic mug']


def test_sort_by_price_rating_and_newest(client, kitchen):
    product(kitchen, 'Mid', price='2000', rating_avg=Decimal('3.0'))
    product(kitchen, 'Cheap', price='500', rating_avg=Decimal('4.5'))
    product(kitchen, 'Pricey', price='9000', rating_avg=Decimal('4.0'))

    assert names(client.get('/api/products/?ordering=price')) == ['Cheap', 'Mid', 'Pricey']
    assert names(client.get('/api/products/?ordering=-price')) == ['Pricey', 'Mid', 'Cheap']
    assert names(client.get('/api/products/?ordering=-rating_avg')) == ['Cheap', 'Pricey', 'Mid']
    assert names(client.get('/api/products/')) == ['Pricey', 'Cheap', 'Mid']  # newest first


def test_out_of_stock_products_are_listed_and_flagged(client, kitchen):
    product(kitchen, 'Sold out', stock=0)

    item = client.get('/api/products/').data['results'][0]

    assert item['in_stock'] is False


def test_catalog_is_paginated_twenty_per_page(client, kitchen):
    for i in range(25):
        product(kitchen, f'Item {i}')

    first = client.get('/api/products/').data
    second = client.get('/api/products/?page=2').data

    assert first['count'] == 25
    assert len(first['results']) == 20
    assert len(second['results']) == 5


def test_product_detail_includes_description_and_images(client, kitchen):
    mug = product(kitchen, 'Mug', description='Stoneware, 350 ml')

    detail = client.get(f'/api/products/{mug.id}/').data

    assert detail['description'] == 'Stoneware, 350 ml'
    assert detail['images'] == []
    assert detail['image'] is None


def test_categories_are_listed_alphabetically(client, kitchen, bags):
    assert [c['name'] for c in client.get('/api/categories/').data] == ['Bags', 'Kitchen']


def test_stock_can_never_go_negative(kitchen):
    with pytest.raises(IntegrityError):
        product(kitchen, 'Broken', stock=-1)
