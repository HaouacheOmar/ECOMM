from django.conf import settings
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User
from accounts.views import start_session

from .seed import DEMO_LOGINS


class DemoView(APIView):
    """Whether the login page offers the "Try as ..." buttons."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'enabled': settings.DEMO_MODE})


class DemoLoginView(APIView):
    """DEMO_MODE only: sign in as the demo Customer, Employee or Admin without a password."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        if not settings.DEMO_MODE:
            return Response({'detail': 'Not found.'}, status=404)
        login = DEMO_LOGINS.get(request.data.get('role'))
        if login is None:
            return Response({'role': ['Choose CUSTOMER, EMPLOYEE or ADMIN.']}, status=400)
        user = User.objects.filter(email=login, is_active=True).first()
        if user is None:
            return Response({'detail': 'The demo data is missing. Run `manage.py seed_demo`.'}, status=503)
        return start_session(user)
