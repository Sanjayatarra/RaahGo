import random
from django.utils import timezone
from datetime import timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from django.core.mail import send_mail
from django.conf import settings
from .models import User, UserAddress, OTPVerification, UserDevice
from .serializers import (
    UserSerializer,
    UserAddressSerializer,
    OTPVerificationSerializer,
    UserDeviceSerializer
)


def get_target_role(request):
    """
    Determines the target user role for authentication/registration.
    Checks explicit 'role' in request payload, then HTTP headers (Origin/Referer)
    for port 5175 (Driver) vs 5173 (Customer).
    """
    role = request.data.get('role')
    valid_roles = [choice[0] for choice in User.RoleChoices.choices]
    if role and role in valid_roles:
        return role

    origin = request.META.get('HTTP_ORIGIN', '') or request.META.get('HTTP_REFERER', '')
    if '5175' in origin:
        return User.RoleChoices.DRIVER
    elif '5173' in origin:
        return User.RoleChoices.CUSTOMER

    return User.RoleChoices.CUSTOMER


def send_otp_email(email, otp_code):
    if email and getattr(settings, 'EMAIL_HOST_USER', None):
        try:
            send_mail(
                subject='RaahGo - Your Verification OTP Code',
                message=f'Your RaahGo verification OTP code is: {otp_code}\n\nThis code is valid for 10 minutes.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            print(f"[SUCCESS] OTP Email sent successfully to {email}")
        except Exception as e:
            print(f"[ERROR] Failed to send OTP email to {email}: {e}")


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    def get_queryset(self):
        queryset = self.queryset
        phone_number = self.request.query_params.get('phone_number')
        email = self.request.query_params.get('email')
        if phone_number:
            queryset = queryset.filter(phone_number=phone_number)
        if email:
            queryset = queryset.filter(email__iexact=email)
        return queryset

    @action(detail=True, methods=['patch'])
    def verify(self, request, pk=None):
        user = self.get_object()
        user.is_verified = True
        user.is_phone_verified = True
        user.save()
        return Response({'status': 'User verified successfully'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def signup(self, request):
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')
        role = get_target_role(request)

        if not email and not phone_number:
            return Response(
                {'error': 'Either email or phone_number is required for signup.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check existing verified users for this role
        if email and User.objects.filter(email__iexact=email, role=role, is_verified=True).exists():
            return Response({'error': f'User with this email already exists and is verified as {role}. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)
        if phone_number and User.objects.filter(phone_number=phone_number, role=role, is_verified=True).exists():
            return Response({'error': f'User with this phone number already exists and is verified as {role}. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)

        # Re-use or create user record for this role
        user = None
        if email:
            user = User.objects.filter(email__iexact=email, role=role, is_verified=False).first()
        elif phone_number:
            user = User.objects.filter(phone_number=phone_number, role=role, is_verified=False).first()

        if not user:
            temp_username = f"user_{random.randint(100000, 999999)}"
            user = User.objects.create(
                username=temp_username,
                email=email if email else None,
                phone_number=phone_number if phone_number else None,
                role=role,
                is_verified=False
            )

        # Generate OTP
        otp_code = f"{random.randint(1000, 9999)}"
        expires_at = timezone.now() + timedelta(minutes=10)

        otp_record = OTPVerification.objects.create(
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
            'status': 'Signup initiated. OTP sent successfully.',
            'user_id': str(user.id),
            'target': email or phone_number,
            'otp': otp_code,  # Included for testing/development
            'next_step': 'verify_signup_otp'
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def verify_signup_otp(self, request):
        user_id = request.data.get('user_id')
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')
        otp_code = request.data.get('otp')
        target_role = get_target_role(request)

        if not otp_code or not (user_id or email or phone_number):
            return Response(
                {'error': 'OTP code and user_id (or email/phone_number) are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Query user
        user = None
        if user_id:
            user = User.objects.filter(id=user_id, role=target_role).first()
        elif email:
            user = User.objects.filter(email__iexact=email, role=target_role).first()
        elif phone_number:
            user = User.objects.filter(phone_number=phone_number, role=target_role).first()

        if not user:
            return Response({'error': f'User not found for role {target_role}.'}, status=status.HTTP_404_NOT_FOUND)

        # Lookup OTP
        otp_query = OTPVerification.objects.filter(
            user=user,
            is_verified=False,
            expires_at__gte=timezone.now()
        )
        otp_record = otp_query.order_by('-created_at').first()

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

            from django.contrib.auth.models import update_last_login
            update_last_login(None, user)

            required_fields = []
            if user.role == User.RoleChoices.CUSTOMER:
                required_fields.append('full_name')
                if user.email and not user.phone_number:
                    required_fields.append('phone_number')
                elif user.phone_number and not user.email:
                    required_fields.append('email')

            refresh = RefreshToken.for_user(user)

            return Response({
                'status': 'OTP verified successfully.',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user_id': str(user.id),
                'user': UserSerializer(user).data,
                'next_step': 'complete_profile',
                'required_fields': required_fields
            }, status=status.HTTP_200_OK)

        otp_record.save()
        return Response({'error': 'Incorrect OTP.'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def complete_profile(self, request):
        user_id = request.data.get('user_id')
        full_name = request.data.get('full_name')
        first_name = request.data.get('first_name')
        last_name = request.data.get('last_name')
        email = request.data.get('email')
        phone_number = request.data.get('phone_number')
        password = request.data.get('password')
        gender = request.data.get('gender')
        date_of_birth = request.data.get('date_of_birth')
        profile_image = request.data.get('profile_image')

        if not user_id:
            return Response({'error': 'user_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(id=user_id).first()
        if not user:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        if not user.is_verified:
            return Response({'error': 'Please verify OTP before completing profile.'}, status=status.HTTP_400_BAD_REQUEST)

        # Validate Customer profile requirements
        if user.role == User.RoleChoices.CUSTOMER:
            if not full_name and not (first_name and last_name):
                return Response(
                    {'error': 'Full name (or first_name & last_name) is required for Customer profile.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if user.email and not user.phone_number and not phone_number:
                return Response(
                    {'error': 'Phone number is required since you signed up with Email.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if user.phone_number and not user.email and not email:
                return Response(
                    {'error': 'Email is required since you signed up with Phone Number.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        # Process names
        if full_name:
            name_parts = full_name.strip().split(' ', 1)
            user.first_name = name_parts[0]
            user.last_name = name_parts[1] if len(name_parts) > 1 else ''
        else:
            if first_name:
                user.first_name = first_name
            if last_name:
                user.last_name = last_name

        # Process missing email or phone
        if email and not user.email:
            if User.objects.filter(email__iexact=email, role=user.role).exclude(id=user.id).exists():
                return Response({'error': 'This email is already in use by another user.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = email
        if phone_number and not user.phone_number:
            if User.objects.filter(phone_number=phone_number, role=user.role).exclude(id=user.id).exists():
                return Response({'error': 'This phone number is already in use by another user.'}, status=status.HTTP_400_BAD_REQUEST)
            user.phone_number = phone_number

        # Update username if auto-generated
        if user.email and (not user.username or user.username.startswith('user_')):
            base_uname = user.email.split('@')[0]
            user.username = base_uname if not User.objects.filter(username=base_uname, role=user.role).exclude(id=user.id).exists() else f"{base_uname}_{random.randint(100, 999)}"

        if password:
            user.password = password
        if gender:
            user.gender = gender
        if date_of_birth:
            user.date_of_birth = date_of_birth
        if profile_image:
            user.profile_image = profile_image

        user.save()

        serializer = UserSerializer(user)
        return Response({
            'status': 'Profile completed successfully.',
            'user': serializer.data
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['post'])
    def google_auth(self, request):
        token = request.data.get('token')
        target_role = get_target_role(request)
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

        # Check if user exists for target_role
        user = User.objects.filter(email__iexact=email, role=target_role).first()

        if not user:
            # Check if user exists under a DIFFERENT role
            other_user = User.objects.filter(email__iexact=email).first()
            if other_user:
                return Response({
                    'error': f'user not not register'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Auto-create user for target_role via Google Auth
            base_uname = email.split('@')[0]
            temp_username = base_uname if not User.objects.filter(username=base_uname, role=target_role).exists() else f"{base_uname}_{random.randint(100, 999)}"
            user = User.objects.create(
                username=temp_username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                role=target_role,
                is_verified=True,
                is_email_verified=True
            )

        from django.contrib.auth.models import update_last_login
        update_last_login(None, user)

        refresh = RefreshToken.for_user(user)

        return Response({
            'status': 'Google authentication successful',
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class UserAddressViewSet(viewsets.ModelViewSet):
    queryset = UserAddress.objects.all()
    serializer_class = UserAddressSerializer

    def get_queryset(self):
        user_id = self.request.query_params.get('user_id')
        if user_id:
            return self.queryset.filter(user_id=user_id)
        return self.queryset

    @action(detail=True, methods=['post'])
    def set_default(self, request, pk=None):
        address = self.get_object()
        UserAddress.objects.filter(user=address.user).update(is_default=False)
        address.is_default = True
        address.save()
        return Response({'status': 'Set as default address'}, status=status.HTTP_200_OK)


class OTPVerificationViewSet(viewsets.ModelViewSet):
    queryset = OTPVerification.objects.all()
    serializer_class = OTPVerificationSerializer

    @action(detail=False, methods=['post'])
    def send_otp(self, request):
        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        purpose = request.data.get('purpose', 'Login')
        user_id = request.data.get('user_id')
        target_role = get_target_role(request)

        if not phone_number and not email:
            return Response({'error': 'Either phone_number or email is required'}, status=status.HTTP_400_BAD_REQUEST)

        if purpose == 'Login':
            role_user = None
            if phone_number:
                role_user = User.objects.filter(phone_number=phone_number, role=target_role).first()
            elif email:
                role_user = User.objects.filter(email__iexact=email, role=target_role).first()

            if not role_user:
                # Check if registered under a different role
                other_user = None
                if phone_number:
                    other_user = User.objects.filter(phone_number=phone_number).first()
                elif email:
                    other_user = User.objects.filter(email__iexact=email).first()

                if other_user:
                    return Response({
                        'error': f'user not registerd.'
                    }, status=status.HTTP_400_BAD_REQUEST)
                else:
                    return Response({'error': 'User is not registered. Please sign up first.'}, status=status.HTTP_400_BAD_REQUEST)

        if purpose == 'Register':
            if phone_number and User.objects.filter(phone_number=phone_number, role=target_role, is_verified=True).exists():
                return Response({'error': f'User is already registered as {target_role}. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)
            if email and User.objects.filter(email__iexact=email, role=target_role, is_verified=True).exists():
                return Response({'error': f'User is already registered as {target_role}. Please log in.'}, status=status.HTTP_400_BAD_REQUEST)

        # Get existing user instance for target_role if present
        associated_user = None
        if phone_number:
            associated_user = User.objects.filter(phone_number=phone_number, role=target_role).first()
        elif email:
            associated_user = User.objects.filter(email__iexact=email, role=target_role).first()

        otp_code = f"{random.randint(1000, 9999)}"
        expires_at = timezone.now() + timedelta(minutes=10)

        otp_record = OTPVerification.objects.create(
            phone_number=phone_number if phone_number else None,
            email=email if email else None,
            user=associated_user or (User.objects.filter(id=user_id).first() if user_id else None),
            otp=otp_code,
            purpose=purpose,
            expires_at=expires_at
        )

        print(f"\n==========================================")
        print(f"🔑 [DJANGO BACKEND OTP GENERATED]")
        print(f"Target: {email or phone_number} | Role: {target_role}")
        print(f"Purpose: {purpose}")
        print(f"OTP Code: {otp_code}")
        print(f"==========================================\n")

        if email:
            send_otp_email(email, otp_code)

        return Response({
            'status': 'OTP sent successfully',
            'otp_id': otp_record.id,
            'target': email or phone_number,
            'otp': otp_code  # Exposing for testing/dev ease
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def verify_otp(self, request):
        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        otp_code = request.data.get('otp')
        target_role = get_target_role(request)

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
            user = otp_record.user

            # Look up user specifically with target_role
            role_user = None
            if email:
                role_user = User.objects.filter(email__iexact=email, role=target_role).first()
            elif phone_number:
                role_user = User.objects.filter(phone_number=phone_number, role=target_role).first()

            if role_user:
                user = role_user
            elif user and user.role != target_role:
                return Response({
                    'error': f'user not registered'
                }, status=status.HTTP_400_BAD_REQUEST)
            elif not user:
                other_user = None
                if email:
                    other_user = User.objects.filter(email__iexact=email).first()
                elif phone_number:
                    other_user = User.objects.filter(phone_number=phone_number).first()

                if other_user and other_user.role != target_role:
                    return Response({
                        'error': f'user not registered'
                    }, status=status.HTTP_400_BAD_REQUEST)

                temp_username = f"user_{random.randint(100000, 999999)}"
                user = User.objects.create(
                    username=temp_username,
                    email=email if email else None,
                    phone_number=phone_number if phone_number else None,
                    role=target_role,
                    is_verified=True
                )

            if email:
                user.is_email_verified = True
            if phone_number:
                user.is_phone_verified = True
            user.is_verified = True
            user.save()

            from django.contrib.auth.models import update_last_login
            update_last_login(None, user)

            refresh = RefreshToken.for_user(user)

            return Response({
                'status': 'OTP verified successfully',
                'access': str(refresh.access_token),
                'refresh': str(refresh),
                'user': UserSerializer(user).data
            }, status=status.HTTP_200_OK)

        otp_record.save()
        return Response({'error': 'Incorrect OTP'}, status=status.HTTP_400_BAD_REQUEST)


class UserDeviceViewSet(viewsets.ModelViewSet):
    queryset = UserDevice.objects.all()
    serializer_class = UserDeviceSerializer
