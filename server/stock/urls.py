from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register('suppliers', views.SupplierViewSet, basename='supplier')

urlpatterns = router.urls
