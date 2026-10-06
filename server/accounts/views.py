from django.conf import settings
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core import signing
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from .activity import session_changed
from .models import EmployeeSession, User
from .tasks import send_verification_email
from .verification import read_token

REFRESH_COOKIE = 'refresh'
REFRESH_COOKIE_PATH = '/api/auth/'


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'role', 'is_email_verified']


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


def refresh_token_for(user):
    """Refresh token whose claims (copied into every access token) carry what the SPA routes on."""
    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    refresh['is_email_verified'] = user.is_email_verified
    return refresh


def session_response(user, refresh, access, status=200):
    response = Response({'access': access, 'user': UserSerializer(user).data}, status=status)
    response.set_cookie(
        REFRESH_COOKIE, refresh,
        max_age=int(settings.SIMPLE_JWT['REFRESH_TOKEN_LIFETIME'].total_seconds()),
        httponly=True, secure=not settings.DEBUG, samesite='Strict', path=REFRESH_COOKIE_PATH,
    )
    return response


def unauthorized(detail, code):
    response = Response({'detail': detail, 'code': code}, status=401)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, samesite='Strict')
    return response


class LoginView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        data = LoginSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        # Emails are matched case-insensitively; authenticate against the stored spelling.
        email = data.validated_data['email']
        stored = User.objects.filter(email__iexact=email).values_list('email', flat=True).first() or email
        user = authenticate(request, email=stored, password=data.validated_data['password'])
        if user is None:
            return Response({'detail': 'No active account found with the given credentials.'}, status=401)

        refresh = refresh_token_for(user)
        if user.role == User.Role.EMPLOYEE:
            # The session id rides in the refresh token (kept across rotation) so logout closes this session.
            refresh['employee_session'] = EmployeeSession.objects.create(employee=user).pk
            session_changed(user, ended=False)
        return session_response(user, str(refresh), str(refresh.access_token))


class RefreshView(APIView):
    """Rotate the refresh cookie. New tokens are minted from the database, so claims never go stale
    (e.g. is_email_verified right after verification); the old refresh token is blacklisted."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if not raw:
            return unauthorized('Not logged in.', 'no_session')
        try:
            old = RefreshToken(raw)  # checks signature, expiry and blacklist
            user = User.objects.get(pk=old['user_id'], is_active=True)
        except (TokenError, User.DoesNotExist):
            return unauthorized('Session expired. Please log in again.', 'session_expired')
        old.blacklist()
        refresh = refresh_token_for(user)
        if session_id := old.get('employee_session'):
            refresh['employee_session'] = session_id
        return session_response(user, str(refresh), str(refresh.access_token))


class LogoutView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if raw:
            try:
                refresh = RefreshToken(raw)
            except TokenError:
                pass
            else:
                if session_id := refresh.get('employee_session'):
                    session = EmployeeSession.objects.select_related('employee').filter(pk=session_id, logout_at=None).first()
                    if session:
                        session.logout_at = timezone.now()
                        session.save(update_fields=['logout_at'])
                        session_changed(session.employee, ended=True)
                refresh.blacklist()
        response = Response(status=204)
        response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, samesite='Strict')
        return response


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)


class RegisterSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    password_confirm = serializers.CharField(write_only=True)

    def validate_email(self, email):
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return User.objects.normalize_email(email).lower()

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError({'password_confirm': 'Passwords do not match.'})
        try:
            validate_password(attrs['password'], User(email=attrs['email']))
        except DjangoValidationError as error:
            raise serializers.ValidationError({'password': list(error.messages)})
        return attrs


class RegisterView(APIView):
    """A visitor becomes a Customer (never another role), is logged in, and gets a verification email."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        data = RegisterSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        user = User.objects.create_user(data.validated_data['email'], data.validated_data['password'], role=User.Role.CUSTOMER)
        transaction.on_commit(lambda: send_verification_email.delay(user.pk))
        refresh = refresh_token_for(user)
        return session_response(user, str(refresh), str(refresh.access_token), status=201)


class VerifyEmailView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        try:
            payload = read_token(str(request.data.get('token', '')))
        except signing.SignatureExpired:
            return Response({'detail': 'This link has expired. Request a new one.', 'code': 'expired'}, status=400)
        except signing.BadSignature:
            return Response({'detail': 'This link is not valid.', 'code': 'invalid'}, status=400)
        updated = User.objects.filter(pk=payload['user'], email=payload['email']).update(is_email_verified=True)
        if not updated:
            return Response({'detail': 'This link is not valid.', 'code': 'invalid'}, status=400)
        return Response({'detail': 'Email verified.'})


class ResendVerificationView(APIView):
    RESEND_COOLDOWN_SECONDS = 60

    def post(self, request):
        user = request.user
        if user.role != User.Role.CUSTOMER or user.is_email_verified:
            return Response({'detail': 'Your email is already verified.'}, status=400)
        # One email per minute per user; cache.add only succeeds when the key is absent.
        if not cache.add(f'verify-resend:{user.pk}', 1, self.RESEND_COOLDOWN_SECONDS):
            return Response({'detail': 'Please wait a minute before asking again.'}, status=429)
        send_verification_email.delay(user.pk)
        return Response({'detail': 'Verification email sent.'})
