"""Live Order events: `/ws/orders/` pushes new Orders and status changes to staff, and each
Customer's own Order changes to that Customer."""

import json
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.renderers import JSONRenderer

from accounts.permissions import is_staff_member
from config.sockets import AuthenticatedConsumer

STAFF = 'orders.staff'
log = logging.getLogger(__name__)


def customer_group(customer_id):
    return f'orders.customer.{customer_id}'


def broadcast(kind, order, customer_id):
    """kind: 'order.created' or 'order.updated'; order: the serialized Order (as the REST API returns it)."""
    message = {'type': 'order.event', 'kind': kind, 'order': json.loads(JSONRenderer().render(order))}
    send = async_to_sync(get_channel_layer().group_send)
    try:
        send(STAFF, message)
        send(customer_group(customer_id), message)
    except Exception:  # the Order is committed; a missed push is caught up by the client's refetch on reconnect
        log.exception('Could not push %s for order %s', kind, order['id'])


class OrdersConsumer(AuthenticatedConsumer):
    def groups_for(self, user):
        return [STAFF] if is_staff_member(user) else [customer_group(user.pk)]

    async def order_event(self, event):
        await self.send_json({'type': event['kind'], 'order': event['order']})
