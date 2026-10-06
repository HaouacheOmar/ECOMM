"""The Admin's management of Employee accounts and their Employee Sessions."""

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import EmployeeSession, User
from .permissions import IsAdmin


def check_password(password, user):
    try:
        validate_password(password, user)
    except DjangoValidationError as error:
        raise serializers.ValidationError({'password': list(error.messages)})


class EmployeeSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'is_active', 'date_joined', 'password']
        read_only_fields = ['is_active', 'date_joined']

    def validate_email(self, email):
        email = User.objects.normalize_email(email).lower()
        if User.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError('An account with this email already exists.')
        return email

    def validate(self, data):
        check_password(data['password'], User(email=data['email'], first_name=data.get('first_name', '')))
        return data

    def create(self, data):
        return User.objects.create_user(role=User.Role.EMPLOYEE, is_email_verified=True, **data)


class EmployeeUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['first_name', 'last_name']


class SetPasswordSerializer(serializers.Serializer):
    password = serializers.CharField()


def end_sessions(user):
    """Close the open Employee Session and revoke every refresh token, so no tab can stay signed in."""
    EmployeeSession.objects.filter(employee=user, logout_at=None).update(logout_at=timezone.now())
    for token in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=token)


class EmployeeViewSet(mixins.CreateModelMixin, mixins.UpdateModelMixin, viewsets.ReadOnlyModelViewSet):
    permission_classes = [IsAdmin]
    queryset = User.objects.filter(role=User.Role.EMPLOYEE).order_by('-is_active', 'email')
    http_method_names = ['get', 'post', 'patch']

    def get_serializer_class(self):
        return EmployeeUpdateSerializer if self.action == 'partial_update' else EmployeeSerializer

    def partial_update(self, request, *args, **kwargs):
        super().partial_update(request, *args, **kwargs)
        return Response(EmployeeSerializer(self.get_object()).data)

    @action(detail=True, methods=['post'], url_path='set-password')
    def set_password(self, request, pk=None):
        employee = self.get_object()
        data = SetPasswordSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        check_password(data.validated_data['password'], employee)
        employee.set_password(data.validated_data['password'])
        employee.save(update_fields=['password'])
        return Response(status=204)

    @action(detail=True, methods=['post'])
    def deactivate(self, request, pk=None):
        """Locks the Employee out at once: login, refresh and access tokens all fail, and their
        Customers return to the Support Queue."""
        employee = self.get_object()
        with transaction.atomic():
            employee.is_active = False
            employee.save(update_fields=['is_active'])
            employee.assigned_customers.update(assigned_employee=None)
            end_sessions(employee)
        return Response(EmployeeSerializer(employee).data)

    @action(detail=True, methods=['post'])
    def reactivate(self, request, pk=None):
        employee = self.get_object()
        employee.is_active = True
        employee.save(update_fields=['is_active'])
        return Response(EmployeeSerializer(employee).data)


class EmployeeSessionSerializer(serializers.ModelSerializer):
    employee = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeSession
        fields = ['id', 'employee', 'login_at', 'logout_at']

    def get_employee(self, session):
        e = session.employee
        return {'id': str(e.id), 'email': e.email, 'name': e.get_full_name()}


class EmployeeSessionViewSet(viewsets.ReadOnlyModelViewSet):
    """The activity log: each Employee Session from login to logout (open ones have no logout)."""

    permission_classes = [IsAdmin]
    serializer_class = EmployeeSessionSerializer

    def get_queryset(self):
        sessions = EmployeeSession.objects.select_related('employee')
        employee = self.request.query_params.get('employee')
        if not employee:
            return sessions
        return sessions.filter(employee_id=serializers.UUIDField().run_validation(employee))  # 400 if malformed
