from decimal import Decimal

import pytest
from rest_framework.test import APIClient

from accounts.models import User
from products.models import Category, Product
from stock.models import Supplier

pytestmark = pytest.mark.django_db


def client_for(role=None):
    client = APIClient()
    if role:
        client.force_authenticate(User.objects.create_user(f'{role.lower()}@eshop.test', 'pw-123456', role=role))
    return client


@pytest.fixture
def admin():
    return client_for(User.Role.ADMIN)


@pytest.fixture
def atlas():
    return Supplier.objects.create(name='Atlas Ceramics', phone='0550 12 34 56')


@pytest.fixture
def mug():
    return Product.objects.create(category=Category.objects.create(name='Kitchen'), name='Mug', price=Decimal('1200'), cost_price=Decimal('500'))


@pytest.mark.parametrize('role', [None, User.Role.CUSTOMER, User.Role.EMPLOYEE])
def test_only_the_admin_reaches_suppliers(role, atlas):
    client = client_for(role)
    assert client.get('/api/suppliers/').status_code in (401, 403)
    assert client.post('/api/suppliers/', {'name': 'Sahara Textiles'}).status_code in (401, 403)
    assert client.post(f'/api/suppliers/{atlas.id}/archive/').status_code in (401, 403)


def test_admin_adds_edits_and_searches_suppliers(admin):
    created = admin.post('/api/suppliers/', {
        'name': 'Sahara Textiles', 'phone': '0661 00 11 22', 'email': 'sales@sahara.dz', 'address': 'Zone industrielle, Blida', 'notes': 'Delivers on Tuesdays',
    }, format='json')
    assert created.status_code == 201

    assert admin.patch(f'/api/suppliers/{created.data["id"]}/', {'phone': '0661 99 88 77'}, format='json').data['phone'] == '0661 99 88 77'
    assert [s['name'] for s in admin.get('/api/suppliers/?search=sahara').data['results']] == ['Sahara Textiles']


def test_supplier_names_are_required_and_unique(admin, atlas):
    assert set(admin.post('/api/suppliers/', {'name': ''}, format='json').data) == {'name'}
    assert set(admin.post('/api/suppliers/', {'name': 'Atlas Ceramics'}, format='json').data) == {'name'}


def test_suppliers_are_archived_not_deleted_and_can_be_restored(admin, atlas):
    assert admin.delete(f'/api/suppliers/{atlas.id}/').status_code == 405

    assert admin.post(f'/api/suppliers/{atlas.id}/archive/').data['is_archived'] is True
    assert admin.get('/api/suppliers/').data['count'] == 0
    assert [s['name'] for s in admin.get('/api/suppliers/?include_archived=1').data['results']] == ['Atlas Ceramics']
    assert admin.get(f'/api/suppliers/{atlas.id}/').status_code == 200

    assert admin.post(f'/api/suppliers/{atlas.id}/restore/').data['is_archived'] is False
    assert admin.get('/api/suppliers/').data['count'] == 1


def test_a_product_gets_an_optional_usual_supplier_seen_only_by_the_admin(admin, atlas, mug):
    assert admin.patch(f'/api/products/{mug.id}/', {'usual_supplier': str(atlas.id)}, format='json').status_code == 200
    assert admin.get(f'/api/products/{mug.id}/').data['usual_supplier'] == {'id': str(atlas.id), 'name': 'Atlas Ceramics', 'is_archived': False}
    assert 'usual_supplier' not in APIClient().get(f'/api/products/{mug.id}/').data

    assert admin.patch(f'/api/products/{mug.id}/', {'usual_supplier': None}, format='json').status_code == 200
    assert admin.get(f'/api/products/{mug.id}/').data['usual_supplier'] is None


def test_an_archived_supplier_cannot_become_a_usual_supplier_but_an_existing_link_survives(admin, atlas, mug):
    mug.usual_supplier = atlas
    mug.save()
    atlas.is_archived = True
    atlas.save()

    assert admin.patch(f'/api/products/{mug.id}/', {'price': '1300', 'usual_supplier': str(atlas.id)}, format='json').status_code == 200
    other = Product.objects.create(category=mug.category, name='Bowl', price=Decimal('900'), cost_price=Decimal('400'))
    refused = admin.patch(f'/api/products/{other.id}/', {'usual_supplier': str(atlas.id)}, format='json')
    assert refused.status_code == 400 and set(refused.data) == {'usual_supplier'}
