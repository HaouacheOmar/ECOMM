from rest_framework import serializers

from products.serializers import ProductListSerializer

from .models import Order, OrderItem, PickupPoint


class PickupPointSerializer(serializers.ModelSerializer):
    class Meta:
        model = PickupPoint
        fields = ['id', 'name', 'city', 'address', 'is_active']


class OrderProductSerializer(ProductListSerializer):
    class Meta(ProductListSerializer.Meta):
        fields = ['id', 'name', 'image']


class OrderItemSerializer(serializers.ModelSerializer):
    product = OrderProductSerializer(read_only=True)

    class Meta:
        model = OrderItem
        fields = ['product', 'quantity', 'price_at_purchase']


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    pickup_point = PickupPointSerializer(read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'status', 'delivery_method', 'delivery_address', 'pickup_point', 'total_amount', 'created_at', 'items']


class CheckoutSerializer(serializers.Serializer):
    delivery_method = serializers.ChoiceField(choices=Order.DeliveryMethod.choices)
    delivery_address = serializers.CharField(required=False, allow_blank=True, max_length=500)
    pickup_point = serializers.PrimaryKeyRelatedField(queryset=PickupPoint.objects.filter(is_active=True), required=False, allow_null=True)

    def validate(self, data):
        if data['delivery_method'] == Order.DeliveryMethod.HOME_DELIVERY:
            if not data.get('delivery_address'):
                raise serializers.ValidationError({'delivery_address': 'Enter the delivery address.'})
            data.pop('pickup_point', None)
        else:
            if not data.get('pickup_point'):
                raise serializers.ValidationError({'pickup_point': 'Choose a pickup point.'})
            data['delivery_address'] = ''
        return data
