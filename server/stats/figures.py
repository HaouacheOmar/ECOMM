"""The Admin's Statistics, computed on request from Orders and Restocks (ADR 0002):

- Revenue: Delivered Orders, in the month they were Delivered (shop time, Africa/Algiers).
- Gross profit: Revenue minus the Cost price each Order line kept. Lines with Cost missing add their
  Revenue but no profit, and make the figure Incomplete.
- Spent: Restocks dated in the month, unless Cancelled.
"""

from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from django.conf import settings
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce, TruncMonth, TruncYear

from orders.models import Order, OrderItem
from products.models import Product
from stock.models import RestockLine

MONEY = DecimalField(max_digits=14, decimal_places=2)
ZERO = Value(Decimal('0'), output_field=MONEY)
TOP = 5

LINE_REVENUE = ExpressionWrapper(F('price_at_purchase') * F('quantity'), output_field=MONEY)
LINE_PROFIT = ExpressionWrapper((F('price_at_purchase') - F('cost_at_purchase')) * F('quantity'), output_field=MONEY)
RESTOCK_LINE_COST = ExpressionWrapper(F('quantity') * F('unit_cost'), output_field=MONEY)


def shop_zone():
    return ZoneInfo(settings.SHOP_TIME_ZONE)


def month_start(year, month):
    return datetime(year, month, 1, tzinfo=shop_zone())


def next_month(year, month):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def previous_month(year, month):
    return (year - 1, 12) if month == 1 else (year, month - 1)


def money(amount):
    return str((amount or Decimal('0')).quantize(Decimal('0.01')))


def sold_lines(start, end):
    """Order lines of Orders Delivered in [start, end)."""
    return OrderItem.objects.filter(order__status=Order.Status.DELIVERED, order__delivered_at__gte=start, order__delivered_at__lt=end)


def restock_lines(first_day, last_day_excluded):
    return RestockLine.objects.filter(restock__cancelled_at__isnull=True, restock__date__gte=first_day, restock__date__lt=last_day_excluded)


def summary(year, month):
    start, end = month_start(year, month), month_start(*next_month(year, month))
    lines = sold_lines(start, end)
    sold = lines.aggregate(
        revenue=Coalesce(Sum(LINE_REVENUE), ZERO),
        gross_profit=Coalesce(Sum(LINE_PROFIT), ZERO),
        delivered_orders=Count('order', distinct=True),
    )
    missing = (Product.objects.filter(order_items__in=lines.filter(cost_at_purchase__isnull=True))
               .distinct().order_by('name').values('id', 'name'))
    spent = restock_lines(start.date(), end.date()).aggregate(spent=Coalesce(Sum(RESTOCK_LINE_COST), ZERO))['spent']
    return {
        'month': f'{year:04d}-{month:02d}',
        'revenue': money(sold['revenue']),
        'spent': money(spent),
        'gross_profit': money(sold['gross_profit']),
        'delivered_orders': sold['delivered_orders'],
        'profit_incomplete': bool(missing),
        'cost_missing_products': [{'id': str(p['id']), 'name': p['name']} for p in missing],
    }


def product_rankings(year, month):
    start, end = month_start(year, month), month_start(*next_month(year, month))
    by_product = list(
        sold_lines(start, end).values('product', 'product__name')
        .annotate(units=Sum('quantity'), revenue=Sum(LINE_REVENUE), gross_profit=Coalesce(Sum(LINE_PROFIT), ZERO))
    )
    rows = [{
        'id': str(row['product']), 'name': row['product__name'], 'units': row['units'],
        'revenue': money(row['revenue']), 'gross_profit': money(row['gross_profit']),
        '_revenue': row['revenue'], '_profit': row['gross_profit'],
    } for row in by_product]

    def top(key):
        return [{k: v for k, v in row.items() if not k.startswith('_')}
                for row in sorted(rows, key=lambda row: (-row[key], row['name']))[:TOP]]

    in_month = Q(order_items__order__status=Order.Status.DELIVERED,
                 order_items__order__delivered_at__gte=start, order_items__order__delivered_at__lt=end)
    slow = (Product.objects.filter(is_archived=False, stock__gt=0)
            .annotate(units=Coalesce(Sum('order_items__quantity', filter=in_month), 0))
            .order_by('units', 'name')[:TOP])
    return {
        'top_units': top('units'),
        'top_revenue': top('_revenue'),
        'top_profit': top('_profit'),
        'slow': [{'id': str(p.pk), 'name': p.name, 'units': p.units, 'stock': p.stock} for p in slow],
    }


def category_breakdown(year, month):
    start, end = month_start(year, month), month_start(*next_month(year, month))
    rows = (sold_lines(start, end).values('product__category', 'product__category__name')
            .annotate(units=Sum('quantity'), revenue=Sum(LINE_REVENUE), gross_profit=Coalesce(Sum(LINE_PROFIT), ZERO))
            .order_by('-revenue', 'product__category__name'))
    return [{
        'id': str(row['product__category']), 'name': row['product__category__name'], 'units': row['units'],
        'revenue': money(row['revenue']), 'gross_profit': money(row['gross_profit']),
    } for row in rows]


def _series(trunc, keyed):
    """{period: {'revenue', 'gross_profit', 'spent'}} for every period with any activity."""
    zone = shop_zone()
    periods = {}
    sold = (OrderItem.objects.filter(order__status=Order.Status.DELIVERED, order__delivered_at__isnull=False)
            .annotate(period=trunc('order__delivered_at', tzinfo=zone)).values('period')
            .annotate(revenue=Sum(LINE_REVENUE), gross_profit=Coalesce(Sum(LINE_PROFIT), ZERO)))
    for row in sold:
        periods.setdefault(keyed(row['period']), {})['revenue'] = row['revenue']
        periods[keyed(row['period'])]['gross_profit'] = row['gross_profit']
    bought = (RestockLine.objects.filter(restock__cancelled_at__isnull=True)
              .annotate(period=trunc('restock__date')).values('period').annotate(spent=Sum(RESTOCK_LINE_COST)))
    for row in bought:
        periods.setdefault(keyed(row['period']), {})['spent'] = row['spent']
    return periods


def _point(key, figures):
    return {
        'period': key,
        'revenue': money(figures.get('revenue')),
        'spent': money(figures.get('spent')),
        'gross_profit': money(figures.get('gross_profit')),
    }


def history(year, month, months=12):
    """The `months` months ending with year-month (empty months included), and every year with activity."""
    keys = []
    y, m = year, month
    for _ in range(months):
        keys.append(f'{y:04d}-{m:02d}')
        y, m = previous_month(y, m)
    by_month = _series(TruncMonth, lambda period: f'{period.year:04d}-{period.month:02d}')
    by_year = _series(TruncYear, lambda period: f'{period.year:04d}')
    return {
        'months': [_point(key, by_month.get(key, {})) for key in reversed(keys)],
        'years': [_point(key, by_year[key]) for key in sorted(by_year)],
    }


def low_stock():
    products = (Product.objects.filter(is_archived=False, stock__lte=F('reorder_level'))
                .select_related('usual_supplier').order_by('stock', 'name'))
    return [{
        'id': str(p.pk), 'name': p.name, 'stock': p.stock, 'reorder_level': p.reorder_level,
        'usual_supplier': {'id': str(p.usual_supplier.pk), 'name': p.usual_supplier.name} if p.usual_supplier else None,
    } for p in products]


def current_month():
    today = datetime.now(shop_zone()).date()
    return today.year, today.month


def parse_month(value):
    """'YYYY-MM' -> (year, month); None if it isn't a valid month."""
    try:
        parsed = date.fromisoformat(f'{value}-01')
    except (TypeError, ValueError):
        return None
    return parsed.year, parsed.month
