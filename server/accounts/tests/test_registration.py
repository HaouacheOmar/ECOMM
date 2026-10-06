import re
from unittest import mock

import pytest
from django.core import mail
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from accounts.verification import make_token

pytestmark = pytest.mark.django_db(transaction=True)  # verification email is sent on commit

PASSWORD = 'a-Solid-pass-42'


def register(client, email='alice@example.com', password=PASSWORD, confirm=None, **extra):
    return client.post('/api/auth/register/', {
        'email': email, 'password': password, 'password_confirm': confirm or password, **extra,
    }, format='json')


def link_token(message):
    return re.search(r'#/verify/(\S+)', message.body).group(1)


def test_register_creates_an_unverified_customer_logs_them_in_and_emails_a_link():
    client = APIClient()

    response = register(client, email='Alice@Example.com', role='ADMIN')

    assert response.status_code == 201
    user = User.objects.get()
    assert (user.email, user.role, user.is_email_verified) == ('alice@example.com', 'CUSTOMER', False)
    assert AccessToken(response.data['access'])['role'] == 'CUSTOMER'
    assert response.cookies['refresh']['httponly']
    assert len(mail.outbox) == 1
    assert mail.outbox[0].to == ['alice@example.com']
    assert 'http://localhost:5173/#/verify/' in mail.outbox[0].body


def test_mismatched_passwords_are_reported_on_the_confirmation_field():
    response = register(APIClient(), confirm='something-else-42')

    assert response.status_code == 400
    assert 'password_confirm' in response.data
    assert not User.objects.exists()


def test_weak_passwords_are_rejected():
    response = register(APIClient(), password='12345678')

    assert response.status_code == 400
    assert 'password' in response.data


def test_an_email_can_only_register_once_regardless_of_case():
    register(APIClient())

    response = register(APIClient(), email='ALICE@example.com')

    assert response.status_code == 400
    assert 'email' in response.data


def test_login_matches_email_case_insensitively():
    register(APIClient())

    response = APIClient().post('/api/auth/login/', {'email': 'ALICE@EXAMPLE.COM', 'password': PASSWORD}, format='json')

    assert response.status_code == 200


def test_the_emailed_link_verifies_the_account_and_fresh_tokens_say_so():
    client = APIClient()
    register(client)

    response = APIClient().post('/api/auth/verify/', {'token': link_token(mail.outbox[0])}, format='json')

    assert response.status_code == 200
    assert User.objects.get().is_email_verified
    refreshed = client.post('/api/auth/refresh/')
    assert refreshed.data['user']['is_email_verified'] is True
    assert AccessToken(refreshed.data['access'])['is_email_verified'] is True


def test_tampered_links_are_rejected():
    register(APIClient())

    response = APIClient().post('/api/auth/verify/', {'token': link_token(mail.outbox[0]) + 'x'}, format='json')

    assert response.status_code == 400
    assert response.data['code'] == 'invalid'
    assert not User.objects.get().is_email_verified


def test_links_expire_after_three_days():
    register(APIClient())
    user = User.objects.get()
    with mock.patch('django.core.signing.time.time', return_value=0):
        old_token = make_token(user)

    response = APIClient().post('/api/auth/verify/', {'token': old_token}, format='json')

    assert response.status_code == 400
    assert response.data['code'] == 'expired'


def test_a_link_for_a_changed_email_no_longer_works():
    register(APIClient())
    user = User.objects.get()
    token = make_token(user)
    User.objects.filter(pk=user.pk).update(email='new@example.com')

    assert APIClient().post('/api/auth/verify/', {'token': token}, format='json').status_code == 400


def test_resend_sends_a_new_link_at_most_once_a_minute():
    client = APIClient()
    access = register(client).data['access']
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')

    assert client.post('/api/auth/verify/resend/').status_code == 200
    assert client.post('/api/auth/verify/resend/').status_code == 429
    assert len(mail.outbox) == 2


def test_resend_requires_login_and_an_unverified_account():
    assert APIClient().post('/api/auth/verify/resend/').status_code == 401

    client = APIClient()
    access = register(client).data['access']
    User.objects.update(is_email_verified=True)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    assert client.post('/api/auth/verify/resend/').status_code == 400

