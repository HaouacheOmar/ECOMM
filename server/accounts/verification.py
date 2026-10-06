from datetime import timedelta

from django.conf import settings
from django.core import signing

SALT = 'eshop.accounts.verify-email'
MAX_AGE = timedelta(days=3)


def make_token(user):
    # Signed with SECRET_KEY and timestamped; binding the email means a changed address needs a new link.
    return signing.dumps({'user': str(user.pk), 'email': user.email}, salt=SALT)


def read_token(token):
    """Return the payload, or raise signing.SignatureExpired / signing.BadSignature."""
    return signing.loads(token, salt=SALT, max_age=MAX_AGE)


def verification_link(user):
    return f'{settings.FRONTEND_ORIGIN}/#/verify/{make_token(user)}'
