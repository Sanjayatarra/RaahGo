from django.urls import path
from .driver_auth_views import (
    DriverSendOTPView,
    DriverVerifyOTPView,
    DriverSignupView,
    DriverVerifySignupOTPView,
    DriverCompleteProfileView,
    DriverGoogleAuthView,
)

urlpatterns = [
    path('send-otp/', DriverSendOTPView.as_view(), name='driver-send-otp'),
    path('verify-otp/', DriverVerifyOTPView.as_view(), name='driver-verify-otp'),
    path('signup/', DriverSignupView.as_view(), name='driver-signup'),
    path('verify-signup-otp/', DriverVerifySignupOTPView.as_view(), name='driver-verify-signup-otp'),
    path('complete-profile/', DriverCompleteProfileView.as_view(), name='driver-complete-profile'),
    path('google-auth/', DriverGoogleAuthView.as_view(), name='driver-google-auth'),
]
