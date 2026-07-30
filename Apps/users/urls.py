from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, UserAddressViewSet, OTPVerificationViewSet, UserDeviceViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'addresses', UserAddressViewSet, basename='user-address')
router.register(r'otps', OTPVerificationViewSet, basename='otp-verification')
router.register(r'devices', UserDeviceViewSet, basename='user-device')

urlpatterns = [
    # Explicit Action Shortcuts to guarantee zero 404 errors
    path('otp/send_otp/', OTPVerificationViewSet.as_view({'post': 'send_otp'})),
    path('otp/verify_otp/', OTPVerificationViewSet.as_view({'post': 'verify_otp'})),
    path('otps/send_otp/', OTPVerificationViewSet.as_view({'post': 'send_otp'})),
    path('otps/verify_otp/', OTPVerificationViewSet.as_view({'post': 'verify_otp'})),
    path('google-auth/', UserViewSet.as_view({'post': 'google_auth'})),
] + router.urls
