from rest_framework.routers import DefaultRouter
from .views import DriverLocationViewSet

router = DefaultRouter()
router.register(r'locations', DriverLocationViewSet, basename='driver-location')

urlpatterns = router.urls
