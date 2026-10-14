from django.conf import settings
from rest_framework import serializers

from stock.models import Supplier
from stock.serializers import SupplierBriefSerializer

from .models import Category, Product, ProductImage

MAX_IMAGE_BYTES = 5 * 1024 * 1024


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description']


class CategoryWithImageSerializer(CategorySerializer):
    """The category list: each Category with a photo of one of its Products (the pill's icon)."""

    image = serializers.SerializerMethodField()

    class Meta(CategorySerializer.Meta):
        fields = CategorySerializer.Meta.fields + ['image']

    def get_image(self, category):
        path = getattr(category, 'image_path', None)  # annotated by the view
        if not path:
            return None
        url = settings.MEDIA_URL + path
        request = self.context.get('request')
        return request.build_absolute_uri(url) if request else url


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'is_primary']
        read_only_fields = ['is_primary']

    def validate_image(self, image):
        if image.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError('Images must be 5 MB or smaller.')
        return image


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    in_stock = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'stock', 'in_stock', 'category', 'rating_avg', 'review_count', 'image', 'is_archived']

    def get_in_stock(self, product):
        return product.stock > 0

    def get_image(self, product):
        # images are prefetched and ordered primary-first
        first = next(iter(product.images.all()), None)
        if first is None:
            return None
        request = self.context.get('request')  # absent for pushes made outside a request (e.g. Celery)
        return request.build_absolute_uri(first.image.url) if request else first.image.url


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ['description', 'images']


class ProductWriteSerializer(serializers.ModelSerializer):
    """What the Admin edits; archiving and photos have their own actions."""

    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1)
    cost_price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)  # required for new Products
    usual_supplier = serializers.PrimaryKeyRelatedField(queryset=Supplier.objects.all(), allow_null=True, required=False)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'cost_price', 'stock', 'category', 'usual_supplier']
        read_only_fields = ['stock']  # only Orders, Restocks and Stock Corrections change it; new Products start at 0

    def validate_usual_supplier(self, supplier):
        unchanged = self.instance is not None and supplier == self.instance.usual_supplier
        if supplier is not None and supplier.is_archived and not unchanged:
            raise serializers.ValidationError('This supplier is archived.')
        return supplier

    def update(self, product, validated_data):
        cost = validated_data.pop('cost_price', None)
        product = super().update(product, validated_data)
        if cost is not None and cost != product.cost_price:
            product.set_cost_price(cost)
        return product


class AdminProductListSerializer(ProductListSerializer):
    """The catalog as the Admin sees it: with the Cost price (null = Cost missing) and Usual Supplier."""

    usual_supplier = SupplierBriefSerializer(read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ['cost_price', 'usual_supplier']


class AdminProductDetailSerializer(ProductDetailSerializer):
    usual_supplier = SupplierBriefSerializer(read_only=True)

    class Meta(ProductDetailSerializer.Meta):
        fields = ProductDetailSerializer.Meta.fields + ['cost_price', 'usual_supplier']
