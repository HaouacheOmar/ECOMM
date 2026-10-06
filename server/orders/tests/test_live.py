from datetime import timedelta
from decimal import Decimal

import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User
from config import sockets
from config.asgi import application
from orders.models import PickupPoint
from products.models import Category, Product

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.asyncio]


def make_user(email, role=User.Role.CUSTOMER):
    return User.objects.create_user(email, 'pw-123456', role=role, is_email_verified=True)


async def connect(token=None, send_auth=True):
    socket = WebsocketCommunicator(application, '/ws/orders/', headers=[(b'origin', settings.FRONTEND_ORIGIN.encode())])
    connected, _ = await socket.connect()
    assert connected
    if send_auth:
        await socket.send_json_to({'type': 'auth', 'token': token})
    return socket


async def authed(user):
    socket = await connect(str(AccessToken.for_user(user)))
    assert await socket.receive_json_from() == {'type': 'ready'}
    return socket


async def closed_with(socket, code=sockets.UNAUTHORIZED, timeout=2):
    assert await socket.receive_output(timeout) == {'type': 'websocket.close', 'code': code}


@database_sync_to_async
def shop():
    kitchen = Category.objects.create(name='Kitchen')
    mug = Product.objects.create(category=kitchen, name='Mug', price=Decimal('1200'), stock=5)
    point = PickupPoint.objects.create(name='Hydra office', city='Algiers', address='12 Rue Didouche')
    return mug, point


@database_sync_to_async
def place_order(customer, mug, point):
    client = APIClient()
    client.force_authenticate(customer)
    client.post('/api/cart/items/', {'product': str(mug.id), 'quantity': 1}, format='json')
    return client.post('/api/orders/', {'delivery_method': 'PICKUP_POINT', 'pickup_point': str(point.id)}, format='json').data


@database_sync_to_async
def ship(order_id):
    client = APIClient()
    client.force_authenticate(User.objects.get(role=User.Role.EMPLOYEE))
    return client.post(f'/api/orders/{order_id}/ship/').data


async def test_a_socket_that_never_authenticates_is_closed_with_4001(monkeypatch):
    monkeypatch.setattr(sockets, 'AUTH_TIMEOUT', 0.2)
    socket = await connect(send_auth=False)
    await closed_with(socket)


@pytest.mark.parametrize('message', [
    {'type': 'auth', 'token': 'not-a-jwt'},
    {'type': 'auth'},                       # no token (must not mint one)
    {'type': 'hello', 'token': 'x'},
])
async def test_an_invalid_first_message_is_closed_with_4001(message):
    socket = await connect(send_auth=False)
    await socket.send_json_to(message)
    await closed_with(socket)


async def test_a_deactivated_users_token_is_refused():
    user = await database_sync_to_async(make_user)('gone@eshop.test', User.Role.EMPLOYEE)
    token = str(AccessToken.for_user(user))
    await database_sync_to_async(User.objects.filter(pk=user.pk).update)(is_active=False)
    socket = await connect(token)
    await closed_with(socket)


async def test_the_socket_closes_when_the_token_expires():
    user = await database_sync_to_async(make_user)('emp@eshop.test', User.Role.EMPLOYEE)
    token = AccessToken.for_user(user)
    token.set_exp(lifetime=timedelta(seconds=1))
    socket = await connect(str(token))
    assert await socket.receive_json_from() == {'type': 'ready'}
    await closed_with(socket, timeout=3)


async def test_new_orders_reach_staff_and_their_customer_only():
    mug, point = await shop()
    employee = await database_sync_to_async(make_user)('emp@eshop.test', User.Role.EMPLOYEE)
    admin = await database_sync_to_async(make_user)('admin@eshop.test', User.Role.ADMIN)
    buyer = await database_sync_to_async(make_user)('buyer@eshop.test')
    bystander = await database_sync_to_async(make_user)('other@eshop.test')
    staff_sockets = [await authed(employee), await authed(admin)]
    buyer_socket, bystander_socket = await authed(buyer), await authed(bystander)

    order = await place_order(buyer, mug, point)

    for socket in [*staff_sockets, buyer_socket]:
        event = await socket.receive_json_from()
        assert event['type'] == 'order.created'
        assert event['order']['id'] == order['id'] and event['order']['status'] == 'CONFIRMED'
    # A Customer is never in the staff group, so other people's Orders don't reach them.
    assert await bystander_socket.receive_nothing(timeout=0.3)
    for socket in [*staff_sockets, buyer_socket, bystander_socket]:
        await socket.disconnect()


async def test_shipping_updates_the_customer_live():
    mug, point = await shop()
    await database_sync_to_async(make_user)('emp@eshop.test', User.Role.EMPLOYEE)
    buyer = await database_sync_to_async(make_user)('buyer@eshop.test')
    order = await place_order(buyer, mug, point)
    socket = await authed(buyer)

    await ship(order['id'])

    event = await socket.receive_json_from()
    assert (event['type'], event['order']['id'], event['order']['status']) == ('order.updated', order['id'], 'SHIPPED')
    await socket.disconnect()
