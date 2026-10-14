import re

from django.db.models import DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.shortcuts import get_object_or_404
from rest_framework import filters, mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsAdmin
from orders.models import Order, OrderItem
from products.models import Product

from .models import Restock, RestockLine, StockCorrection, Supplier
from .movements import NotEnoughStock, cancel_restock, correct_stock, record_restock
from .serializers import RestockInputSerializer, RestockSerializer, StockCorrectionSerializer, SupplierSerializer

MONEY = DecimalField(max_digits=14, decimal_places=2)
MONTH = re.compile(r'^(\d{4})-(\d{2})$')


def not_enough_stock(error):
    return Response({'detail': str(error), 'code': 'not_enough_stock', 'items': error.items}, status=status.HTTP_409_CONFLICT)


class SupplierViewSet(viewsets.ModelViewSet):
    """Admin only. Suppliers are archived, not deleted; the list hides archived ones unless asked."""

    permission_classes = [IsAdmin]
    serializer_class = SupplierSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'phone', 'email']

    def get_queryset(self):
        spent = ExpressionWrapper(F('restocks__lines__quantity') * F('restocks__lines__unit_cost'), output_field=MONEY)
        suppliers = Supplier.objects.order_by('name').annotate(
            total_spent=Coalesce(Sum(spent, filter=Q(restocks__cancelled_at__isnull=True)), Value(0), output_field=MONEY))
        if self.action == 'list' and not self.request.query_params.get('include_archived'):
            suppliers = suppliers.filter(is_archived=False)
        return suppliers

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        return self._set_archived(True)

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        return self._set_archived(False)

    def _set_archived(self, archived):
        supplier = self.get_object()
        Supplier.objects.filter(pk=supplier.pk).update(is_archived=archived)
        supplier.is_archived = archived
        return Response(self.get_serializer(supplier).data)


class RestockViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Admin only. Recorded and cancelled, never edited or deleted. ?month=YYYY-MM&supplier=<id> filter the list."""

    permission_classes = [IsAdmin]
    serializer_class = RestockSerializer

    def get_queryset(self):
        restocks = Restock.objects.select_related('supplier').prefetch_related('lines__product')
        params = self.request.query_params
        if (month := MONTH.match(params.get('month', ''))):
            restocks = restocks.filter(date__year=int(month[1]), date__month=int(month[2]))
        if supplier := params.get('supplier'):
            restocks = restocks.filter(supplier_id=supplier) if re.fullmatch(r'[0-9a-fA-F-]{36}', supplier) else restocks.none()
        return restocks

    def create(self, request):
        data = RestockInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        restock = record_restock(**data.validated_data)
        return Response(RestockSerializer(self.get_queryset().get(pk=restock.pk)).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        restock = self.get_object()
        if restock.cancelled_at:
            return Response({'detail': 'This restock is already cancelled.', 'code': 'already_cancelled'}, status=409)
        try:
            cancel_restock(restock)
        except NotEnoughStock as error:
            return not_enough_stock(error)
        return Response(RestockSerializer(self.get_queryset().get(pk=restock.pk)).data)


class StockCorrectionViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Admin only. ?product=<id> filters the list."""

    permission_classes = [IsAdmin]
    serializer_class = StockCorrectionSerializer

    def get_queryset(self):
        corrections = StockCorrection.objects.all()
        if product := self.request.query_params.get('product'):
            corrections = corrections.filter(product_id=product)
        return corrections

    def create(self, request):
        data = self.get_serializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            correction = correct_stock(**data.validated_data)
        except NotEnoughStock as error:
            return not_enough_stock(error)
        return Response(self.get_serializer(correction).data, status=status.HTTP_201_CREATED)


HISTORY_LIMIT = 100  # ponytail: newest 100 movements, paginate if Products get long histories


class StockHistoryView(APIView):
    """Admin only: every change to a Product's stock, newest first, assembled from where it happened."""

    permission_classes = [IsAdmin]

    def get(self, request, pk):
        product = get_object_or_404(Product, pk=pk)
        events = []
        for item in OrderItem.objects.filter(product=product).select_related('order'):
            order = item.order
            ref = {'order': str(order.pk)}
            events.append({'at': order.created_at, 'change': -item.quantity, 'kind': 'ORDER', **ref})
            if order.status == Order.Status.CANCELLED:
                events.append({'at': order.cancelled_at or order.created_at, 'change': item.quantity, 'kind': 'ORDER_CANCELLED', **ref})
        for line in RestockLine.objects.filter(product=product).select_related('restock__supplier'):
            restock = line.restock
            ref = {'restock': str(restock.pk), 'supplier': restock.supplier.name}
            events.append({'at': restock.created_at, 'date': restock.date, 'change': line.quantity, 'kind': 'RESTOCK', **ref})
            if restock.cancelled_at:
                events.append({'at': restock.cancelled_at, 'change': -line.quantity, 'kind': 'RESTOCK_CANCELLED', **ref})
        for correction in StockCorrection.objects.filter(product=product):
            events.append({'at': correction.created_at, 'change': correction.quantity, 'kind': 'CORRECTION',
                           'reason': correction.reason, 'note': correction.note})
        events.sort(key=lambda event: event['at'], reverse=True)
        return Response({'stock': product.stock, 'events': events[:HISTORY_LIMIT]})
