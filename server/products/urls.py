from django.urls import path
from rest_framework.routers import DefaultRouter

from . import reviews, views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register('categories', views.CategoryViewSet, basename='category')
router.register('products', views.ProductViewSet, basename='product')

urlpatterns = [
    path('products/<uuid:pk>/reviews/', reviews.ProductReviewsView.as_view(), name='product-reviews'),
    path('products/<uuid:pk>/reviews/mine/', reviews.MyReviewView.as_view(), name='product-review-mine'),
] + router.urls
