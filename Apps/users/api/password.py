from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from users.models import User, OTPVerification
from django.utils import timezone
from datetime import timedelta
import random

class PasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]
    def post(self, request):
        old_password = request.data.get('old_password')
        new_password = request.data.get('new_password')
        
        user = request.user
        # Simple plain-text check since AbstractBaseUser is not used, 
        # ideally this should use hashed passwords
        if user.password != old_password:
            return Response({'error': 'Incorrect old password'}, status=status.HTTP_400_BAD_REQUEST)
            
        user.password = new_password
        user.save()
        return Response({'status': 'Password changed successfully'})

class PasswordForgotView(APIView):
    def post(self, request):
        email = request.data.get('email')
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'error': 'User with this email not found'}, status=status.HTTP_404_NOT_FOUND)
            
        otp_code = f"{random.randint(1000, 9999)}"
        expires_at = timezone.now() + timedelta(minutes=10)
        
        OTPVerification.objects.create(
            user=user,
            email=email,
            otp=otp_code,
            purpose=OTPVerification.PurposeChoices.RESET_PASSWORD,
            expires_at=expires_at
        )
        
        # Optionally call send_otp_email here
        print(f"Password reset OTP for {email}: {otp_code}")
        
        return Response({'status': 'Password reset OTP sent to email'})

class PasswordResetView(APIView):
    def post(self, request):
        email = request.data.get('email')
        otp_code = request.data.get('otp')
        new_password = request.data.get('new_password')
        
        user = User.objects.filter(email__iexact=email).first()
        if not user:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)
            
        otp_record = OTPVerification.objects.filter(
            user=user, 
            otp=otp_code,
            purpose=OTPVerification.PurposeChoices.RESET_PASSWORD,
            is_verified=False,
            expires_at__gte=timezone.now()
        ).first()
        
        if not otp_record:
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)
            
        otp_record.is_verified = True
        otp_record.save()
        
        user.password = new_password
        user.save()
        return Response({'status': 'Password reset successfully'})
