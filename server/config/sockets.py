"""Shared WebSocket authentication: the first message carries the access token.

Browsers can't set headers on a WebSocket, and a token in the URL ends up in logs, so the client
sends {"type": "auth", "token": "<access token>"} right after connecting. Without a valid one
within AUTH_TIMEOUT seconds the socket is closed with 4001; it is closed with 4001 again when the
token expires, and the client refreshes its session and reconnects.
"""

import asyncio
import time

from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import User

AUTH_TIMEOUT = 5
UNAUTHORIZED = 4001
FORBIDDEN = 4003


@database_sync_to_async
def user_for(token):
    """The active user a raw access token belongs to, and when the token expires."""
    if not isinstance(token, str) or not token:  # AccessToken(None) would mint a fresh token
        return None, 0
    try:
        access = AccessToken(token)
    except TokenError:
        return None, 0
    return User.objects.filter(pk=access['user_id'], is_active=True).first(), access['exp']


class AuthenticatedConsumer(AsyncJsonWebsocketConsumer):
    """Subclasses say which groups a user joins (never chosen by the client) and handle events."""

    user = None
    joined = ()
    timer = None

    def groups_for(self, user):
        raise NotImplementedError

    def allowed(self, user):
        """Which roles may use this socket (others are closed with 4003)."""
        return True

    async def on_authenticated(self):
        """Runs once the user is known and has joined their groups."""

    async def connect(self):
        await self.accept()
        self.close_in(AUTH_TIMEOUT)

    def close_in(self, seconds):
        async def close_later():
            await asyncio.sleep(seconds)
            await self.close(code=UNAUTHORIZED)

        if self.timer:
            self.timer.cancel()
        self.timer = asyncio.create_task(close_later())

    async def receive_json(self, content, **kwargs):
        if self.user is not None:
            return await self.handle(content)
        user, expires = await user_for(content.get('token')) if content.get('type') == 'auth' else (None, 0)
        if user is None:
            return await self.close(code=UNAUTHORIZED)
        if not self.allowed(user):
            return await self.close(code=FORBIDDEN)
        self.user = user
        self.joined = self.groups_for(user)
        for group in self.joined:
            await self.channel_layer.group_add(group, self.channel_name)
        self.close_in(max(0, expires - time.time()))
        await self.on_authenticated()
        await self.send_json({'type': 'ready'})

    async def handle(self, content):
        """Messages after authentication; the orders socket only pushes, so it ignores them."""

    async def disconnect(self, code):
        if self.timer:
            self.timer.cancel()
        for group in self.joined:
            await self.channel_layer.group_discard(group, self.channel_name)
