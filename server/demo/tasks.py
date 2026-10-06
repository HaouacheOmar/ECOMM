import random
import uuid

from celery import shared_task
from django.conf import settings

from accounts.models import User
from chat.service import Refused, send_message
from orders.checkout import OutOfStock, announce, place_order
from orders.models import Cart, CartItem, Order, PickupPoint
from products.models import Product

from .seed import DOMAIN, SIMULATED_MESSAGES


@shared_task
def simulate_activity(kind=None, customer_email=None):
    """DEMO_MODE (Celery Beat, ~45 s): a random demo Customer places an Order or writes to support,
    through the same code paths as the real thing, so the live feeds and the desk light up.
    kind ('order' or 'message') and customer_email pin the choice (tests)."""
    if not settings.DEMO_MODE:
        return None
    customers = User.objects.filter(email__endswith=f'@{DOMAIN}', role=User.Role.CUSTOMER, is_active=True)
    if customer_email:
        customers = customers.filter(email=customer_email)
    customers = list(customers)
    if not customers:
        return None
    customer = random.choice(customers)
    kind = kind or random.choices(['order', 'message'], weights=[3, 2])[0]
    return simulated_order(customer) if kind == 'order' else simulated_message(customer)


def simulated_order(customer):
    in_stock = list(Product.objects.filter(is_archived=False, stock__gt=0))
    points = list(PickupPoint.objects.filter(is_active=True))
    if not in_stock or not points:
        return None
    cart, _ = Cart.objects.get_or_create(customer=customer)
    cart.items.all().delete()
    for product in random.sample(in_stock, k=min(len(in_stock), random.choice([1, 1, 2]))):
        CartItem.objects.create(cart=cart, product=product, quantity=1)
    try:
        order = place_order(customer, {'delivery_method': Order.DeliveryMethod.PICKUP_POINT, 'pickup_point': random.choice(points)})
    except OutOfStock:
        cart.items.all().delete()
        return None
    announce(order, 'order.created')
    return order


def simulated_message(customer):
    try:
        message, _ = send_message(customer, random.choice(SIMULATED_MESSAGES), str(uuid.uuid4()))
    except Refused:  # e.g. the rate limit
        return None
    return message
