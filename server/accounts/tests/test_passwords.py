import re
from datetime import datetime, timedelta
from unittest import mock

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.core import mail
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import EmployeeSession, User
from config.asgi import application
from config.sockets import UNAUTHORIZED

pytestmark = pytest.mark.django_db

OLD, NEW = 'Old-pass-2026', 'Brand-new-pass-77'


def make_user(email='cust@eshop.test', role=User.Role.CUSTOMER):
    return User.objects.create_user(email, OLD, role=role)


def login(email='cust@eshop.test', password=OLD):
    client = APIClient()
    response = client.post('/api/auth/login/', {'email': email, 'password': password}, format='json')
    if response.status_code == 200:
        client.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
    return client, response


def forgot(email):
    return APIClient().post('/api/auth/password/reset/', {'email': email}, format='json')


def emailed_link():
    uid, token = re.search(r'#/reset/([^/\s]+)/(\S+)', mail.outbox[-1].body).groups()
    return uid, token


def reset(uid, token, password=NEW, confirm=None):
    return APIClient().post('/api/auth/password/reset/confirm/',
                            {'uid': uid, 'token': token, 'password': password, 'password_confirm': confirm or password}, format='json')


def test_a_reset_request_answers_the_same_for_known_and_unknown_emails():
    make_user()
    make_user('emp@eshop.test', User.Role.EMPLOYEE)

    known, unknown, staff = forgot('CUST@eshop.test'), forgot('nobody@eshop.test'), forgot('emp@eshop.test')

    assert known.status_code == unknown.status_code == staff.status_code == 200
    assert known.data == unknown.data == staff.data
    assert [m.to for m in mail.outbox] == [['cust@eshop.test']]  # Customers only
    assert '/#/reset/' in mail.outbox[0].body

    forgot('cust@eshop.test')  # within a minute: same answer, no second email
    assert len(mail.outbox) == 1


def test_a_reset_sets_the_new_password_and_signs_out_other_sessions():
    make_user()
    other_tab, _ = login()
    forgot('cust@eshop.test')
    uid, token = emailed_link()

    assert reset(uid, token, confirm='something-else').data['password_confirm'] == ['Passwords do not match.']
    assert 'password' in reset(uid, token, password='123').data
    assert reset(uid, token).status_code == 200

    assert other_tab.post('/api/auth/refresh/').status_code == 401
    assert login(password=OLD)[1].status_code == 401
    assert login(password=NEW)[1].status_code == 200


def test_a_used_reset_link_is_rejected():
    make_user()
    forgot('cust@eshop.test')
    uid, token = emailed_link()
    assert reset(uid, token).status_code == 200

    again = reset(uid, token, password='Another-pass-88')

    assert again.status_code == 400 and again.data['code'] == 'invalid_link'


def test_an_expired_or_tampered_reset_link_is_rejected():
    make_user()
    forgot('cust@eshop.test')
    uid, token = emailed_link()

    later = datetime.now() + timedelta(seconds=settings.PASSWORD_RESET_TIMEOUT + 60)  # the generator's own (naive) clock
    with mock.patch.object(PasswordResetTokenGenerator, '_now', return_value=later):
        assert reset(uid, token).data['code'] == 'invalid_link'
    assert reset(uid, token + 'x').data['code'] == 'invalid_link'
    assert reset('not-base64!', token).data['code'] == 'invalid_link'
    assert reset(uid, token).status_code == 200  # still fine within the hour


def test_change_password_requires_the_correct_current_password():
    make_user()
    client, _ = login()

    wrong = client.post('/api/auth/password/change/', {'current_password': 'nope', 'password': NEW, 'password_confirm': NEW}, format='json')

    assert wrong.status_code == 400 and 'current_password' in wrong.data
    assert login(password=OLD)[1].status_code == 200


@pytest.mark.parametrize('role', [User.Role.CUSTOMER, User.Role.EMPLOYEE, User.Role.ADMIN])
def test_any_role_changes_password_and_only_this_session_survives(role):
    make_user('user@eshop.test', role)
    other_tab, _ = login('user@eshop.test')
    client, _ = login('user@eshop.test')

    changed = client.post('/api/auth/password/change/', {'current_password': OLD, 'password': NEW, 'password_confirm': NEW}, format='json')

    assert changed.status_code == 200 and changed.data['access']
    assert other_tab.post('/api/auth/refresh/').status_code == 401
    assert client.post('/api/auth/refresh/').status_code == 200  # this tab carries on with fresh tokens
    assert login('user@eshop.test', NEW)[1].status_code == 200


def test_a_password_change_ends_the_open_employee_session():
    make_user('emp@eshop.test', User.Role.EMPLOYEE)
    client, _ = login('emp@eshop.test')
    first = EmployeeSession.objects.get()

    client.post('/api/auth/password/change/', {'current_password': OLD, 'password': NEW, 'password_confirm': NEW}, format='json')

    first.refresh_from_db()
    assert first.logout_at is not None
    assert EmployeeSession.objects.filter(logout_at=None).count() == 1  # the session that continues


@pytest.mark.django_db(transaction=True)
async def test_a_password_change_closes_the_users_open_sockets():
    user = await database_sync_to_async(make_user)('emp@eshop.test', User.Role.EMPLOYEE)
    socket = WebsocketCommunicator(application, '/ws/orders/', headers=[(b'origin', settings.FRONTEND_ORIGIN.encode())])
    assert (await socket.connect())[0]
    await socket.send_json_to({'type': 'auth', 'token': str(AccessToken.for_user(user))})
    assert await socket.receive_json_from() == {'type': 'ready'}

    client, _ = await database_sync_to_async(login)('emp@eshop.test')
    await database_sync_to_async(client.post)(
        '/api/auth/password/change/', {'current_password': OLD, 'password': NEW, 'password_confirm': NEW}, format='json')

    assert await socket.receive_output(2) == {'type': 'websocket.close', 'code': UNAUTHORIZED}
