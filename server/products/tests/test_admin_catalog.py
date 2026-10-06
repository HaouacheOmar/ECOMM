import io
from decimal import Decimal

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient

from accounts.models import User
from products.models import Category, Product

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def _media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path


def client_for(role=None):
    client = APIClient()
    if role:
        client.force_authenticate(User.objects.create_user(f'{role.lower()}@eshop.test', 'pw-123456', role=role))
    return client


@pytest.fixture
def admin():
    return client_for(User.Role.ADMIN)


@pytest.fixture
def kitchen():
    return Category.objects.create(name='Kitchen')


@pytest.fixture
def mug(kitchen):
    return Product.objects.create(category=kitchen, name='Mug', price=Decimal('1200'), stock=5)


def png(name='photo.png'):
    buffer = io.BytesIO()
    Image.new('RGB', (8, 8), 'purple').save(buffer, 'PNG')
    return SimpleUploadedFile(name, buffer.getvalue(), content_type='image/png')


@pytest.mark.parametrize('role', [None, User.Role.CUSTOMER, User.Role.EMPLOYEE])
def test_only_the_admin_can_write_the_catalog(role, kitchen, mug):
    client = client_for(role)
    expected = 401 if role is None else 403

    assert client.post('/api/products/', {'name': 'X', 'price': '10', 'stock': 1, 'category': kitchen.id}).status_code == expected
    assert client.patch(f'/api/products/{mug.id}/', {'price': '1'}).status_code == expected
    assert client.post(f'/api/products/{mug.id}/archive/').status_code == expected
    assert client.post(f'/api/products/{mug.id}/images/', {'image': png()}, format='multipart').status_code == expected
    assert client.post('/api/categories/', {'name': 'Bags'}).status_code == expected


def test_admin_creates_and_edits_a_product(admin, kitchen):
    created = admin.post('/api/products/', {
        'name': 'Oak board', 'description': 'Solid oak', 'price': '3800', 'stock': 3, 'category': kitchen.id,
    }, format='json')
    assert created.status_code == 201

    product_id = created.data['id']
    assert admin.patch(f'/api/products/{product_id}/', {'price': '3500', 'stock': 0}, format='json').status_code == 200

    public = APIClient().get(f'/api/products/{product_id}/').data
    assert public['name'] == 'Oak board'
    assert Decimal(public['price']) == Decimal('3500')
    assert public['in_stock'] is False


def test_product_validation_rejects_bad_price_and_stock(admin, kitchen):
    response = admin.post('/api/products/', {'name': 'Bad', 'price': '0', 'stock': -1, 'category': kitchen.id}, format='json')

    assert response.status_code == 400
    assert set(response.data) == {'price', 'stock'}


def test_products_are_archived_not_deleted(admin, mug):
    assert admin.delete(f'/api/products/{mug.id}/').status_code == 405
    assert Product.objects.filter(pk=mug.pk).exists()


def test_archiving_hides_a_product_from_everyone_but_the_admin(admin, mug):
    assert admin.post(f'/api/products/{mug.id}/archive/').data['is_archived'] is True

    assert APIClient().get(f'/api/products/{mug.id}/').status_code == 404
    assert APIClient().get('/api/products/').data['count'] == 0
    assert admin.get('/api/products/').data['count'] == 0  # storefront view hides it for the Admin too
    assert admin.get('/api/products/?include_archived=1').data['count'] == 1
    assert admin.get(f'/api/products/{mug.id}/').status_code == 200

    admin.post(f'/api/products/{mug.id}/restore/')
    assert APIClient().get(f'/api/products/{mug.id}/').status_code == 200


def test_include_archived_is_ignored_for_non_admins(mug):
    mug.is_archived = True
    mug.save()

    assert client_for(User.Role.CUSTOMER).get('/api/products/?include_archived=1').data['count'] == 0


def test_first_uploaded_photo_is_primary_and_served_publicly(admin, mug):
    first = admin.post(f'/api/products/{mug.id}/images/', {'image': png('a.png')}, format='multipart')
    admin.post(f'/api/products/{mug.id}/images/', {'image': png('b.png')}, format='multipart')

    assert first.status_code == 201
    detail = APIClient().get(f'/api/products/{mug.id}/').data
    assert [img['is_primary'] for img in detail['images']] == [True, False]
    assert detail['image'].startswith('http://testserver/media/products/')


def test_non_image_uploads_are_rejected(admin, mug):
    fake = SimpleUploadedFile('notes.png', b'not an image', content_type='image/png')

    response = admin.post(f'/api/products/{mug.id}/images/', {'image': fake}, format='multipart')

    assert response.status_code == 400
    assert 'image' in response.data


def test_admin_can_change_and_delete_the_primary_photo(admin, mug):
    admin.post(f'/api/products/{mug.id}/images/', {'image': png('a.png')}, format='multipart')
    images = admin.post(f'/api/products/{mug.id}/images/', {'image': png('b.png')}, format='multipart').data['images']
    first_id, second_id = images[0]['id'], images[1]['id']

    images = admin.post(f'/api/products/{mug.id}/images/{second_id}/primary/').data['images']
    assert [(i['id'], i['is_primary']) for i in images] == [(second_id, True), (first_id, False)]

    images = admin.delete(f'/api/products/{mug.id}/images/{second_id}/').data['images']
    assert [(i['id'], i['is_primary']) for i in images] == [(first_id, True)]


def test_admin_manages_categories(admin, mug):
    created = admin.post('/api/categories/', {'name': 'Bags'}, format='json')
    assert created.status_code == 201
    assert admin.patch(f"/api/categories/{created.data['id']}/", {'name': 'Bags & totes'}, format='json').data['name'] == 'Bags & totes'
    assert admin.delete(f"/api/categories/{created.data['id']}/").status_code == 204


def test_a_category_with_products_cannot_be_deleted(admin, mug):
    response = admin.delete(f'/api/categories/{mug.category_id}/')

    assert response.status_code == 409
    assert Category.objects.filter(pk=mug.category_id).exists()


def test_category_names_are_unique(admin, kitchen):
    assert admin.post('/api/categories/', {'name': 'Kitchen'}, format='json').status_code == 400
