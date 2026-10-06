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
