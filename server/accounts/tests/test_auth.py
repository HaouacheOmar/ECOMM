import pytest
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import EmployeeSession, User

PASSWORD = 'correct-horse-9'


@pytest.fixture
def client():
    return APIClient()


def make_user(role=User.Role.CUSTOMER, email=None, **extra):
    return User.objects.create_user(email or f'{role.lower()}@eshop.test', PASSWORD, role=role, **extra)


def login(client, user, password=PASSWORD):
    return client.post('/api/auth/login/', {'email': user.email, 'password': password}, format='json')


pytestmark = pytest.mark.django_db


def test_login_returns_access_token_with_role_claims_and_sets_refresh_cookie(client):
    admin = make_user(User.Role.ADMIN)

    response = login(client, admin)

    assert response.status_code == 200
    assert response.data['user'] == {'id': str(admin.id), 'email': admin.email, 'role': 'ADMIN', 'is_email_verified': False}
    claims = AccessToken(response.data['access'])
    assert claims['role'] == 'ADMIN'
    assert claims['is_email_verified'] is False
    cookie = response.cookies['refresh']
    assert cookie['httponly']
    assert cookie['samesite'] == 'Strict'
    assert cookie['path'] == '/api/auth/'
    assert 'refresh' not in response.data


def test_login_with_wrong_password_is_rejected(client):
    user = make_user()

    response = login(client, user, password='nope')

    assert response.status_code == 401
    assert 'refresh' not in response.cookies


def test_inactive_user_cannot_log_in(client):
    user = make_user(is_active=False)

    assert login(client, user).status_code == 401


def test_refresh_rotates_the_cookie_and_the_old_refresh_token_is_rejected(client):
    user = make_user()
    old_cookie = login(client, user).cookies['refresh'].value

    refreshed = client.post('/api/auth/refresh/')

    assert refreshed.status_code == 200
    assert AccessToken(refreshed.data['access'])['user_id'] == str(user.id)
    assert refreshed.data['user']['email'] == user.email
    assert refreshed.cookies['refresh'].value != old_cookie

    client.cookies['refresh'] = old_cookie
    reused = client.post('/api/auth/refresh/')
    assert reused.status_code == 401
    assert reused.data['code'] == 'session_expired'


def test_refresh_without_cookie_is_unauthorized(client):
    response = client.post('/api/auth/refresh/')
    assert response.status_code == 401
    assert response.data['code'] == 'no_session'


def test_refresh_is_rejected_once_the_user_is_deactivated(client):
    user = make_user()
    login(client, user)
    User.objects.filter(pk=user.pk).update(is_active=False)

    assert client.post('/api/auth/refresh/').status_code == 401


def test_logout_revokes_the_refresh_token_and_clears_the_cookie(client):
    user = make_user()
    cookie = login(client, user).cookies['refresh'].value

    response = client.post('/api/auth/logout/')

    assert response.status_code == 204
    assert response.cookies['refresh'].value == ''
    client.cookies['refresh'] = cookie
    assert client.post('/api/auth/refresh/').status_code == 401


def test_me_requires_an_access_token(client):
    user = make_user()
    access = login(client, user).data['access']

    assert client.get('/api/me/').status_code == 401
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {access}')
    assert client.get('/api/me/').data['email'] == user.email


def test_employee_session_spans_password_login_to_explicit_logout(client):
    employee = make_user(User.Role.EMPLOYEE)

    login(client, employee)
    client.post('/api/auth/refresh/')
    client.post('/api/auth/refresh/')

    session = EmployeeSession.objects.get(employee=employee)
    assert session.logout_at is None

    client.post('/api/auth/logout/')

    session.refresh_from_db()
    assert session.logout_at is not None
    assert EmployeeSession.objects.count() == 1


def test_customer_and_admin_logins_record_no_employee_session(client):
    login(client, make_user(User.Role.CUSTOMER))
    login(client, make_user(User.Role.ADMIN))

    assert EmployeeSession.objects.count() == 0
