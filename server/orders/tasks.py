from celery import shared_task
from django.core.mail import send_mail

from .models import Order


@shared_task(autoretry_for=(OSError,), retry_backoff=True, max_retries=5)
def send_order_confirmation(order_id):
    order = Order.objects.select_related('customer', 'pickup_point').prefetch_related('items__product').filter(pk=order_id).first()
    if order is None:
        return
    lines = '\n'.join(f'  {i.quantity} x {i.product.name} @ {i.price_at_purchase} DA' for i in order.items.all())
    where = (
        f'Home Delivery to:\n  {order.delivery_address}' if order.delivery_method == Order.DeliveryMethod.HOME_DELIVERY
        else f'Pickup Point:\n  {order.pickup_point.name}, {order.pickup_point.address}, {order.pickup_point.city}'
    )
    send_mail(
        f'Your E-Shop order {str(order.pk)[:8].upper()} is confirmed',
        f'Thank you for your order!\n\n{lines}\n\nTotal: {order.total_amount} DA, cash on delivery.\n\n{where}\n',
        None,
        [order.customer.email],
    )
