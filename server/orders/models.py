import uuid

from django.conf import settings
from django.db import models

from products.models import Product


class Cart(models.Model):
    """A Customer's saved Cart. Guest Carts live in the browser and are merged in at login."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='cart')
    updated_at = models.DateTimeField(auto_now=True)


class CartItem(models.Model):
    cart = models.ForeignKey(Cart, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='+')
    quantity = models.PositiveIntegerField()
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['added_at']
        constraints = [models.UniqueConstraint(fields=['cart', 'product'], name='one_line_per_product')]


class PickupPoint(models.Model):
    """A collection office maintained by the Admin. Inactive ones are hidden from checkout."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120)
    city = models.CharField(max_length=80)
    address = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['city', 'name']

    def __str__(self):
        return f'{self.name} ({self.city})'


class Order(models.Model):
    class Status(models.TextChoices):
        CONFIRMED = 'CONFIRMED'
        SHIPPED = 'SHIPPED'
        DELIVERED = 'DELIVERED'
        CANCELLED = 'CANCELLED'

    class DeliveryMethod(models.TextChoices):
        HOME_DELIVERY = 'HOME_DELIVERY'
        PICKUP_POINT = 'PICKUP_POINT'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='orders')
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.CONFIRMED, db_index=True)
    delivery_method = models.CharField(max_length=13, choices=DeliveryMethod.choices)
    delivery_address = models.TextField(blank=True)
    pickup_point = models.ForeignKey(PickupPoint, on_delete=models.PROTECT, null=True, blank=True, related_name='orders')
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)  # DZD, cash on delivery, no fees
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                condition=(
                    models.Q(delivery_method='HOME_DELIVERY', pickup_point__isnull=True) & ~models.Q(delivery_address='')
                ) | models.Q(delivery_method='PICKUP_POINT', pickup_point__isnull=False),
                name='order_delivery_details',
            ),
        ]


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name='order_items')
    quantity = models.PositiveIntegerField()
    price_at_purchase = models.DecimalField(max_digits=10, decimal_places=2)
