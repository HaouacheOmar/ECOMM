"""Turning a Customer's Cart into a Confirmed Order, and telling everyone about Order changes.
Used by the checkout API and by the demo's simulated activity."""

from django.db import transaction
from django.db.models import F

from products.models import Product
from products.recommendations import purchases_changed

from .live import broadcast
from .models import Cart, Order, OrderItem
from .serializers import OrderSerializer
from .tasks import send_order_confirmation


class EmptyCart(Exception):
    pass


class OutOfStock(Exception):
    def __init__(self, items):
        super().__init__('Some items are no longer available in that quantity.')
        self.items = items  # [{'product': id, 'available': n}]


def place_order(customer, delivery):
    """One transaction with the Products locked (in a fixed order, so concurrent checkouts queue
    instead of deadlocking): stock taken, prices recorded, Cart emptied. Raises EmptyCart/OutOfStock."""
    with transaction.atomic():
        cart = Cart.objects.select_for_update().filter(customer=customer).first()
        lines = list(cart.items.all()) if cart else []
        if not lines:
            raise EmptyCart()
        locked = Product.objects.select_for_update().filter(pk__in=[line.product_id for line in lines]).order_by('pk')
        products = {p.pk: p for p in locked}
        short = [
            {'product': str(p.pk), 'available': 0 if p.is_archived else p.stock}
            for line in lines
            if (p := products[line.product_id]).is_archived or line.quantity > p.stock
        ]
        if short:
            raise OutOfStock(short)

        order = Order.objects.create(
            customer=customer,
            total_amount=sum(products[line.product_id].price * line.quantity for line in lines),
            **delivery,
        )
        OrderItem.objects.bulk_create(
            OrderItem(order=order, product_id=line.product_id, quantity=line.quantity, price_at_purchase=products[line.product_id].price)
            for line in lines
        )
        for line in lines:
            Product.objects.filter(pk=line.product_id).update(stock=F('stock') - line.quantity)
        cart.items.all().delete()
        transaction.on_commit(lambda: send_order_confirmation.delay(str(order.pk)))
    return order


def announce(order, event, request=None):
    """After a commit: push the Order to the live feeds and refresh the Customer's Recommendations
    when their purchases changed. Returns the Order as the REST API shows it."""
    fresh = Order.objects.select_related('customer', 'pickup_point').prefetch_related('items__product__images').get(pk=order.pk)
    data = OrderSerializer(fresh, context={'request': request}).data
    broadcast(event, data, order.customer_id)
    if event == 'order.created' or data['status'] == Order.Status.CANCELLED:
        purchases_changed(order.customer_id)
    return data
