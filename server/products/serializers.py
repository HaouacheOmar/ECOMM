from rest_framework import serializers

from .models import Category, Product, ProductImage

MAX_IMAGE_BYTES = 5 * 1024 * 1024


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description']


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
        return self.context['request'].build_absolute_uri(first.image.url) if first else None


class ProductDetailSerializer(ProductListSerializer):
    images = ProductImageSerializer(many=True, read_only=True)

    class Meta(ProductListSerializer.Meta):
        fields = ProductListSerializer.Meta.fields + ['description', 'images']


class ProductWriteSerializer(serializers.ModelSerializer):
    """What the Admin edits; archiving and photos have their own actions."""

    category = serializers.PrimaryKeyRelatedField(queryset=Category.objects.all())
    price = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=1)
    stock = serializers.IntegerField(min_value=0)

    class Meta:
        model = Product
        fields = ['id', 'name', 'description', 'price', 'stock', 'category']
