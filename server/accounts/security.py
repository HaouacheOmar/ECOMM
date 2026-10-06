"""Locking a user's other sessions out: after a password change or reset, and on deactivation."""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import serializers
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from config.sockets import close_all_sockets

from .activity import session_changed
from .models import EmployeeSession


def check_password(password, user):
    """Django's password validators, reported as a DRF field error."""
    try:
        validate_password(password, user)
    except DjangoValidationError as error:
        raise serializers.ValidationError({'password': list(error.messages)})


def end_sessions(user):
    """Close the open Employee Session and revoke every refresh token, so no tab can stay signed in."""
    if EmployeeSession.objects.filter(employee=user, logout_at=None).update(logout_at=timezone.now()):
        session_changed(user, ended=True)
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


def sign_out_everywhere(user):
    """end_sessions, plus closing their open sockets (each tab then fails to refresh and signs out)."""
    end_sessions(user)
    close_all_sockets(user.pk)
