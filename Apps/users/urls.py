from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserAddressViewSet, OTPVerificationViewSet, UserDeviceViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'addresses', UserAddressViewSet, basename='user-address')
router.register(r'otps', OTPVerificationViewSet, basename='otp-verification')
router.register(r'devices', UserDeviceViewSet, basename='user-device')

urlpatterns = router.urls
