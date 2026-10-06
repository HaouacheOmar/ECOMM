import pytest
from channels.testing import WebsocketCommunicator
from django.contrib.auth import authenticate
from django.core.cache import cache
from django.core.management import call_command

from config.asgi import application
from config.celery import ping


@pytest.mark.django_db
def test_api_docs_are_served(client):
    assert client.get('/api/schema/').status_code == 200
    assert client.get('/api/docs/').status_code == 200


@pytest.mark.django_db
def test_createsuperuser_creates_admin_logging_in_by_email(monkeypatch):
    monkeypatch.setenv('DJANGO_SUPERUSER_PASSWORD', 's3cret-pass!')
    call_command('createsuperuser', email='boss@eshop.test', interactive=False, verbosity=0)

    user = authenticate(email='boss@eshop.test', password='s3cret-pass!')
    assert user is not None
    assert user.role == 'ADMIN'


def test_celery_task_runs():
    assert ping.delay().get() == 'pong'


def test_redis_cache_round_trip():
    cache.set('smoke', 1)
    assert cache.get('smoke') == 1


async def test_websocket_from_foreign_origin_is_rejected():
    communicator = WebsocketCommunicator(application, '/ws/anything/', headers=[(b'origin', b'https://evil.example')])
    connected, _ = await communicator.connect()
    assert not connected
