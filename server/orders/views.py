from django.db import transaction
from django.db.models import F, ProtectedError
from django.shortcuts import get_object_or_404
from rest_framework import filters, mixins, serializers, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsCustomer, IsStaff, ReadOnlyOrAdmin, is_admin, is_staff_member
from products.models import Product
from products.serializers import ProductListSerializer

from .models import Cart, CartItem, Order, OrderItem, PickupPoint
from .serializers import CheckoutSerializer, OrderSerializer, PickupPointSerializer
from .live import broadcast
from .tasks import send_order_confirmation

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


class PickupPointViewSet(viewsets.ModelViewSet):
    """Everyone reads the active Pickup Points; the Admin manages all of them."""

    serializer_class = PickupPointSerializer
    permission_classes = [ReadOnlyOrAdmin]
    pagination_class = None

    def get_queryset(self):
        points = PickupPoint.objects.all()
        return points if is_admin(self.request.user) else points.filter(is_active=True)

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response({'detail': 'Orders use this pickup point. Deactivate it instead.'}, status=409)


class OrderViewSet(mixins.CreateModelMixin, viewsets.ReadOnlyModelViewSet):
    """One URL for every role: a Customer sees their own Orders, the Admin and Employees see all.
    POST is checkout (Customers only). Status only changes through the ship/deliver/cancel actions."""

    serializer_class = OrderSerializer
    filter_backends = [filters.SearchFilter]
    search_fields = ['customer__email']

    def get_permissions(self):
        if self.action == 'create':
            return [IsCustomer()]
        if self.action in ('ship', 'deliver'):
            return [IsStaff()]
        return super().get_permissions()

    def scoped(self):
        user = self.request.user
        return Order.objects.all() if is_staff_member(user) else Order.objects.filter(customer=user)

    def get_queryset(self):
        orders = self.scoped().select_related('customer', 'pickup_point').prefetch_related('items__product__images')
        if status := self.request.query_params.get('status'):
            orders = orders.filter(status=status)
        if customer := self.request.query_params.get('customer'):  # the desk's "this Customer's Orders"
            orders = orders.filter(customer_id=serializers.UUIDField().run_validation(customer))
        return orders

    def respond(self, order, event, status=200):
        """Answer with the fresh Order and push the same data to the live feed (after commit)."""
        data = self.get_serializer(self.get_queryset().get(pk=order.pk)).data
        broadcast(event, data, order.customer_id)
        return Response(data, status=status)

    def create(self, request):
        if not request.user.is_email_verified:
            return Response({'detail': 'Verify your email before confirming an order.', 'code': 'email_not_verified'}, status=403)
        checkout = CheckoutSerializer(data=request.data)
        checkout.is_valid(raise_exception=True)

        with transaction.atomic():
            cart = Cart.objects.select_for_update().filter(customer=request.user).first()
            lines = list(cart.items.all()) if cart else []
            if not lines:
                return Response({'detail': 'Your cart is empty.'}, status=400)
            # Lock the Products in a fixed order so concurrent checkouts queue instead of deadlocking.
            locked = Product.objects.select_for_update().filter(pk__in=[line.product_id for line in lines]).order_by('pk')
            products = {p.pk: p for p in locked}
            short = [
                {'product': str(p.pk), 'available': 0 if p.is_archived else p.stock}
                for line in lines
                if (p := products[line.product_id]).is_archived or line.quantity > p.stock
            ]
            if short:
                return Response(
                    {'detail': 'Some items are no longer available in that quantity.', 'code': 'out_of_stock', 'items': short},
                    status=409,
                )

            order = Order.objects.create(
                customer=request.user,
                total_amount=sum(products[line.product_id].price * line.quantity for line in lines),
                **checkout.validated_data,
            )
            OrderItem.objects.bulk_create(
                OrderItem(order=order, product_id=line.product_id, quantity=line.quantity, price_at_purchase=products[line.product_id].price)
                for line in lines
            )
            for line in lines:
                Product.objects.filter(pk=line.product_id).update(stock=F('stock') - line.quantity)
            cart.items.all().delete()
            transaction.on_commit(lambda: send_order_confirmation.delay(str(order.pk)))

        return self.respond(order, 'order.created', status=201)

    def move(self, pk, to):
        """Confirmed -> Shipped -> Delivered, or Confirmed -> Cancelled (which puts the stock back)."""
        with transaction.atomic():
            order = get_object_or_404(self.scoped().select_for_update(), pk=pk)
            if order.status != TRANSITIONS[to]:
                return Response({'detail': REFUSALS[to], 'code': 'invalid_transition'}, status=409)
            order.status = to
            order.save(update_fields=['status'])
            if to == Order.Status.CANCELLED:
                for item in order.items.all():
                    Product.objects.filter(pk=item.product_id).update(stock=F('stock') + item.quantity)
        return self.respond(order, 'order.updated')

    @action(detail=True, methods=['post'])
    def ship(self, request, pk=None):
        return self.move(pk, Order.Status.SHIPPED)

    @action(detail=True, methods=['post'])
    def deliver(self, request, pk=None):
        return self.move(pk, Order.Status.DELIVERED)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        return self.move(pk, Order.Status.CANCELLED)


# The status an Order must be in for each move.
TRANSITIONS = {
    Order.Status.SHIPPED: Order.Status.CONFIRMED,
    Order.Status.DELIVERED: Order.Status.SHIPPED,
    Order.Status.CANCELLED: Order.Status.CONFIRMED,
}
REFUSALS = {
    Order.Status.SHIPPED: 'Only a confirmed order can be shipped.',
    Order.Status.DELIVERED: 'Only a shipped order can be delivered.',
    Order.Status.CANCELLED: 'This order can no longer be cancelled.',
}
