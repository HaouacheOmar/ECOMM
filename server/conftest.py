import pytest
from django.core.cache import cache

from config.celery import app as celery_app

# Celery tasks run inline in tests.
celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True


@pytest.fixture(autouse=True)
def _isolated_infra(settings):
    """In-memory channel layer; Redis cache on a separate DB, flushed after each test."""
    settings.CHANNEL_LAYERS = {'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}}
    settings.CACHES = {'default': {
        'BACKEND': 'django.core.cache.backends.redis.RedisCache',
        'LOCATION': settings.REDIS_URL.rsplit('/', 1)[0] + '/15',
    }}
    yield
    cache.clear()
