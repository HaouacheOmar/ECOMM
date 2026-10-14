"""Every stock change outside checkout: Restocks (and their cancellation) and Stock Corrections.
Products are locked in a fixed order, as at checkout, so concurrent changes queue instead of deadlocking."""

from collections import Counter

from django.db import transaction
from django.db.models import F
from django.utils import timezone

from products.models import Product

from .models import Restock, RestockLine, StockCorrection


class NotEnoughStock(Exception):
    def __init__(self, items):
        super().__init__('Some of this stock is no longer in stock.')
        self.items = items  # [{'product': id, 'available': n}]


def record_restock(supplier, date, lines, note=''):
    """lines: [{'product', 'quantity', 'unit_cost', 'update_cost_price'}]."""
    with transaction.atomic():
        restock = Restock.objects.create(supplier=supplier, date=date, note=note)
        RestockLine.objects.bulk_create(
            RestockLine(restock=restock, product=line['product'], quantity=line['quantity'], unit_cost=line['unit_cost'])
            for line in lines
        )
        for line in sorted(lines, key=lambda line: line['product'].pk):
            Product.objects.filter(pk=line['product'].pk).update(stock=F('stock') + line['quantity'])
            if line.get('update_cost_price'):
                line['product'].set_cost_price(line['unit_cost'])
    return restock


def cancel_restock(restock):
    """Takes the Restock's stock back off; refused (nothing changes) if any of it has been sold."""
    with transaction.atomic():
        restock = Restock.objects.select_for_update().get(pk=restock.pk)
        if restock.cancelled_at:
            return restock
        wanted = Counter()
        for line in restock.lines.all():
            wanted[line.product_id] += line.quantity
        locked = Product.objects.select_for_update().filter(pk__in=wanted).order_by('pk')
        short = [{'product': str(p.pk), 'available': p.stock} for p in locked if p.stock < wanted[p.pk]]
        if short:
            raise NotEnoughStock(short)
        for product_id, quantity in wanted.items():
            Product.objects.filter(pk=product_id).update(stock=F('stock') - quantity)
        restock.cancelled_at = timezone.now()
        restock.save(update_fields=['cancelled_at'])
    return restock


def correct_stock(product, quantity, reason, note=''):
    """Refused (NotEnoughStock) if it would take stock below zero."""
    with transaction.atomic():
        changed = Product.objects.filter(pk=product.pk, stock__gte=-quantity).update(stock=F('stock') + quantity)
        if not changed:
            raise NotEnoughStock([{'product': str(product.pk), 'available': Product.objects.get(pk=product.pk).stock}])
        return StockCorrection.objects.create(product=product, quantity=quantity, reason=reason, note=note)
