from django.conf import settings
from django.contrib.auth import authenticate
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from .models import EmployeeSession, User

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
        user = authenticate(request, **data.validated_data)
        if user is None:
            return Response({'detail': 'No active account found with the given credentials.'}, status=401)

        refresh = refresh_token_for(user)
        if user.role == User.Role.EMPLOYEE:
            # The session id rides in the refresh token (kept across rotation) so logout closes this session.
            refresh['employee_session'] = EmployeeSession.objects.create(employee=user).pk
        return session_response(user, str(refresh), str(refresh.access_token))


class RefreshView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        raw = request.COOKIES.get(REFRESH_COOKIE)
        if not raw:
            return unauthorized('Not logged in.', 'no_session')
        serializer = TokenRefreshSerializer(data={'refresh': raw})
        try:
            serializer.is_valid(raise_exception=True)
            user = User.objects.get(pk=RefreshToken(serializer.validated_data['refresh'])['user_id'])
        except (TokenError, AuthenticationFailed, User.DoesNotExist):
            return unauthorized('Session expired. Please log in again.', 'session_expired')
        tokens = serializer.validated_data
        return session_response(user, tokens['refresh'], tokens['access'])


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
                    EmployeeSession.objects.filter(pk=session_id, logout_at=None).update(logout_at=timezone.now())
                refresh.blacklist()
        response = Response(status=204)
        response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH, samesite='Strict')
        return response


class MeView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user).data)
