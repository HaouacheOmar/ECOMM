from rest_framework import serializers

from .models import Category, Product, ProductImage


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'description']


class ProductImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductImage
        fields = ['id', 'image', 'is_primary']


class ProductListSerializer(serializers.ModelSerializer):
    category = CategorySerializer(read_only=True)
    in_stock = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'stock', 'in_stock', 'category', 'rating_avg', 'review_count', 'image']

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
