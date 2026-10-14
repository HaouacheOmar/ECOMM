from zoneinfo import ZoneInfo

from django.conf import settings
from django.utils import timezone
from rest_framework import serializers

from products.models import Product

from .models import Restock, RestockLine, StockCorrection, Supplier


def shop_today():
    return timezone.localdate(timezone=ZoneInfo(settings.SHOP_TIME_ZONE))


class SupplierSerializer(serializers.ModelSerializer):
    total_spent = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True, default=0)  # annotated by the view

    class Meta:
        model = Supplier
        fields = ['id', 'name', 'phone', 'email', 'address', 'notes', 'is_archived', 'total_spent']
        read_only_fields = ['is_archived']  # archive / restore actions


class SupplierBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name', 'is_archived']


class ProductBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = ['id', 'name']


class RestockLineSerializer(serializers.ModelSerializer):
    product = ProductBriefSerializer(read_only=True)

    class Meta:
        model = RestockLine
        fields = ['product', 'quantity', 'unit_cost']


class RestockSerializer(serializers.ModelSerializer):
    supplier = SupplierBriefSerializer(read_only=True)
    lines = RestockLineSerializer(many=True, read_only=True)
    total = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Restock
        fields = ['id', 'supplier', 'date', 'note', 'lines', 'total', 'cancelled_at', 'created_at']


class RestockLineInputSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())
    quantity = serializers.IntegerField(min_value=1)
    unit_cost = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0)
    update_cost_price = serializers.BooleanField(default=False)  # also make it the Product's Cost price

    def validate_product(self, product):
        if product.is_archived:
            raise serializers.ValidationError('This product is archived.')
        return product


class RestockInputSerializer(serializers.Serializer):
    supplier = serializers.PrimaryKeyRelatedField(queryset=Supplier.objects.all())
    date = serializers.DateField()
    note = serializers.CharField(required=False, allow_blank=True, default='')
    lines = RestockLineInputSerializer(many=True, allow_empty=False)

    def validate_supplier(self, supplier):
        if supplier.is_archived:
            raise serializers.ValidationError('This supplier is archived.')
        return supplier

    def validate_date(self, date):
        if date > shop_today():
            raise serializers.ValidationError('A restock cannot be dated in the future.')
        return date

    def validate_lines(self, lines):
        products = [line['product'].pk for line in lines]
        if len(products) != len(set(products)):
            raise serializers.ValidationError('Each product can appear only once.')
        return lines


class StockCorrectionSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())

    class Meta:
        model = StockCorrection
        fields = ['id', 'product', 'quantity', 'reason', 'note', 'created_at']

    def validate_quantity(self, quantity):
        if quantity == 0:
            raise serializers.ValidationError('Enter how many units to add (+) or remove (-).')
        return quantity

    def validate(self, data):
        if data['reason'] == StockCorrection.Reason.OTHER and not data.get('note', '').strip():
            raise serializers.ValidationError({'note': 'Say what happened.'})
        return data
