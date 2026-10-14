from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from accounts.permissions import IsAdmin

from .models import Supplier
from .serializers import SupplierSerializer


class SupplierViewSet(viewsets.ModelViewSet):
    """Admin only. Suppliers are archived, not deleted; the list hides archived ones unless asked."""

    permission_classes = [IsAdmin]
    serializer_class = SupplierSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    filter_backends = [filters.SearchFilter]
    search_fields = ['name', 'phone', 'email']

    def get_queryset(self):
        suppliers = Supplier.objects.all()
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
        supplier.is_archived = archived
        supplier.save(update_fields=['is_archived'])
        return Response(self.get_serializer(supplier).data)
