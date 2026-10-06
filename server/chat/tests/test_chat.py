import threading

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.db import connection
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from chat.models import ChatMessage
from chat.service import RATE_LIMIT, Refused, send_message
from config.asgi import application
from config.sockets import FORBIDDEN

pytestmark = pytest.mark.django_db(transaction=True)


@database_sync_to_async
def make_user(email, role=User.Role.CUSTOMER, first_name=''):
    return User.objects.create_user(email, 'pw-123456', role=role, first_name=first_name)


async def chat_socket(user, expect_ready=True):
    socket = WebsocketCommunicator(application, '/ws/chat/', headers=[(b'origin', settings.FRONTEND_ORIGIN.encode())])
    assert (await socket.connect())[0]
    await socket.send_json_to({'type': 'auth', 'token': str(AccessToken.for_user(user))})
    if expect_ready:
        assert await socket.receive_json_from() == {'type': 'ready'}
    return socket


async def send(socket, body, client_id, to=None):
    await socket.send_json_to({'type': 'send', 'body': body, 'client_id': client_id, **({'to': str(to.pk)} if to else {})})


async def reply_to(socket, client_id):
    """The ack or error for client_id (skipping broadcast events)."""
    while True:
        event = await socket.receive_json_from(timeout=2)
        if event['type'] in ('ack', 'error') and event['client_id'] == client_id:
            return event


async def events_of(socket, kind, count=1):
    found = []
    while len(found) < count:
        event = await socket.receive_json_from(timeout=2)
        if event['type'] == kind:
            found.append(event)
    return found


def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


async def test_a_message_with_no_assigned_employee_lands_in_the_support_queue_for_all_employees():
    customer = await make_user('cust@eshop.test')
    amina, karim = await make_user('amina@eshop.test', User.Role.EMPLOYEE), await make_user('karim@eshop.test', User.Role.EMPLOYEE)
    desks = [await chat_socket(amina), await chat_socket(karim)]
    bubble = await chat_socket(customer)

    await send(bubble, 'Where is my order?', 'c-1')

    ack = await reply_to(bubble, 'c-1')
    assert ack['type'] == 'ack' and ack['message']['receiver'] is None
    for desk in desks:
        added, = await events_of(desk, 'queue.added')
        assert added['customer']['email'] == 'cust@eshop.test'
        message, = await events_of(desk, 'message')
        assert message['message']['body'] == 'Where is my order?'
    queue = await database_sync_to_async(lambda: api_get(amina, '/api/chat/queue/'))()
    assert [(c['email'], c['unread']) for c in queue] == [('cust@eshop.test', 1)]
    for s in [*desks, bubble]:
        await s.disconnect()


def api_get(user, url):
    return api(user).get(url).data


async def test_the_first_reply_claims_the_customer_and_a_second_is_rejected():
    customer = await make_user('cust@eshop.test')
    amina = await make_user('amina@eshop.test', User.Role.EMPLOYEE, 'Amina')
    karim = await make_user('karim@eshop.test', User.Role.EMPLOYEE, 'Karim')
    bubble, a, k = await chat_socket(customer), await chat_socket(amina), await chat_socket(karim)
    await send(bubble, 'Hello?', 'c-1')
    await reply_to(bubble, 'c-1')

    await send(a, 'Hi, Amina here.', 'a-1', to=customer)
    await send(k, 'Hi, Karim here.', 'k-1', to=customer)
    first, second = await reply_to(a, 'a-1'), await reply_to(k, 'k-1')

    assert first['type'] == 'ack'
    assert second == {'type': 'error', 'client_id': 'k-1', 'code': 'taken', 'detail': 'Already taken by Amina.'}
    removed, = await events_of(k, 'queue.removed')
    assert removed['by']['name'] == 'Amina'
    received = [e['message']['body'] for e in await events_of(bubble, 'message', 2)]
    assert received == ['Hello?', 'Hi, Amina here.']  # own message echoed to every tab, then the reply

    assigned = await database_sync_to_async(lambda: User.objects.get(pk=customer.pk))()
    assert assigned.assigned_employee_id == amina.pk and assigned.queued_at is None
    assert await database_sync_to_async(lambda: api_get(amina, '/api/chat/queue/'))() == []
    mine = await database_sync_to_async(lambda: api_get(amina, '/api/chat/customers/'))()
    assert [c['email'] for c in mine] == ['cust@eshop.test']
    for s in (bubble, a, k):
        await s.disconnect()


def test_simultaneous_replies_from_the_queue_only_one_claims():
    customer = User.objects.create_user('cust@eshop.test', 'x')
    employees = [User.objects.create_user(f'e{n}@eshop.test', 'x', role=User.Role.EMPLOYEE) for n in range(2)]
    send_message(customer, 'Help', 'c-1')
    start, outcomes = threading.Barrier(2), []

    def reply(employee):
        try:
            start.wait()
            send_message(employee, 'On it', 'r-1', to=str(customer.pk))
            outcomes.append('sent')
        except Refused as refused:
            outcomes.append(refused.code)
        finally:
            connection.close()

    threads = [threading.Thread(target=reply, args=(e,)) for e in employees]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    assert sorted(outcomes) == ['sent', 'taken']
    assert ChatMessage.objects.filter(sender__role=User.Role.EMPLOYEE).count() == 1


async def test_a_message_to_an_online_assigned_employee_goes_to_them_directly():
    amina = await make_user('amina@eshop.test', User.Role.EMPLOYEE)
    customer = await make_user('cust@eshop.test')
    await database_sync_to_async(User.objects.filter(pk=customer.pk).update)(assigned_employee=amina)
    bubble = await chat_socket(customer)

    # Assigned but Offline: the message waits in the Queue.
    await send(bubble, 'Anyone?', 'c-1')
    assert (await reply_to(bubble, 'c-1'))['message']['receiver'] is None

    desk = await chat_socket(amina)  # now Online
    await database_sync_to_async(User.objects.filter(pk=customer.pk).update)(queued_at=None)
    await send(bubble, 'Still there?', 'c-2')
    assert (await reply_to(bubble, 'c-2'))['message']['receiver'] == str(amina.pk)
    direct, = await events_of(desk, 'message')
    assert direct['message']['body'] == 'Still there?'
    await bubble.disconnect()
    await desk.disconnect()


async def test_a_resent_message_with_the_same_client_id_is_stored_once():
    customer = await make_user('cust@eshop.test')
    bubble = await chat_socket(customer)

    await send(bubble, 'Hello', 'same-id')
    first = await reply_to(bubble, 'same-id')
    await send(bubble, 'Hello', 'same-id')  # e.g. resent after a reconnect before the ack arrived
    again = await reply_to(bubble, 'same-id')

    assert first['type'] == again['type'] == 'ack'
    assert first['message']['id'] == again['message']['id']
    assert await database_sync_to_async(ChatMessage.objects.count)() == 1
    await bubble.disconnect()


async def test_exceeding_the_rate_limit_is_refused():
    customer = await make_user('cust@eshop.test')
    bubble = await chat_socket(customer)
    for n in range(RATE_LIMIT):
        await send(bubble, f'msg {n}', f'id-{n}')
        assert (await reply_to(bubble, f'id-{n}'))['type'] == 'ack'

    await send(bubble, 'one too many', 'id-over')

    refused = await reply_to(bubble, 'id-over')
    assert refused['type'] == 'error' and refused['code'] == 'rate_limited'
    assert await database_sync_to_async(ChatMessage.objects.count)() == RATE_LIMIT
    await bubble.disconnect()


@pytest.mark.parametrize('body,client_id', [('   ', 'x'), ('x' * 1001, 'y'), ('fine', ''), ('fine', None)])
async def test_invalid_messages_are_refused(body, client_id):
    customer = await make_user('cust@eshop.test')
    bubble = await chat_socket(customer)
    await send(bubble, body, client_id)
    refused = await reply_to(bubble, client_id)
    assert refused['type'] == 'error' and refused['code'] == 'invalid'
    await bubble.disconnect()


async def test_employees_only_message_customers_queued_or_assigned_to_them():
    amina = await make_user('amina@eshop.test', User.Role.EMPLOYEE, 'Amina')
    karim = await make_user('karim@eshop.test', User.Role.EMPLOYEE)
    quiet = await make_user('quiet@eshop.test')  # never wrote in
    theirs = await make_user('theirs@eshop.test')
    await database_sync_to_async(User.objects.filter(pk=theirs.pk).update)(assigned_employee=amina)
    desk = await chat_socket(karim)

    await send(desk, 'Hello!', 'k-1', to=quiet)
    assert (await reply_to(desk, 'k-1'))['code'] == 'taken'
    await send(desk, 'Hello!', 'k-2', to=theirs)
    assert (await reply_to(desk, 'k-2'))['detail'] == 'Already taken by Amina.'
    await send(desk, 'Hello!', 'k-3', to=karim)  # not a Customer
    assert (await reply_to(desk, 'k-3'))['code'] == 'invalid'
    await desk.disconnect()


async def test_the_admin_cannot_use_the_chat():
    admin = await make_user('admin@eshop.test', User.Role.ADMIN)
    socket = await chat_socket(admin, expect_ready=False)
    assert await socket.receive_output(2) == {'type': 'websocket.close', 'code': FORBIDDEN}


def test_history_is_the_customers_whole_conversation_and_reading_marks_it():
    customer = User.objects.create_user('cust@eshop.test', 'x')
    other = User.objects.create_user('other@eshop.test', 'x')
    amina = User.objects.create_user('amina@eshop.test', 'x', role=User.Role.EMPLOYEE)
    karim = User.objects.create_user('karim@eshop.test', 'x', role=User.Role.EMPLOYEE)
    send_message(customer, 'First', 'c-1')
    send_message(amina, 'Amina here', 'a-1', to=str(customer.pk))
    User.objects.filter(pk=customer.pk).update(assigned_employee=None, queued_at=None)
    send_message(customer, 'Back again', 'c-2')
    send_message(karim, 'Karim here', 'k-1', to=str(customer.pk))
    send_message(other, 'Not yours', 'o-1')

    mine = api(customer).get('/api/chat/messages/').data
    assert [m['body'] for m in mine['results']] == ['Karim here', 'Back again', 'Amina here', 'First']
    as_karim = api(karim).get(f'/api/chat/messages/?customer={customer.pk}').data
    assert len(as_karim['results']) == 4  # the full history across Employees
    assert api(karim).get('/api/chat/messages/').status_code == 400  # an Employee names the Customer

    assert api(customer).post('/api/chat/read/').status_code == 204
    assert not ChatMessage.objects.filter(customer=customer, sender__role=User.Role.EMPLOYEE, is_read=False).exists()
    assert ChatMessage.objects.filter(customer=customer, sender=customer, is_read=False).count() == 2
    api(karim).post('/api/chat/read/', {'customer': str(customer.pk)}, format='json')
    assert not ChatMessage.objects.filter(customer=customer, is_read=False).exists()


@pytest.mark.parametrize('url', ['/api/chat/queue/', '/api/chat/customers/'])
def test_queue_lists_are_for_employees(url):
    assert api(User.objects.create_user('c@eshop.test', 'x')).get(url).status_code == 403
    assert api(User.objects.create_user('a@eshop.test', 'x', role=User.Role.ADMIN)).get(url).status_code == 403
