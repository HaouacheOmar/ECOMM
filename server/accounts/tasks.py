from celery import shared_task
from django.core.mail import send_mail

from .models import User
from .verification import verification_link


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_verification_email(user_id):
    # Idempotent: an already-verified user gets nothing, so a retried task can't confuse anyone.
    user = User.objects.filter(pk=user_id, is_email_verified=False).first()
    if user is None:
        return
    send_mail(
        'Verify your E-Shop email',
        f'Welcome to E-Shop!\n\nConfirm your email to start ordering:\n{verification_link(user)}\n\n'
        'The link is valid for 3 days.',
        None,
        [user.email],
    )



@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_password_reset_email(user_id):
    from .passwords import reset_link  # avoids a circular import (passwords queues this task)

    user = User.objects.filter(pk=user_id, is_active=True).first()
    if user is None:
        return
    send_mail(
        'Reset your E-Shop password',
        f'Someone asked to reset the password for {user.email}.\n\n'
        f'Choose a new password here:\n{reset_link(user)}\n\n'
        "The link works once and expires in 1 hour. If this wasn't you, ignore this email.",
        None,
        [user.email],
    )
