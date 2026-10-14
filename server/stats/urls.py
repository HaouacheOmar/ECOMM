from django.urls import path

from . import views

urlpatterns = [
    path('stats/month/', views.MonthView.as_view(), name='stats-month'),
    path('stats/products/', views.ProductsView.as_view(), name='stats-products'),
    path('stats/history/', views.HistoryView.as_view(), name='stats-history'),
    path('stats/low-stock/', views.LowStockView.as_view(), name='stats-low-stock'),
]
