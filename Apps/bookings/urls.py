from rest_framework.routers import DefaultRouter
from .views import (
    BookingViewSet,
    RideDetailViewSet,
    ParcelDetailViewSet,
    MovingDetailViewSet,
    BookingTrackingViewSet
)

router = DefaultRouter()
router.register(r'bookings', BookingViewSet, basename='booking')
router.register(r'ride-details', RideDetailViewSet, basename='ride-detail')
router.register(r'parcel-details', ParcelDetailViewSet, basename='parcel-detail')
router.register(r'moving-details', MovingDetailViewSet, basename='moving-detail')
router.register(r'trackings', BookingTrackingViewSet, basename='booking-tracking')

urlpatterns = router.urls
