from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter(trailing_slash=True)
router.include_root_view = False
router.register('orders', views.OrderViewSet, basename='order')
router.register('pickup-points', views.PickupPointViewSet, basename='pickup-point')

urlpatterns = [
    path('cart/', views.CartView.as_view(), name='cart'),
    path('cart/items/', views.CartItemsView.as_view(), name='cart-items'),
    path('cart/items/<uuid:product_id>/', views.CartItemView.as_view(), name='cart-item'),
    path('cart/merge/', views.CartMergeView.as_view(), name='cart-merge'),
    path('cart/preview/', views.CartPreviewView.as_view(), name='cart-preview'),
] + router.urls
