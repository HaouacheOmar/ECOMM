"""The Admin's management of Employee accounts and their Employee Sessions."""

from django.db import transaction
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from chat import presence
from chat.service import presence_changed, requeue_unanswered

from .models import EmployeeSession, User
from .permissions import IsAdmin
from .security import check_password, sign_out_everywhere


class EmployeeSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'is_active', 'is_online', 'date_joined', 'password']
        read_only_fields = ['is_active', 'date_joined']

    is_online = serializers.SerializerMethodField()

    def get_is_online(self, employee):
        return presence.is_online(employee.pk)

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
        """Locks the Employee out at once: login, refresh and access tokens all fail, their open
        sockets are closed (the desk signs out), and their Customers return to the Support Queue."""
        employee = self.get_object()
        with transaction.atomic():
            employee.is_active = False
            employee.save(update_fields=['is_active'])
            if presence.force_offline(employee.pk):
                presence_changed(employee, online=False)  # tells the Admin and re-queues
            else:
                requeue_unanswered(employee)
            employee.assigned_customers.update(assigned_employee=None)
        sign_out_everywhere(employee)
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
