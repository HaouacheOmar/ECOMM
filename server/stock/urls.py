from django.urls import path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('suppliers', views.SupplierViewSet, basename='supplier')
router.register('restocks', views.RestockViewSet, basename='restock')
router.register('stock-corrections', views.StockCorrectionViewSet, basename='stock-correction')

urlpatterns = [
    path('products/<uuid:pk>/stock-history/', views.StockHistoryView.as_view(), name='stock-history'),
    *router.urls,
]
