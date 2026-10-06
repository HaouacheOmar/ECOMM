"""
ASGI entrypoint: Django for HTTP, Channels for WebSockets.
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import OriginValidator  # noqa: E402
from django.conf import settings  # noqa: E402
from django.urls import path  # noqa: E402

from orders.live import OrdersConsumer  # noqa: E402

websocket_urlpatterns = [
    path('ws/orders/', OrdersConsumer.as_asgi()),
]

application = ProtocolTypeRouter({
    'http': django_asgi_app,
    'websocket': OriginValidator(URLRouter(websocket_urlpatterns), [settings.FRONTEND_ORIGIN]),
})
