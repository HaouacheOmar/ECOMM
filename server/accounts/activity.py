"""/ws/activity/: the Admin's live view of staff. Pushes Employee presence (Online/Offline) and
Employee Session starts and ends; the page refetches the details over REST."""

import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer

from config.sockets import AuthenticatedConsumer

from .models import User

ADMINS = 'activity.admins'
log = logging.getLogger(__name__)


def employee_data(employee):
    return {'id': str(employee.pk), 'email': employee.email, 'name': employee.get_full_name() or employee.email}


def notify(event):
    """event: {'type': 'presence', 'employee': ..., 'online': bool} or {'type': 'session', 'employee': ..., 'ended': bool}."""
    try:
        async_to_sync(get_channel_layer().group_send)(ADMINS, {'type': 'activity.event', 'event': event})
    except Exception:  # live view only; the Admin's page refetches on reconnect
        log.exception('Could not push activity %s', event['type'])


def session_changed(employee, ended):
    notify({'type': 'session', 'employee': employee_data(employee), 'ended': ended})


class ActivityConsumer(AuthenticatedConsumer):
    def allowed(self, user):
        return user.role == User.Role.ADMIN

    def groups_for(self, user):
        return [ADMINS]

    async def activity_event(self, event):
        await self.send_json(event['event'])
