"""Bestsellers and Recommendations. Only Product ids are cached (Redis); Products are loaded fresh
on every read, so prices, stock and archiving are always current."""

from datetime import timedelta

from django.core.cache import cache
from django.db.models import Avg, DecimalField, ExpressionWrapper, F, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone

from orders.models import Order, OrderItem

from .models import Product, Review

SIZE = 8
BESTSELLER_DAYS = 30
PRIOR_WEIGHT = 5  # m: how many "average" Reviews every Product starts with
BESTSELLERS_KEY = 'bestsellers'
CACHE_SECONDS = 60 * 60  # a safety net: Beat recomputes every 15 minutes, Order changes invalidate


def recommendations_key(customer_id):
    return f'recommendations:{customer_id}'


def counted_items():
    """Order items that count as sales: everything but Cancelled Orders."""
    return OrderItem.objects.exclude(order__status=Order.Status.CANCELLED)


def compute_bestseller_ids():
    since = timezone.now() - timedelta(days=BESTSELLER_DAYS)
    top = (counted_items().filter(order__created_at__gte=since, product__is_archived=False)
           .values('product').annotate(units=Sum('quantity')).order_by('-units', 'product')[:SIZE])
    ids = [str(row['product']) for row in top]
    cache.set(BESTSELLERS_KEY, ids, CACHE_SECONDS)
    return ids


def ordered(ids):
    """The non-archived Products with these ids, in the same order."""
    by_id = {str(p.pk): p for p in Product.objects.filter(pk__in=ids, is_archived=False).select_related('category').prefetch_related('images')}
    return [by_id[i] for i in ids if i in by_id]


def padded(products):
    """Fill empty slots with the newest Products."""
    newest = (Product.objects.filter(is_archived=False).exclude(pk__in=[p.pk for p in products])
              .select_related('category').prefetch_related('images')[:SIZE - len(products)])
    return products + list(newest)


def bestsellers():
    ids = cache.get(BESTSELLERS_KEY)
    if ids is None:
        ids = compute_bestseller_ids()
    return padded(ordered(ids))


def bayesian_score():
    """(v*R + m*C) / (v + m): a Product with few Reviews is pulled toward the shop's average C,
    so one 5-star Review doesn't outrank a 4.8 backed by many."""
    shop_average = Review.objects.aggregate(c=Avg('rating'))['c'] or 0
    m = Value(PRIOR_WEIGHT)
    return ExpressionWrapper(
        (F('review_count') * F('rating_avg') + m * Value(shop_average, output_field=DecimalField())) / (F('review_count') + m),
        output_field=DecimalField(max_digits=6, decimal_places=4),
    )


def compute_recommendation_ids(customer_id):
    """None when the Customer has no purchase history (they get the Bestsellers instead)."""
    bought = counted_items().filter(order__customer_id=customer_id)
    purchased = set(bought.values_list('product_id', flat=True))
    if not purchased:
        cache.set(recommendations_key(customer_id), None, CACHE_SECONDS)
        return None
    categories = Product.objects.filter(pk__in=purchased).values('category')
    ranked = (Product.objects.filter(category__in=categories, is_archived=False).exclude(pk__in=purchased)
              .annotate(score=bayesian_score(),
                        units=Coalesce(Sum('order_items__quantity', filter=~Q(order_items__order__status=Order.Status.CANCELLED)), 0))
              .order_by('-score', '-units', '-created_at')[:SIZE])
    ids = [str(p.pk) for p in ranked]
    cache.set(recommendations_key(customer_id), ids, CACHE_SECONDS)
    return ids


def purchases_changed(customer_id):
    """An Order was confirmed or cancelled: drop the stale list now (a read recomputes it) and
    recompute it in the background."""
    from .tasks import recompute_recommendations

    cache.delete(recommendations_key(customer_id))
    recompute_recommendations.delay(str(customer_id))


def recommendations(customer):
    ids = cache.get(recommendations_key(customer.pk), 'missing')
    if ids == 'missing':
        ids = compute_recommendation_ids(customer.pk)
    if ids is None:
        return bestsellers()
    products = ordered(ids)
    if len(products) < SIZE:  # they've bought most of their Categories: top up with Bestsellers
        skip = set(counted_items().filter(order__customer=customer).values_list('product_id', flat=True)) | {p.pk for p in products}
        products += [p for p in bestsellers() if p.pk not in skip][:SIZE - len(products)]
    return products
