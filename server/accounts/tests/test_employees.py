import pytest
from rest_framework.test import APIClient

from accounts.models import EmployeeSession, User

pytestmark = pytest.mark.django_db

PASSWORD = 'Desk-pass-2026'


@pytest.fixture
def admin():
    client = APIClient()
    client.force_authenticate(User.objects.create_user('admin@eshop.test', 'x', role=User.Role.ADMIN))
    return client


def create_employee(admin, email='amina@eshop.test', password=PASSWORD):
    return admin.post('/api/employees/', {'email': email, 'first_name': 'Amina', 'last_name': 'Benali', 'password': password}, format='json')


def login(email, password=PASSWORD):
    client = APIClient()
    return client, client.post('/api/auth/login/', {'email': email, 'password': password}, format='json')


def test_admin_creates_an_employee_who_can_log_in(admin):
    created = create_employee(admin)

    assert created.status_code == 201
    assert created.data['email'] == 'amina@eshop.test' and created.data['is_active'] is True
    assert 'password' not in created.data
    _, response = login('amina@eshop.test')
    assert response.status_code == 200
    assert response.data['user']['role'] == 'EMPLOYEE'
    assert [e['email'] for e in admin.get('/api/employees/').data['results']] == ['amina@eshop.test']


def test_employee_creation_validates_email_and_password(admin):
    create_employee(admin)
    assert create_employee(admin, 'AMINA@eshop.test').data['email'] == ['An account with this email already exists.']
    assert 'password' in create_employee(admin, 'weak@eshop.test', password='123').data


def test_admin_renames_and_sets_a_new_password(admin):
    employee = create_employee(admin).data['id']

    renamed = admin.patch(f'/api/employees/{employee}/', {'first_name': 'Amina S.', 'email': 'hijack@eshop.test'}, format='json')
    assert renamed.data['first_name'] == 'Amina S.' and renamed.data['email'] == 'amina@eshop.test'

    assert 'password' in admin.post(f'/api/employees/{employee}/set-password/', {'password': 'short'}, format='json').data
    assert admin.post(f'/api/employees/{employee}/set-password/', {'password': 'Brand-new-pass-77'}, format='json').status_code == 204
    assert login('amina@eshop.test')[1].status_code == 401
    assert login('amina@eshop.test', 'Brand-new-pass-77')[1].status_code == 200


def test_deactivation_ends_the_session_and_locks_the_employee_out(admin):
    employee = create_employee(admin).data['id']
    desk, response = login('amina@eshop.test')
    desk.credentials(HTTP_AUTHORIZATION=f'Bearer {response.data["access"]}')
    customer = User.objects.create_user('c@eshop.test', 'x', assigned_employee_id=employee)

    assert admin.post(f'/api/employees/{employee}/deactivate/').data['is_active'] is False

    assert desk.post('/api/auth/refresh/').status_code == 401
    assert desk.get('/api/me/').status_code == 401  # the still-unexpired access token is refused too
    assert login('amina@eshop.test')[1].status_code == 401
    assert EmployeeSession.objects.get(employee_id=employee).logout_at is not None
    customer.refresh_from_db()
    assert customer.assigned_employee is None

    assert admin.post(f'/api/employees/{employee}/reactivate/').data['is_active'] is True
    assert login('amina@eshop.test')[1].status_code == 200


def test_activity_log_shows_session_start_and_end(admin):
    employee = create_employee(admin).data['id']
    first, _ = login('amina@eshop.test')
    first.post('/api/auth/logout/')
    login('amina@eshop.test')  # still open

    sessions = admin.get('/api/employee-sessions/').data['results']

    assert [s['employee']['name'] for s in sessions] == ['Amina Benali', 'Amina Benali']
    open_session, closed = sessions
    assert open_session['logout_at'] is None
    assert closed['logout_at'] > closed['login_at']
    assert admin.get(f'/api/employee-sessions/?employee={employee}').data['count'] == 2
    assert admin.get('/api/employee-sessions/?employee=not-a-uuid').status_code == 400


@pytest.mark.parametrize('role', [User.Role.EMPLOYEE, User.Role.CUSTOMER])
def test_only_the_admin_manages_employees(role):
    client = APIClient()
    client.force_authenticate(User.objects.create_user(f'{role.lower()}@eshop.test', 'x', role=role))
    assert client.get('/api/employees/').status_code == 403
    assert client.post('/api/employees/', {}, format='json').status_code == 403
    assert client.get('/api/employee-sessions/').status_code == 403


def test_employees_endpoint_never_touches_other_roles(admin):
    customer = User.objects.create_user('c@eshop.test', 'x')
    assert admin.post(f'/api/employees/{customer.id}/deactivate/').status_code == 404
