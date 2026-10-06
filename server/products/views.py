import uuid

from django.db import transaction
from django.db.models import ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import filters, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from accounts.permissions import IsAdmin, ReadOnlyOrAdmin, is_admin

from .models import Category, Product, ProductImage
from .serializers import (
    CategorySerializer,
    ProductDetailSerializer,
    ProductImageSerializer,
    ProductListSerializer,
    ProductWriteSerializer,
)


class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer
    permission_classes = [ReadOnlyOrAdmin]
    pagination_class = None

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': 'This category still has products. Move or archive them first.'}, status=409)


class ProductViewSet(viewsets.ModelViewSet):
    """Catalog for everyone; the Admin also writes. Archived Products are hidden from everyone but the Admin."""

    permission_classes = [ReadOnlyOrAdmin]
    http_method_names = ['get', 'post', 'patch', 'delete', 'head', 'options']  # DELETE only for photos; products are archived
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name']
    ordering_fields = ['price', 'rating_avg', 'created_at', 'name', 'stock']
    ordering = ['-created_at']

    def get_queryset(self):
        products = Product.objects.select_related('category').prefetch_related('images')
        # The Admin sees archived Products when asking for them (management list) or opening one directly.
        if not (is_admin(self.request.user) and (self.action != 'list' or self.request.query_params.get('include_archived'))):
            products = products.filter(is_archived=False)
        if category := self.request.query_params.get('category'):
            try:
                products = products.filter(category_id=uuid.UUID(category))
            except ValueError:
                return products.none()
        return products

    def get_serializer_class(self):
        if self.action in ('create', 'partial_update'):
            return ProductWriteSerializer
        return ProductDetailSerializer if self.action == 'retrieve' else ProductListSerializer

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Products are archived, not deleted.'}, status=405)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def archive(self, request, pk=None):
        return self._set_archived(True)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def restore(self, request, pk=None):
        return self._set_archived(False)

    def _set_archived(self, archived):
        product = self.get_object()
        product.is_archived = archived
        product.save(update_fields=['is_archived'])
        return Response(ProductDetailSerializer(product, context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin], parser_classes=[MultiPartParser, FormParser])
    def images(self, request, pk=None):
        product = self.get_object()
        upload = ProductImageSerializer(data=request.data)
        upload.is_valid(raise_exception=True)
        upload.save(product=product, is_primary=not product.images.exists())
        return Response(ProductDetailSerializer(self.get_object(), context=self.get_serializer_context()).data, status=201)

    @action(detail=True, methods=['delete'], url_path=r'images/(?P<image_id>\d+)', permission_classes=[IsAdmin])
    def delete_image(self, request, pk=None, image_id=None):
        product = self.get_object()
        image = get_object_or_404(product.images, pk=image_id)
        with transaction.atomic():
            image.image.delete(save=False)
            image.delete()
            if image.is_primary and (successor := ProductImage.objects.filter(product=product).first()):
                successor.is_primary = True
                successor.save(update_fields=['is_primary'])
        return Response(ProductDetailSerializer(self.get_object(), context=self.get_serializer_context()).data)

    @action(detail=True, methods=['post'], url_path=r'images/(?P<image_id>\d+)/primary', permission_classes=[IsAdmin])
    def make_primary(self, request, pk=None, image_id=None):
        product = self.get_object()
        image = get_object_or_404(product.images, pk=image_id)
        with transaction.atomic():
            product.images.update(is_primary=False)
            image.is_primary = True
            image.save(update_fields=['is_primary'])
        return Response(ProductDetailSerializer(self.get_object(), context=self.get_serializer_context()).data)
