import asyncio

from channels.db import database_sync_to_async

from accounts.models import User
from config.sockets import AuthenticatedConsumer

from . import presence
from .service import EMPLOYEES, Refused, message_data, presence_changed, send_message, user_group

# Grace-period checks outlive their (closed) consumer; keep references so they aren't collected.
_checks = set()


class ChatConsumer(AuthenticatedConsumer):
    """/ws/chat/: Customers and Employees send Chat Messages ({type: send, client_id, body, to?}) and
    receive messages and Support Queue changes. Each send is answered with an ack (or an error)
    carrying its client_id, so the browser can resend whatever wasn't acknowledged."""

    def allowed(self, user):
        return user.role in (User.Role.CUSTOMER, User.Role.EMPLOYEE)

    def groups_for(self, user):
        return [user_group(user.pk)] + ([EMPLOYEES] if user.role == User.Role.EMPLOYEE else [])

    async def on_authenticated(self):
        if self.user.role == User.Role.EMPLOYEE and await database_sync_to_async(presence.connected)(self.user.pk, self.channel_name):
            await database_sync_to_async(presence_changed)(self.user, online=True)

    async def handle(self, content):
        client_id = content.get('client_id')
        if content.get('type') != 'send':
            return await self.send_json({'type': 'error', 'client_id': client_id, 'code': 'invalid', 'detail': 'Unknown message type.'})
        try:
            message, _ = await database_sync_to_async(send_message)(self.user, content.get('body'), client_id, content.get('to'))
        except Refused as refused:
            return await self.send_json({'type': 'error', 'client_id': client_id, 'code': refused.code, 'detail': refused.detail})
        await self.send_json({'type': 'ack', 'client_id': client_id, 'message': await database_sync_to_async(message_data)(message)})

    async def chat_event(self, event):
        await self.send_json(event['event'])

    async def disconnect(self, code):
        if self.user is not None and self.user.role == User.Role.EMPLOYEE:
            if await database_sync_to_async(presence.disconnected)(self.user.pk, self.channel_name):
                check = asyncio.create_task(offline_after_grace(self.user))
                _checks.add(check)
                check.add_done_callback(_checks.discard)
        await super().disconnect(code)


async def offline_after_grace(employee):
    """No connection left: unless they reconnect within the grace period, they go Offline."""
    await asyncio.sleep(presence.GRACE)
    if await database_sync_to_async(presence.went_offline_if_idle)(employee.pk):
        await database_sync_to_async(presence_changed)(employee, online=False)
