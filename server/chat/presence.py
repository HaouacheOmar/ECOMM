"""Online: an Employee connected to chat. Each open chat socket is a member of a Redis set; the
Employee is Online from their first connection until they have had none for GRACE seconds, so a
token refresh or a page reload doesn't bounce their Customers to the Support Queue.

Redis keys per Employee: `chat:conns:<id>` (open connections) and `chat:online:<id>` (the Online
flag). Going Offline is the one atomic delete of the flag, so it happens exactly once.
"""

from functools import cache

import redis
from django.conf import settings

GRACE = settings.CHAT_OFFLINE_GRACE  # seconds without any connection before an Employee is Offline


@cache
def _client(url):
    return redis.Redis.from_url(url)


def _redis():
    # The cache's Redis (its own DB in tests, flushed after each one).
    return _client(settings.CACHES['default']['LOCATION'])


def _conns(user_id):
    return f'chat:conns:{user_id}'


def _online(user_id):
    return f'chat:online:{user_id}'


_started = False


def _forget_previous_process(r):
    """A restarted server (deploy, crash, dev autoreload) has none of the old connections, but Redis
    still lists them; clear them before this process records its first one."""
    global _started
    if not _started:
        _started = True
        for key in r.scan_iter('chat:conns:*'):
            r.delete(key)
        for key in r.scan_iter('chat:online:*'):
            r.delete(key)


# ponytail: assumes one server process; with several, each would need its own connection set
# (keyed by process) and a heartbeat instead of this reset.
def connected(user_id, channel):
    """Returns True if this made them Online (they were Offline)."""
    r = _redis()
    _forget_previous_process(r)
    r.sadd(_conns(user_id), channel)
    return bool(r.set(_online(user_id), 1, nx=True))


def disconnected(user_id, channel):
    """Returns True if that was their last connection: check again after GRACE (went_offline_if_idle)."""
    r = _redis()
    r.srem(_conns(user_id), channel)
    return r.scard(_conns(user_id)) == 0


def went_offline_if_idle(user_id):
    """Called GRACE seconds after the last connection closed. Returns True if they went Offline now."""
    r = _redis()
    return r.scard(_conns(user_id)) == 0 and bool(r.delete(_online(user_id)))


def force_offline(user_id):
    """Deactivation: Offline now, without the grace period. Returns True if they were Online."""
    r = _redis()
    r.delete(_conns(user_id))
    return bool(r.delete(_online(user_id)))


def is_online(user_id):
    return bool(_redis().exists(_online(user_id)))
