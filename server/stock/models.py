import uuid

from django.db import models


class Supplier(models.Model):
    """A business the Admin buys stock from. Archived: no new Restocks, kept in history."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Restock(models.Model):
    """Products bought from one Supplier on a date: adds stock, and its total is Spent on that date.
    Never edited; a mistaken one is Cancelled as a whole while its stock is still there."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='restocks')
    date = models.DateField(db_index=True)
    note = models.TextField(blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    @property
    def total(self):
        return sum(line.quantity * line.unit_cost for line in self.lines.all())


class RestockLine(models.Model):
    restock = models.ForeignKey(Restock, on_delete=models.CASCADE, related_name='lines')
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT, related_name='restock_lines')
    quantity = models.PositiveIntegerField()
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2)  # DZD

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['restock', 'product'], name='restock_line_unique_product'),
            models.CheckConstraint(condition=models.Q(quantity__gte=1), name='restock_line_quantity_positive'),
        ]


class StockCorrection(models.Model):
    """A change to stock, up or down, for a reason other than buying or selling. No money involved."""

    class Reason(models.TextChoices):
        LOSS = 'LOSS', 'Loss'
        BREAKAGE = 'BREAKAGE', 'Breakage'
        MISCOUNT = 'MISCOUNT', 'Miscount'
        OTHER = 'OTHER', 'Other'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    product = models.ForeignKey('products.Product', on_delete=models.PROTECT, related_name='stock_corrections')
    quantity = models.IntegerField()  # signed: +found, -lost
    reason = models.CharField(max_length=10, choices=Reason.choices)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [models.CheckConstraint(condition=~models.Q(quantity=0), name='stock_correction_not_zero')]
