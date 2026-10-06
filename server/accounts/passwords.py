"""Forgotten passwords (Customers) and password changes (everyone). Either one signs the user out
everywhere else: refresh tokens revoked, sockets closed, open Employee Session ended."""

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.encoding import force_bytes, force_str
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import User
from .security import check_password, sign_out_everywhere
from .tasks import send_password_reset_email
from .views import start_session

REQUEST_COOLDOWN_SECONDS = 60


def reset_link(user):
    """Django's reset token hashes the current password and last login, so it stops working once
    used; it expires after PASSWORD_RESET_TIMEOUT (1 hour)."""
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return f'{settings.FRONTEND_ORIGIN}/#/reset/{uid}/{default_token_generator.make_token(user)}'


class NewPasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        check_password(attrs['password'], self.context['user'])
        return attrs


class ForgotPasswordView(APIView):
    """Always the same answer, so it can't be used to find out who has an account."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        email = serializers.EmailField().run_validation(request.data.get('email'))
        user = User.objects.filter(email__iexact=email, role=User.Role.CUSTOMER, is_active=True).first()
        # One email per address per minute (silently), so the form can't be used to flood an inbox.
        if user and cache.add(f'password-reset:{user.pk}', 1, REQUEST_COOLDOWN_SECONDS):
            send_password_reset_email.delay(user.pk)
        return Response({'detail': 'If an account exists for this email, we have sent a link to reset the password.'})


class ResetPasswordView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            user = User.objects.get(pk=force_str(urlsafe_base64_decode(str(request.data.get('uid', '')))),
                                    role=User.Role.CUSTOMER, is_active=True)
        except (ValueError, TypeError, OverflowError, DjangoValidationError, User.DoesNotExist):
            user = None
        if user is None or not default_token_generator.check_token(user, str(request.data.get('token', ''))):
            return Response({'detail': 'This link is not valid or has expired. Request a new one.', 'code': 'invalid_link'}, status=400)
        data = NewPasswordSerializer(data=request.data, context={'user': user})
        data.is_valid(raise_exception=True)
        user.set_password(data.validated_data['password'])
        user.save(update_fields=['password'])
        sign_out_everywhere(user)
        return Response({'detail': 'Your password has been changed. You can now log in.'})


class ChangePasswordView(APIView):
    """Any role. The current password is required; other sessions are signed out, this one continues
    with fresh tokens."""

    def post(self, request):
        user = request.user
        if not user.check_password(str(request.data.get('current_password', ''))):
            return Response({'current_password': ['Your current password is not correct.']}, status=400)
        data = NewPasswordSerializer(data=request.data, context={'user': user})
        data.is_valid(raise_exception=True)
        user.set_password(data.validated_data['password'])
        user.save(update_fields=['password'])
        sign_out_everywhere(user)
        return start_session(user)
