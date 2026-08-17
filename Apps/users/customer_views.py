import random
from django.utils import timezone
from datetime import timedelta
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import update_last_login

from .models import User, OTPVerification
from .serializers import UserSerializer
from .views import send_otp_email
from .authentication import issue_tokens_for_user

# Fixed role for Customer API endpoints
CUSTOMER_ROLE = User.RoleChoices.CUSTOMER


class CustomerSendOTPView(APIView):
    """
    Dedicated Customer API Endpoint: Send OTP for Customer login or signup
    POST /api/v1/customer/send-otp/
    """
    def post(self, request):
        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        purpose = request.data.get('purpose', 'Login')
        user_id = request.data.get('user_id')

        if not phone_number and not email:
            return Response({'error': 'Either phone_number or email is required'}, status=status.HTTP_400_BAD_REQUEST)

        if purpose == 'Login':
            role_user = None
            if phone_number:
                role_user = User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE).first()
            elif email:
                role_user = User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE).first()

            if not role_user:
                # Check if user exists under a DIFFERENT role (Driver)
                other_user = None
                if phone_number:
                    other_user = User.objects.filter(phone_number=phone_number).first()
                elif email:
                    other_user = User.objects.filter(email__iexact=email).first()

                if other_user:
                    return Response({
                        'error': 'User is not registered as Customer.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({'error': 'Customer account is not registered. Please sign up first.'}, status=status.HTTP_400_BAD_REQUEST)

        if purpose == 'Register':
            if phone_number and User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE, is_verified=True).exists():
                return Response({'error': 'User is already registered as Customer. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)
            if email and User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE, is_verified=True).exists():
                return Response({'error': 'User is already registered as Customer. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)

        associated_user = None
        if phone_number:
            associated_user = User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE).first()
        elif email:
            associated_user = User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE).first()

        otp_code = f"{random.randint(1000, 9999)}"
        expires_at = timezone.now() + timedelta(minutes=10)

        otp_record = OTPVerification.objects.create(
            phone_number=phone_number if phone_number else None,
            email=email if email else None,
            user=associated_user or (User.objects.filter(id=user_id, role=CUSTOMER_ROLE).first() if user_id else None),
            otp=otp_code,
            purpose=purpose,
            expires_at=expires_at
        )

        print(f"\n[CUSTOMER API OTP GENERATED] Target: {email or phone_number} | Code: {otp_code}")

        if email:
            send_otp_email(email, otp_code)

        return Response({
            'status': 'OTP sent successfully',
            'otp_id': otp_record.id,
            'target': email or phone_number,
            'otp': otp_code
        }, status=status.HTTP_201_CREATED)


class CustomerVerifyOTPView(APIView):
    """
    Dedicated Customer API Endpoint: Verify OTP for Customer login
    POST /api/v1/customer/verify-otp/
    """
    def post(self, request):
        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        otp_code = request.data.get('otp')

        if not (phone_number or email) or not otp_code:
            return Response({'error': 'Either phone_number or email, and OTP code are required'}, status=status.HTTP_400_BAD_REQUEST)

        query = OTPVerification.objects.filter(
            is_verified=False,
            expires_at__gte=timezone.now()
        )
        if email:
            query = query.filter(email__iexact=email)
        elif phone_number:
            query = query.filter(phone_number=phone_number)

        otp_record = query.order_by('-created_at').first()

        if not otp_record:
            return Response({'error': 'Invalid or expired OTP'}, status=status.HTTP_400_BAD_REQUEST)

        otp_record.attempts += 1

        if otp_record.otp == otp_code:
            otp_record.is_verified = True
            otp_record.save()

            role_user = None
            if email:
                role_user = User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE).first()
            elif phone_number:
                role_user = User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE).first()

            if not role_user:
                other_user = None
                if email:
                    other_user = User.objects.filter(email__iexact=email).first()
                elif phone_number:
                    other_user = User.objects.filter(phone_number=phone_number).first()

                if other_user and other_user.role != CUSTOMER_ROLE:
                    return Response({'error': 'User is not registered as Customer.'}, status=status.HTTP_400_BAD_REQUEST)

                temp_username = f"customer_{random.randint(100000, 999999)}"
                user = User.objects.create(
                    username=temp_username,
                    email=email if email else None,
                    phone_number=phone_number if phone_number else None,
                    role=CUSTOMER_ROLE,
                    is_verified=True
                )
            else:
                user = role_user

            if email:
                user.is_email_verified = True
            if phone_number:
                user.is_phone_verified = True
            user.is_verified = True
            user.save()

            update_last_login(None, user)
            tokens = issue_tokens_for_user(user, request)

            return Response({
                'status': 'OTP verified successfully',
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'user': UserSerializer(user).data
            }, status=status.HTTP_200_OK)

        otp_record.save()
        return Response({'error': 'Incorrect OTP'}, status=status.HTTP_400_BAD_REQUEST)


class CustomerSignupView(APIView):
    """
    Dedicated Customer API Endpoint: Initiate Customer signup
    POST /api/v1/customer/signup/
    """
    def post(self, request):
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')

        if not email and not phone_number:
            return Response({'error': 'Either email or phone_number is required for Customer signup.'}, status=status.HTTP_400_BAD_REQUEST)

        if email and User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE, is_verified=True).exists():
            return Response({'error': 'Customer with this email already exists. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)
        if phone_number and User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE, is_verified=True).exists():
            return Response({'error': 'Customer with this phone number already exists. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        if email:
            user = User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE, is_verified=False).first()
        elif phone_number:
            user = User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE, is_verified=False).first()

        if not user:
            temp_username = f"customer_{random.randint(100000, 999999)}"
            user = User.objects.create(
                username=temp_username,
                email=email if email else None,
                phone_number=phone_number if phone_number else None,
                role=CUSTOMER_ROLE,
                is_verified=False
            )

        otp_code = f"{random.randint(1000, 9999)}"
        expires_at = timezone.now() + timedelta(minutes=10)

        OTPVerification.objects.create(
            user=user,
            email=email if email else None,
            phone_number=phone_number if phone_number else None,
            otp=otp_code,
            purpose=OTPVerification.PurposeChoices.REGISTER,
            expires_at=expires_at
        )

        if email:
            send_otp_email(email, otp_code)

        return Response({
            'status': 'Customer signup initiated. OTP sent successfully.',
            'user_id': str(user.id),
            'target': email or phone_number,
            'otp': otp_code,
            'next_step': 'verify_signup_otp'
        }, status=status.HTTP_201_CREATED)


class CustomerVerifySignupOTPView(APIView):
    """
    Dedicated Customer API Endpoint: Verify OTP for Customer signup
    POST /api/v1/customer/verify-signup-otp/
    """
    def post(self, request):
        user_id = request.data.get('user_id')
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')
        otp_code = request.data.get('otp')

        if not otp_code or not (user_id or email or phone_number):
            return Response({'error': 'OTP code and user_id (or email/phone_number) are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        if user_id:
            user = User.objects.filter(id=user_id, role=CUSTOMER_ROLE).first()
        elif email:
            user = User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE).first()
        elif phone_number:
            user = User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE).first()

        if not user:
            return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        otp_record = OTPVerification.objects.filter(
            user=user,
            is_verified=False,
            expires_at__gte=timezone.now()
        ).order_by('-created_at').first()

        if not otp_record:
            return Response({'error': 'Invalid or expired OTP.'}, status=status.HTTP_400_BAD_REQUEST)

        otp_record.attempts += 1

        if otp_record.otp == otp_code:
            otp_record.is_verified = True
            otp_record.save()

            if user.email:
                user.is_email_verified = True
            if user.phone_number:
                user.is_phone_verified = True
            user.is_verified = True
            user.save()

            update_last_login(None, user)
            tokens = issue_tokens_for_user(user, request)

            required_fields = ['full_name']
            if user.email and not user.phone_number:
                required_fields.append('phone_number')
            elif user.phone_number and not user.email:
                required_fields.append('email')

            return Response({
                'status': 'Customer OTP verified successfully.',
                'access': tokens['access'],
                'refresh': tokens['refresh'],
                'user_id': str(user.id),
                'user': UserSerializer(user).data,
                'next_step': 'complete_profile',
                'required_fields': required_fields
            }, status=status.HTTP_200_OK)

        otp_record.save()
        return Response({'error': 'Incorrect OTP.'}, status=status.HTTP_400_BAD_REQUEST)


class CustomerCompleteProfileView(APIView):
    """
    Dedicated Customer API Endpoint: Complete Customer Profile
    POST /api/v1/customer/complete-profile/
    """
    def post(self, request):
        user_id = request.data.get('user_id')
        full_name = request.data.get('full_name')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')

        if not user_id:
            return Response({'error': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(id=user_id, role=CUSTOMER_ROLE).first()
        if not user:
            return Response({'error': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not full_name and not (first_name and last_name):
            return Response({'error': 'Full name is required for Customer profile.'}, status=status.HTTP_400_BAD_REQUEST)

        if full_name:
            parts = full_name.strip().split(' ', 1)
            user.first_name = parts[0]
            user.last_name = parts[1] if len(parts) > 1 else ''
        else:
            if first_name: user.first_name = first_name
            if last_name: user.last_name = last_name

        if email and not user.email:
            if User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE).exclude(id=user.id).exists():
                return Response({'error': 'This email is already in use by another customer.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email

        if phone_number and not user.phone_number:
            if User.objects.filter(phone_number=phone_number, role=CUSTOMER_ROLE).exclude(id=user.id).exists():
                return Response({'error': 'This phone number is already in use by another customer.'}, status=status.HTTP_400_BAD_REQUEST)
            user.phone_number = phone_number

        user.save()

        return Response({
            'status': 'Customer profile completed successfully.',
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class CustomerGoogleAuthView(APIView):
    """
    Dedicated Customer API Endpoint: Google Authentication for Customer
    POST /api/v1/customer/google-auth/
    """
    def post(self, request):
        token = request.data.get('token')
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')

        if token:
            try:
                import jwt
                decoded = jwt.decode(token, options={"verify_signature": False})
                email = decoded.get('email', email)
                first_name = decoded.get('given_name', first_name)
                last_name = decoded.get('family_name', last_name)
            except Exception:
                pass

        if not email:
            return Response({'error': 'Failed to extract email from Google auth payload.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(email__iexact=email, role=CUSTOMER_ROLE).first()

        if not user:
            other_user = User.objects.filter(email__iexact=email).first()
            if other_user:
                return Response({'error': 'User is not registered as Customer.'}, status=status.HTTP_400_BAD_REQUEST)

            base_uname = email.split('@')[0]
            temp_username = base_uname if not User.objects.filter(username=base_uname, role=CUSTOMER_ROLE).exists() else f"{base_uname}_{random.randint(100, 999)}"
            user = User.objects.create(
                username=temp_username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=CUSTOMER_ROLE,
                is_verified=True,
                is_email_verified=True
            )

        update_last_login(None, user)
        tokens = issue_tokens_for_user(user, request)

        return Response({
            'status': 'Customer Google authentication successful',
            'access': tokens['access'],
            'refresh': tokens['refresh'],
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)
