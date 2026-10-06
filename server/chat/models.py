import uuid

from django.conf import settings
from django.db import models

MAX_BODY = 1000


class ChatMessage(models.Model):
    """Sent from one person to another, between a Customer and an Employee. A Customer message with
    no Online Assigned Employee has no receiver: it waits in the Support Queue."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='+')
    receiver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='+')
    # The Customer whose single, continuous history this message belongs to (sender or receiver).
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chat_messages')
    body = models.TextField(max_length=MAX_BODY)
    is_read = models.BooleanField(default=False)
    client_id = models.CharField(max_length=64)  # chosen by the sender's browser; makes resends harmless
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.UniqueConstraint(fields=['sender', 'client_id'], name='one_message_per_client_id')]
        indexes = [models.Index(fields=['customer', '-created_at'])]
