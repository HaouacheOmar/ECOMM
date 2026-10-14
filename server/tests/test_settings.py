from channels_redis.core import RedisChannelLayer

from config import settings


def test_channel_layer_reads_outlast_its_blocking_receive():
    # The live layer (tests use an in-memory one): a read timeout at or under the layer's 5 s
    # BZPOPMIN wait crashes consumers before disconnect() runs, leaving Employees Online.
    host = settings.CHANNEL_LAYERS['default']['CONFIG']['hosts'][0]
    assert host['socket_timeout'] > RedisChannelLayer.brpop_timeout
