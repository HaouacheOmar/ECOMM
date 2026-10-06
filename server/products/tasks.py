from datetime import timedelta

from celery import shared_task
from django.utils import timezone

from accounts.models import User

from . import recommendations


@shared_task
def precompute_bestsellers():
    """Every 15 minutes (Celery Beat)."""
    recommendations.compute_bestseller_ids()


@shared_task
def recompute_recommendations(customer_id):
    """After a Customer confirms or cancels an Order."""
    recommendations.compute_recommendation_ids(customer_id)


@shared_task
def refresh_recommendations():
    """Nightly, for Customers active in the last 30 days (new Reviews and Products shift the ranking)."""
    since = timezone.now() - timedelta(days=30)
    for customer_id in User.objects.filter(role=User.Role.CUSTOMER, is_active=True, last_login__gte=since).values_list('pk', flat=True):
        recommendations.compute_recommendation_ids(customer_id)
