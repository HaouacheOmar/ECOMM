import asyncio

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from chat import presence
from chat.service import send_message
from config.asgi import application
from config.sockets import FORBIDDEN, UNAUTHORIZED

pytestmark = pytest.mark.django_db(transaction=True)

GRACE = 0.4


@pytest.fixture(autouse=True)
def short_grace(monkeypatch):
    monkeypatch.setattr(presence, 'GRACE', GRACE)


@database_sync_to_async
def make_user(email, role=User.Role.CUSTOMER, **extra):
    return User.objects.create_user(email, 'pw-123456', role=role, **extra)


async def open_socket(path, user, expect_ready=True):
    socket = WebsocketCommunicator(application, path, headers=[(b'origin', settings.FRONTEND_ORIGIN.encode())])
    assert (await socket.connect())[0]
    await socket.send_json_to({'type': 'auth', 'token': str(AccessToken.for_user(user))})
    if expect_ready:
        assert await socket.receive_json_from() == {'type': 'ready'}
    return socket


async def next_of(socket, kind, timeout=2):
    while True:
        event = await socket.receive_json_from(timeout=timeout)
        if event['type'] == kind:
            return event


async def customer_writes(customer, body, client_id):
    message, _ = await database_sync_to_async(send_message)(customer, body, client_id)
    return message


@database_sync_to_async
def queued_at(customer):
    return User.objects.get(pk=customer.pk).queued_at


async def assigned_pair():
    amina = await make_user('amina@eshop.test', User.Role.EMPLOYEE, first_name='Amina')
    customer = await make_user('cust@eshop.test', assigned_employee=amina)
    return amina, customer


async def test_a_brief_reconnect_within_the_grace_period_keeps_the_employee_online():
    amina, customer = await assigned_pair()
    admin = await make_user('admin@eshop.test', User.Role.ADMIN)
    activity = await open_socket('/ws/activity/', admin)
    desk = await open_socket('/ws/chat/', amina)
    assert (await next_of(activity, 'presence'))['online'] is True

    await desk.disconnect()  # e.g. a token refresh or page reload
    desk = await open_socket('/ws/chat/', amina)
    await asyncio.sleep(GRACE * 2)

    assert await database_sync_to_async(presence.is_online)(amina.pk)
    assert await activity.receive_nothing(timeout=0.2)  # no Offline (and no second Online)
    message = await customer_writes(customer, 'Still there?', 'c-1')
    assert message.receiver_id == amina.pk
    await desk.disconnect()
    await activity.disconnect()


async def test_closing_the_last_connection_requeues_unanswered_customers_after_the_grace_period():
    amina, waiting = await assigned_pair()
    answered = await make_user('answered@eshop.test', assigned_employee=amina)
    karim = await make_user('karim@eshop.test', User.Role.EMPLOYEE)
    admin = await make_user('admin@eshop.test', User.Role.ADMIN)
    desk = await open_socket('/ws/chat/', amina)
    other_desk = await open_socket('/ws/chat/', karim)
    activity = await open_socket('/ws/activity/', admin)

    await customer_writes(waiting, 'Hello?', 'w-1')  # Amina never answers this one
    await customer_writes(answered, 'Thanks', 'a-1')
    await database_sync_to_async(send_message)(amina, 'You are welcome!', 'amina-1', str(answered.pk))

    await desk.disconnect()
    await asyncio.sleep(GRACE / 3)
    assert await queued_at(waiting) is None  # still within the grace period

    added = await next_of(other_desk, 'queue.added', timeout=GRACE * 4)
    assert added['customer']['email'] == 'cust@eshop.test'
    assert await queued_at(waiting) is not None
    assert await queued_at(answered) is None
    offline = await next_of(activity, 'presence')
    assert (offline['employee']['name'], offline['online']) == ('Amina', False)

    # Messages to an Offline Assigned Employee go to the Queue.
    message = await customer_writes(answered, 'One more thing', 'a-2')
    assert message.receiver_id is None
    await other_desk.disconnect()
    await activity.disconnect()


@database_sync_to_async
def api_as(user, method, url):
    client = APIClient()
    client.force_authenticate(user)
    return getattr(client, method)(url)


async def test_the_admin_sees_sessions_and_presence_live():
    admin = await make_user('admin@eshop.test', User.Role.ADMIN)
    amina = await make_user('amina@eshop.test', User.Role.EMPLOYEE)
    await database_sync_to_async(lambda: amina.set_password('Desk-pass-2026') or amina.save())()
    activity = await open_socket('/ws/activity/', admin)

    client = APIClient()
    await database_sync_to_async(client.post)('/api/auth/login/', {'email': 'amina@eshop.test', 'password': 'Desk-pass-2026'}, format='json')
    started = await next_of(activity, 'session')
    assert (started['employee']['email'], started['ended']) == ('amina@eshop.test', False)

    desk = await open_socket('/ws/chat/', amina)
    assert (await next_of(activity, 'presence'))['online'] is True
    employees = (await api_as(admin, 'get', '/api/employees/')).data['results']
    assert employees[0]['is_online'] is True

    await database_sync_to_async(client.post)('/api/auth/logout/')
    assert (await next_of(activity, 'session'))['ended'] is True
    await desk.disconnect()
    await activity.disconnect()


async def test_deactivating_an_employee_cuts_off_their_open_desk_immediately():
    amina, customer = await assigned_pair()
    admin = await make_user('admin@eshop.test', User.Role.ADMIN)
    chat = await open_socket('/ws/chat/', amina)
    orders = await open_socket('/ws/orders/', amina)
    await customer_writes(customer, 'Hello?', 'c-1')

    await api_as(admin, 'post', f'/api/employees/{amina.pk}/deactivate/')

    for socket in (chat, orders):
        while (output := await socket.receive_output(2))['type'] != 'websocket.close':
            pass
        assert output['code'] == UNAUTHORIZED
    assert not await database_sync_to_async(presence.is_online)(amina.pk)
    refreshed = await database_sync_to_async(User.objects.get)(pk=customer.pk)
    assert refreshed.queued_at is not None and refreshed.assigned_employee_id is None


async def test_only_the_admin_watches_activity():
    amina = await make_user('amina@eshop.test', User.Role.EMPLOYEE)
    socket = await open_socket('/ws/activity/', amina, expect_ready=False)
    assert await socket.receive_output(2) == {'type': 'websocket.close', 'code': FORBIDDEN}
