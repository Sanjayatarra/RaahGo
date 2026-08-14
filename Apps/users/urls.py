from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView
from .views import UserViewSet, UserAddressViewSet, OTPVerificationViewSet, UserDeviceViewSet

router = DefaultRouter()
router.register(r'users', UserViewSet, basename='user')
router.register(r'addresses', UserAddressViewSet, basename='user-address')
router.register(r'otps', OTPVerificationViewSet, basename='otp-verification')
router.register(r'devices', UserDeviceViewSet, basename='user-device')

urlpatterns = [
    # Include new structured API
    path('', include('users.api.urls')),
    
] + router.urls
