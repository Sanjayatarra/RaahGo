from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from users.views import OTPVerificationViewSet

class OTPSendView(APIView):
    def post(self, request):
        # We can map to the existing send_otp logic
        viewset = OTPVerificationViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        return viewset.send_otp(request)

class OTPVerifyView(APIView):
    def post(self, request):
        viewset = OTPVerificationViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        return viewset.verify_otp(request)

class OTPResendView(APIView):
    def post(self, request):
        # Can reuse send_otp or implement resend logic
        viewset = OTPVerificationViewSet()
        viewset.request = request
        viewset.format_kwarg = None
        return viewset.send_otp(request)
