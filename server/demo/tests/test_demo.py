import pytest
from channels.db import database_sync_to_async
from channels.testing import WebsocketCommunicator
from django.conf import settings
from django.core.management import call_command
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import EmployeeSession, User
from chat.models import ChatMessage
from config.asgi import application
from demo.seed import DEMO_LOGINS
from demo.tasks import simulate_activity
from orders.models import Order, PickupPoint
from products.models import Product, Review

pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def media(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path  # the seeded photos


def snapshot():
    """What the demo shop contains, independent of ids and timestamps."""
    return {
        'people': sorted(User.objects.filter(email__endswith='@demo.eshop.dz').values_list('email', 'role', 'is_active')),
        'products': sorted(Product.objects.values_list('name', 'stock', 'is_archived', 'rating_avg', 'review_count')),
        'photos': Product.objects.filter(images__isnull=False).count(),
        'points': sorted(PickupPoint.objects.values_list('name', flat=True)),
        'orders': sorted(Order.objects.values_list('customer__email', 'status', 'total_amount')),
        'reviews': sorted(Review.objects.values_list('customer__email', 'product__name', 'rating')),
        'messages': sorted(ChatMessage.objects.values_list('customer__email', 'body')),
        'sessions': EmployeeSession.objects.count(),
        'queue': sorted(User.objects.filter(queued_at__isnull=False).values_list('email', flat=True)),
    }


def as_user(email):
    client = APIClient()
    client.force_authenticate(User.objects.get(email=email))
    return client


def test_the_seeded_shop_has_the_planned_content():
    call_command('seed_demo')
    shop = snapshot()

    assert [r for e, r, _ in shop['people']].count('CUSTOMER') == 15
    assert ('yacine@demo.eshop.dz', 'EMPLOYEE', False) in shop['people']  # one deactivated Employee
    assert len(shop['products']) == 30 and shop['photos'] == 30
    assert sum(1 for p in shop['products'] if p[2]) == 1  # one archived
    assert sum(1 for p in shop['products'] if p[1] == 0) >= 3  # some Out of stock
    assert {p.split()[0] for p in shop['points']} >= {'Hydra', 'Oran', 'Constantine', 'Annaba'}
    assert len(shop['orders']) == 120
    assert {s for _, s, _ in shop['orders']} == {'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED'}
    assert len(shop['reviews']) == 150
    assert shop['queue'] == ['walid@demo.eshop.dz']


def test_seeding_twice_creates_no_duplicates():
    call_command('seed_demo')
    first = snapshot()
    call_command('seed_demo')
    assert snapshot() == first


def test_reset_restores_the_initial_state():
    call_command('seed_demo')
    initial = snapshot()
    Order.objects.first().delete()
    Product.objects.filter(name='Leather Tote').update(stock=0)
    User.objects.filter(email='sara@demo.eshop.dz').update(is_active=False)

    call_command('seed_demo', '--reset')

    assert snapshot() == initial


def test_bestsellers_recommendations_activity_log_and_queue_have_content_after_seeding():
    call_command('seed_demo')

    assert len(APIClient().get('/api/bestsellers/').data) == 8
    assert len(as_user('sara@demo.eshop.dz').get('/api/recommendations/').data) == 8
    assert as_user('admin@demo.eshop.dz').get('/api/employee-sessions/').data['count'] > 10
    queue = as_user('amina@demo.eshop.dz').get('/api/chat/queue/').data
    assert [c['email'] for c in queue] == ['walid@demo.eshop.dz']
    assert as_user('amina@demo.eshop.dz').get('/api/chat/customers/').data  # her Customers, one unread


@pytest.mark.parametrize('demo_mode', [False, True])
def test_try_as_logins_exist_only_in_demo_mode(settings, demo_mode):
    settings.DEMO_MODE = demo_mode
    call_command('seed_demo')
    client = APIClient()

    assert client.get('/api/demo/').data == {'enabled': demo_mode}
    for role, email in DEMO_LOGINS.items():
        response = client.post('/api/demo/login/', {'role': role}, format='json')
        if demo_mode:
            assert response.status_code == 200 and response.data['user']['email'] == email
        else:
            assert response.status_code == 404


def test_try_as_explains_when_the_demo_was_not_seeded(settings):
    settings.DEMO_MODE = True
    assert APIClient().post('/api/demo/login/', {'role': 'ADMIN'}, format='json').status_code == 503


def test_simulated_activity_does_nothing_without_demo_mode(settings):
    settings.DEMO_MODE = False
    call_command('seed_demo')
    orders = Order.objects.count()
    assert simulate_activity() is None
    assert Order.objects.count() == orders


async def watch(path, email):
    socket = WebsocketCommunicator(application, path, headers=[(b'origin', settings.FRONTEND_ORIGIN.encode())])
    assert (await socket.connect())[0]
    user = await database_sync_to_async(User.objects.get)(email=email)
    await socket.send_json_to({'type': 'auth', 'token': str(AccessToken.for_user(user))})
    assert await socket.receive_json_from() == {'type': 'ready'}
    return socket


async def next_of(socket, kinds):
    while True:
        event = await socket.receive_json_from(timeout=3)
        if event['type'] in kinds:
            return event


@pytest.mark.django_db(transaction=True)
async def test_in_demo_mode_simulated_orders_and_messages_appear_live_for_staff(settings):
    settings.DEMO_MODE = True
    await database_sync_to_async(call_command)('seed_demo')
    dashboard = await watch('/ws/orders/', 'admin@demo.eshop.dz')
    desk = await watch('/ws/chat/', 'amina@demo.eshop.dz')

    order = await database_sync_to_async(simulate_activity.delay)('order')
    created = await next_of(dashboard, {'order.created'})
    assert created['order']['status'] == 'CONFIRMED' and created['order']['customer'].endswith('@demo.eshop.dz')
    assert order.successful()

    await database_sync_to_async(simulate_activity.delay)('message')
    event = await next_of(desk, {'message', 'queue.added'})
    assert event['type'] in ('message', 'queue.added')
    await dashboard.disconnect()
    await desk.disconnect()
