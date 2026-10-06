"""Sending a Chat Message: validation, permissions, rate limit, deduplication, routing and claiming.

A Customer's message goes to their Assigned Employee if that Employee is Online, otherwise to the
Support Queue (no receiver), and the Customer starts waiting there. An Employee may message a
Customer waiting in the Queue or assigned to them; the first reply to a waiting Customer claims
them with one conditional update, so of two simultaneous replies exactly one wins.
"""

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.activity import employee_data, notify
from accounts.models import User

from . import presence
from .models import MAX_BODY, ChatMessage

RATE_LIMIT = 20  # messages
RATE_WINDOW = 10  # seconds
EMPLOYEES = 'chat.employees'


def user_group(user_id):
    return f'chat.user.{user_id}'


class Refused(Exception):
    def __init__(self, code, detail):
        super().__init__(detail)
        self.code, self.detail = code, detail


def person(user):
    return {'id': str(user.pk), 'name': user.get_full_name() or user.email, 'role': user.role}


def message_data(message):
    return {
        'id': str(message.id),
        'client_id': message.client_id,
        'customer': str(message.customer_id),
        'sender': person(message.sender),
        'receiver': str(message.receiver_id) if message.receiver_id else None,
        'body': message.body,
        'is_read': message.is_read,
        'created_at': message.created_at.isoformat(),
    }


def customer_data(customer):
    return {'id': str(customer.pk), 'email': customer.email, 'name': customer.get_full_name() or customer.email,
            'queued_at': customer.queued_at.isoformat() if customer.queued_at else None}


def check_rate(user):
    key = f'chat:rate:{user.pk}'
    cache.add(key, 0, timeout=RATE_WINDOW)  # fixed window, starts with the first message
    if cache.incr(key) > RATE_LIMIT:
        raise Refused('rate_limited', f'Slow down: at most {RATE_LIMIT} messages every {RATE_WINDOW} seconds.')


def push(events):
    send = async_to_sync(get_channel_layer().group_send)
    for group, event in events:
        send(group, {'type': 'chat.event', 'event': event})


def send_message(sender, body, client_id, to=None):
    """Save (once per client_id) and deliver a message. Returns (message, created). Raises Refused."""
    if not isinstance(client_id, str) or not 0 < len(client_id) <= 64:
        raise Refused('invalid', 'A client_id is required.')
    existing = ChatMessage.objects.select_related('sender').filter(sender=sender, client_id=client_id).first()
    if existing:
        return existing, False  # a resend after reconnect: acknowledged again, delivered once
    body = body.strip() if isinstance(body, str) else ''
    if not body:
        raise Refused('invalid', 'Write a message first.')
    if len(body) > MAX_BODY:
        raise Refused('invalid', f'Messages are limited to {MAX_BODY} characters.')
    check_rate(sender)

    try:
        if sender.role == User.Role.CUSTOMER:
            message, events = from_customer(sender, body, client_id)
        elif sender.role == User.Role.EMPLOYEE:
            message, events = from_employee(sender, body, client_id, to)
        else:
            raise Refused('forbidden', 'Only Customers and Employees use the chat.')
    except IntegrityError:  # the same client_id arrived twice at once; the other copy was saved
        return ChatMessage.objects.select_related('sender').get(sender=sender, client_id=client_id), False
    push(events)
    return message, True


def from_customer(customer, body, client_id):
    with transaction.atomic():
        customer = User.objects.select_for_update().get(pk=customer.pk)
        assigned = customer.assigned_employee
        direct = assigned is not None and assigned.is_active and presence.is_online(assigned.pk)
        joined_queue = not direct and customer.queued_at is None
        if joined_queue:
            customer.queued_at = timezone.now()
            customer.save(update_fields=['queued_at'])
        message = ChatMessage.objects.create(
            sender=customer, receiver=assigned if direct else None, customer=customer, body=body, client_id=client_id)

    data = message_data(message)
    events = [(user_group(customer.pk), {'type': 'message', 'message': data})]
    if direct:
        events.append((user_group(assigned.pk), {'type': 'message', 'message': data}))
    else:
        if joined_queue:
            events.append((EMPLOYEES, {'type': 'queue.added', 'customer': customer_data(customer)}))
        events.append((EMPLOYEES, {'type': 'message', 'message': data}))
    return message, events


def from_employee(employee, body, client_id, to):
    customer = User.objects.filter(pk=to, role=User.Role.CUSTOMER).first() if isinstance(to, str) else None
    if customer is None:
        raise Refused('invalid', 'Choose a Customer to reply to.')

    with transaction.atomic():
        claimed = User.objects.filter(pk=customer.pk, queued_at__isnull=False).update(queued_at=None, assigned_employee=employee)
        customer.refresh_from_db()
        if not claimed and customer.assigned_employee_id != employee.pk:
            taken_by = customer.assigned_employee
            raise Refused('taken', f'Already taken by {taken_by.get_full_name() or taken_by.email}.' if taken_by
                          else 'This Customer is not waiting for support.')
        if claimed:
            # The messages they sent while waiting were, in the end, for this Employee.
            ChatMessage.objects.filter(customer=customer, receiver=None).update(receiver=employee)
        message = ChatMessage.objects.create(
            sender=employee, receiver=customer, customer=customer, body=body, client_id=client_id)

    data = message_data(message)
    events = [
        (user_group(customer.pk), {'type': 'message', 'message': data}),
        (user_group(employee.pk), {'type': 'message', 'message': data}),
    ]
    if claimed:
        events.append((EMPLOYEES, {'type': 'queue.removed', 'customer': str(customer.pk), 'by': person(employee)}))
    return message, events


def presence_changed(employee, online):
    """Tell the Admin; on going Offline, Customers they left unanswered return to the Support Queue."""
    notify({'type': 'presence', 'employee': employee_data(employee), 'online': online})
    if not online:
        requeue_unanswered(employee)


def requeue_unanswered(employee):
    """Every Customer assigned to this Employee whose latest message is their own (not yet answered)
    starts waiting in the Support Queue again; any Employee can claim them by replying."""
    now = timezone.now()
    events = []
    for customer in User.objects.filter(assigned_employee=employee, queued_at__isnull=True):
        last = ChatMessage.objects.filter(customer=customer).only('sender_id').first()  # newest first
        if last and last.sender_id == customer.pk:
            User.objects.filter(pk=customer.pk, queued_at__isnull=True).update(queued_at=now)
            customer.queued_at = now
            events.append((EMPLOYEES, {'type': 'queue.added', 'customer': customer_data(customer)}))
    push(events)
