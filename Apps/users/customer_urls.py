from django.urls import path
from .customer_views import (
    CustomerSendOTPView,
    CustomerVerifyOTPView,
    CustomerSignupView,
    CustomerVerifySignupOTPView,
    CustomerCompleteProfileView,
    CustomerGoogleAuthView,
)

urlpatterns = [
    path('send-otp/', CustomerSendOTPView.as_view(), name='customer-send-otp'),
    path('verify-otp/', CustomerVerifyOTPView.as_view(), name='customer-verify-otp'),
    path('signup/', CustomerSignupView.as_view(), name='customer-signup'),
    path('verify-signup-otp/', CustomerVerifySignupOTPView.as_view(), name='customer-verify-signup-otp'),
    path('complete-profile/', CustomerCompleteProfileView.as_view(), name='customer-complete-profile'),
    path('google-auth/', CustomerGoogleAuthView.as_view(), name='customer-google-auth'),
]
