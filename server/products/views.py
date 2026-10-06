import uuid

from rest_framework import filters, viewsets
from rest_framework.permissions import AllowAny

from .models import Category, Product
from .serializers import CategorySerializer, ProductDetailSerializer, ProductListSerializer


class CategoryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [AllowAny]
    pagination_class = None


class ProductViewSet(viewsets.ReadOnlyModelViewSet):
    """Catalog for everyone: archived Products are never listed or shown."""

    permission_classes = [AllowAny]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['price', 'rating_avg', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        products = Product.objects.filter(is_archived=False).select_related('category').prefetch_related('images')
        if category := self.request.query_params.get('category'):
            try:
                products = products.filter(category_id=uuid.UUID(category))
            except ValueError:
                return products.none()
        return products

    def get_serializer_class(self):
        return ProductDetailSerializer if self.action == 'retrieve' else ProductListSerializer
