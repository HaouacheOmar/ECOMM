from django.db.models import Count, F, Max, Q
from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.pagination import CursorPagination
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import User

from .models import ChatMessage
from .service import customer_data, message_data


class IsChatUser(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role in (User.Role.CUSTOMER, User.Role.EMPLOYEE)


class IsEmployee(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == User.Role.EMPLOYEE


def chat_customer(request, source):
    """A Customer's own history; an Employee names the Customer (?customer= or body)."""
    if request.user.role == User.Role.CUSTOMER:
        return request.user
    customer_id = serializers.UUIDField().run_validation(source.get('customer'))  # 400 if missing/malformed
    customer = User.objects.filter(pk=customer_id, role=User.Role.CUSTOMER).first()
    if customer is None:
        raise serializers.ValidationError({'customer': 'No such Customer.'})
    return customer


class NewestFirst(CursorPagination):
    ordering = '-created_at'
    page_size = 30


class MessagesView(ListAPIView):
    """A Customer's whole history with every Employee, newest first (cursor-paginated)."""

    permission_classes = [IsChatUser]
    pagination_class = NewestFirst

    def get_queryset(self):
        return ChatMessage.objects.filter(customer=chat_customer(self.request, self.request.query_params)).select_related('sender')

    def list(self, request, *args, **kwargs):
        page = self.paginate_queryset(self.get_queryset())
        return self.get_paginated_response([message_data(m) for m in page])


class ReadView(APIView):
    """Opening the chat marks what the other side sent as read."""

    permission_classes = [IsChatUser]

    def post(self, request):
        customer = chat_customer(request, request.data)
        messages = ChatMessage.objects.filter(customer=customer, is_read=False)
        if request.user.role == User.Role.CUSTOMER:
            messages = messages.exclude(sender=customer)
        else:
            messages = messages.filter(sender=customer)
        messages.update(is_read=True)
        return Response(status=204)


def summaries(customers):
    customers = customers.annotate(
        unread=Count('chat_messages', filter=Q(chat_messages__sender=F('pk'), chat_messages__is_read=False)),
        last_message_at=Max('chat_messages__created_at'),
    )
    return [{**customer_data(c), 'unread': c.unread,
             'last_message_at': c.last_message_at.isoformat() if c.last_message_at else None} for c in customers]


class QueueView(APIView):
    """The Support Queue: Customers waiting for any Employee, longest-waiting first."""

    permission_classes = [IsEmployee]

    def get(self, request):
        return Response(summaries(User.objects.filter(role=User.Role.CUSTOMER, queued_at__isnull=False).order_by('queued_at')))


class MyCustomersView(APIView):
    """Customers this Employee is the Assigned Employee of, most recent conversation first."""

    permission_classes = [IsEmployee]

    def get(self, request):
        mine = User.objects.filter(assigned_employee=request.user, queued_at__isnull=True)
        return Response(sorted(summaries(mine), key=lambda c: c['last_message_at'] or '', reverse=True))
