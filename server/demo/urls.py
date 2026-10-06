from django.urls import path

from . import views

urlpatterns = [
    path('demo/', views.DemoView.as_view(), name='demo'),
    path('demo/login/', views.DemoLoginView.as_view(), name='demo-login'),
]
