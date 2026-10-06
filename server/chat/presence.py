"""Online: an Employee with at least one open chat socket, tracked as a Redis set of connections."""

from functools import cache

import redis
from django.conf import settings


@cache
def _client(url):
    return redis.Redis.from_url(url)


def _redis():
    # The cache's Redis (its own DB in tests, flushed after each one).
    return _client(settings.CACHES['default']['LOCATION'])


def _key(user_id):
    return f'chat:online:{user_id}'


# ponytail: a crashed server leaves its connections in the set, so that Employee looks Online until
# they reconnect and leave; the presence ticket adds the Offline grace period and its cleanup.
def connected(user_id, channel):
    _redis().sadd(_key(user_id), channel)


def disconnected(user_id, channel):
    _redis().srem(_key(user_id), channel)


def is_online(user_id):
    return _redis().scard(_key(user_id)) > 0
