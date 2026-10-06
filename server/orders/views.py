from django.db import transaction
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCustomer
from products.models import Product
from products.serializers import ProductListSerializer

from .models import Cart, CartItem

MAX_LINES = 100


class LineSerializer(serializers.Serializer):
    product = serializers.UUIDField()
    quantity = serializers.IntegerField(min_value=1, default=1)


class LinesSerializer(serializers.Serializer):
    items = LineSerializer(many=True, max_length=MAX_LINES)


class QuantitySerializer(serializers.Serializer):
    quantity = serializers.IntegerField(min_value=1)


def cart_payload(lines, request):
    """Same shape for a Customer Cart and a Guest Cart preview. Prices and stock are always current."""
    items = [
        {
            'product': ProductListSerializer(product, context={'request': request}).data,
            'quantity': quantity,
            # Sold out or reduced since it was added: blocks checkout until removed or reduced.
            'available': quantity <= product.stock,
        }
        for product, quantity in lines
    ]
    return {
        'items': items,
        'count': sum(q for _, q in lines),
        'subtotal': str(sum(p.price * q for p, q in lines)),
    }


def sellable(product_ids):
    products = Product.objects.filter(pk__in=product_ids, is_archived=False).select_related('category').prefetch_related('images')
    return {p.pk: p for p in products}


class CustomerCartView(APIView):
    permission_classes = [IsCustomer]

    def cart(self):
        return Cart.objects.get_or_create(customer=self.request.user)[0]

    def respond(self, cart):
        # Archived Products leave every Cart automatically.
        cart.items.filter(product__is_archived=True).delete()
        lines = cart.items.select_related('product__category').prefetch_related('product__images')
        return Response(cart_payload([(line.product, line.quantity) for line in lines], self.request))

    def locked_cart(self):
        cart = self.cart()
        return Cart.objects.select_for_update().get(pk=cart.pk)


class CartView(CustomerCartView):
    def get(self, request):
        return self.respond(self.cart())


class CartItemsView(CustomerCartView):
    """Add a Product; the quantity is capped at the current stock."""

    def post(self, request):
        line = LineSerializer(data=request.data)
        line.is_valid(raise_exception=True)
        product = sellable([line.validated_data['product']]).get(line.validated_data['product'])
        if product is None:
            return Response({'detail': 'This product is not available.'}, status=400)
        if product.stock == 0:
            return Response({'detail': 'This product is out of stock.'}, status=400)
        with transaction.atomic():
            cart = self.locked_cart()
            item, _ = CartItem.objects.get_or_create(cart=cart, product=product, defaults={'quantity': 0})
            item.quantity = min(item.quantity + line.validated_data['quantity'], product.stock)
            item.save()
        return self.respond(cart)


class CartItemView(CustomerCartView):
    def patch(self, request, product_id):
        data = QuantitySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        item = CartItem.objects.filter(cart=self.cart(), product_id=product_id).select_related('product').first()
        if item is None:
            return Response({'detail': 'Not in your cart.'}, status=404)
        if item.product.stock == 0:
            return Response({'detail': 'This product is out of stock.'}, status=400)
        item.quantity = min(data.validated_data['quantity'], item.product.stock)
        item.save()
        return self.respond(item.cart)

    def delete(self, request, product_id):
        cart = self.cart()
        cart.items.filter(product_id=product_id).delete()
        return self.respond(cart)


class CartMergeView(CustomerCartView):
    """Fold a Guest Cart in after login: quantities are summed and capped at stock; unsellable lines are dropped."""

    def post(self, request):
        data = LinesSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        products = sellable([line['product'] for line in data.validated_data['items']])
        with transaction.atomic():
            cart = self.locked_cart()
            for line in data.validated_data['items']:
                product = products.get(line['product'])
                if product is None or product.stock == 0:
                    continue
                item, _ = CartItem.objects.get_or_create(cart=cart, product=product, defaults={'quantity': 0})
                item.quantity = min(item.quantity + line['quantity'], product.stock)
                item.save()
        return self.respond(cart)


class CartPreviewView(APIView):
    """Price a Guest Cart held in the browser, without saving anything."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        data = LinesSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        products = sellable([line['product'] for line in data.validated_data['items']])
        lines = [(products[line['product']], line['quantity']) for line in data.validated_data['items'] if line['product'] in products]
        return Response(cart_payload(lines, request))
