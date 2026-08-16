import random
import uuid
from pathlib import Path
from django.core.files.storage import default_storage
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from users.models import User
from users.serializers import UserSerializer
from .models import Driver, DriverDocument, DriverBankAccount, DriverEmergencyContact
from .serializers import (
    DriverSerializer,
    DriverDocumentSerializer,
    DriverBankAccountSerializer,
    DriverEmergencyContactSerializer
)


class DriverViewSet(viewsets.ModelViewSet):
    queryset = Driver.objects.all()
    serializer_class = DriverSerializer
    permission_classes = [permissions.AllowAny]

    @action(detail=False, methods=['get'])
    def onboarding_profile(self, request):
        phone_number = (request.query_params.get('phone_number') or '').replace(' ', '').replace('-', '')
        email = request.query_params.get('email')
        users = User.objects.filter(role=User.RoleChoices.DRIVER)
        user = users.filter(phone_number=phone_number).first() if phone_number else None
        if not user and email:
            user = users.filter(email__iexact=email).first()
        if not user:
            return Response({'error': 'Captain profile not found.'}, status=status.HTTP_404_NOT_FOUND)

        driver = Driver.objects.filter(user=user).first()
        vehicle = driver.vehicles.select_related('vehicle_type').first() if driver else None
        bank = driver.bank_accounts.filter(is_primary=True).first() if driver else None
        emergency = driver.emergency_contacts.first() if driver else None
        document_key_by_type = {
            DriverDocument.DocumentType.LICENSE: 'license',
            DriverDocument.DocumentType.RC: 'rc',
            DriverDocument.DocumentType.INSURANCE: 'insurance',
            DriverDocument.DocumentType.BACKGROUND_CHECK: 'aadhaar',
            DriverDocument.DocumentType.PERMIT: 'photo',
        }
        documents = {}
        if driver:
            for document in driver.documents.all():
                key = document_key_by_type.get(document.document_type)
                if key:
                    documents[key] = {
                        'name': Path(document.document_url).name,
                        'url': document.document_url,
                        'status': document.verification_status,
                    }

        completed_steps = []
        if user.first_name and user.last_name and user.email and user.date_of_birth:
            completed_steps.append(3)
        if vehicle:
            completed_steps.append(5)
        if len(documents) == 5:
            completed_steps.append(6)
        if bank:
            completed_steps.append(7)
        if emergency:
            completed_steps.append(8)

        return Response({
            'user': UserSerializer(user).data,
            'vehicle': {
                'category': vehicle.vehicle_type.name,
                'number': vehicle.registration_number,
                'model': vehicle.model,
            } if vehicle else None,
            'documents': documents,
            'bank': DriverBankAccountSerializer(bank).data if bank else None,
            'emergency_contact': DriverEmergencyContactSerializer(emergency).data if emergency else None,
            'completed_steps': completed_steps,
        })

    @action(detail=False, methods=['post'])
    def complete_captain_profile(self, request):
        phone_number = request.data.get('phone_number')
        email = request.data.get('email')
        first_name = request.data.get('first_name', 'Captain')
        last_name = request.data.get('last_name', '')
        username = request.data.get('username')
        gender = request.data.get('gender', 'Male')
        date_of_birth = request.data.get('date_of_birth')

        # Vehicle info
        vehicle_number = request.data.get('vehicle_number')
        vehicle_model = request.data.get('vehicle_model')
        vehicle_category = request.data.get('vehicle_category')

        # License info
        license_number = request.data.get('license_number')

        # Bank info
        account_holder_name = request.data.get('account_holder_name', f"{first_name} {last_name}".strip())
        account_number = request.data.get('account_number')
        ifsc_code = request.data.get('ifsc_code')
        bank_name = request.data.get('bank_name', 'HDFC Bank')

        # Emergency Contact info
        emergency_name = request.data.get('emergency_name')
        emergency_relation = request.data.get('emergency_relation')
        emergency_phone = request.data.get('emergency_phone')

        clean_phone = phone_number.replace(' ', '').replace('-', '') if phone_number else None

        # 1. Get or create User safely
        user = None
        if clean_phone:
            user = User.objects.filter(phone_number=clean_phone, role=User.RoleChoices.DRIVER).first()
        if not user and email:
            user = User.objects.filter(email__iexact=email, role=User.RoleChoices.DRIVER).first()

        if not user:
            base_uname = username or f"captain_{random.randint(1000, 9999)}"
            final_uname = base_uname
            if User.objects.filter(username=final_uname, role=User.RoleChoices.DRIVER).exists():
                final_uname = f"{base_uname}_{random.randint(100, 999)}"

            user = User.objects.create(
                username=final_uname,
                email=email if email and not User.objects.filter(email__iexact=email, role=User.RoleChoices.DRIVER).exists() else None,
                phone_number=clean_phone if clean_phone and not User.objects.filter(phone_number=clean_phone, role=User.RoleChoices.DRIVER).exists() else None,
                role=User.RoleChoices.DRIVER,
                first_name=first_name,
                last_name=last_name,
                gender=gender,
                date_of_birth=date_of_birth or None,
                is_verified=True,
                is_phone_verified=True
            )
        else:
            user.role = User.RoleChoices.DRIVER
            if first_name: user.first_name = first_name
            if last_name: user.last_name = last_name
            if gender: user.gender = gender
            if date_of_birth: user.date_of_birth = date_of_birth
            
            # Safe username update (ignore if taken by another user)
            if username and username != user.username:
                if not User.objects.filter(username=username, role=User.RoleChoices.DRIVER).exclude(id=user.id).exists():
                    user.username = username
            
            # Safe email update (ignore if taken by another user)
            if email and email != user.email:
                if not User.objects.filter(email__iexact=email, role=User.RoleChoices.DRIVER).exclude(id=user.id).exists():
                    user.email = email

            user.is_verified = True
            user.is_phone_verified = True
            user.save()

        # 2. Get or create Driver record safely
        driver = Driver.objects.filter(user=user).first()
        if not driver:
            final_lic = license_number or f"PENDING-{uuid.uuid4()}"
            if license_number and Driver.objects.filter(license_number=final_lic).exists():
                final_lic = f"DL-{random.randint(10000, 99999)}"

            driver = Driver.objects.create(
                user=user,
                license_number=final_lic,
                approval_status=Driver.ApprovalStatus.PENDING,
                availability_status=Driver.AvailabilityStatus.OFFLINE
            )
        else:
            if license_number:
                driver.license_number = license_number
            driver.save()

        # Store actual multipart files and persist their storage URLs.
        document_types = {
            'document_license': DriverDocument.DocumentType.LICENSE,
            'document_rc': DriverDocument.DocumentType.RC,
            'document_insurance': DriverDocument.DocumentType.INSURANCE,
            'document_aadhaar': DriverDocument.DocumentType.BACKGROUND_CHECK,
            'document_photo': DriverDocument.DocumentType.PERMIT,
        }
        for field_name, document_type in document_types.items():
            uploaded_file = request.FILES.get(field_name)
            if not uploaded_file:
                continue
            extension = Path(uploaded_file.name).suffix.lower()
            if extension not in {'.pdf', '.jpg', '.jpeg', '.png', '.webp'}:
                return Response({'error': f'Unsupported file type for {field_name}.'}, status=status.HTTP_400_BAD_REQUEST)
            if uploaded_file.size > 10 * 1024 * 1024:
                return Response({'error': f'{field_name} must be 10 MB or smaller.'}, status=status.HTTP_400_BAD_REQUEST)

            storage_path = default_storage.save(
                f'driver_documents/{driver.id}/{document_type}/{uploaded_file.name}',
                uploaded_file,
            )
            document_url = request.build_absolute_uri(default_storage.url(storage_path))
            DriverDocument.objects.update_or_create(
                driver=driver,
                document_type=document_type,
                defaults={
                    'document_url': document_url,
                    'verification_status': DriverDocument.VerificationStatus.PENDING,
                },
            )

        # 3. Bank details
        if account_number:
            DriverBankAccount.objects.update_or_create(
                driver=driver,
                account_number=account_number,
                defaults={
                    'account_holder_name': account_holder_name or f"{user.first_name} {user.last_name}".strip(),
                    'ifsc_code': ifsc_code or 'HDFC0001234',
                    'bank_name': bank_name or 'HDFC Bank',
                    'is_verified': True,
                    'is_primary': True
                }
            )

        # 4. Emergency contact
        if emergency_name and emergency_phone:
            DriverEmergencyContact.objects.update_or_create(
                driver=driver,
                name=emergency_name,
                defaults={
                    'relationship': emergency_relation or 'Family',
                    'phone_number': emergency_phone
                }
            )

        # 5. Vehicle details
        if vehicle_number:
            from vehicles.models import Vehicle, VehicleType
            vtype, _ = VehicleType.objects.get_or_create(
                name=vehicle_category,
                defaults={
                    'base_fare': 50.00,
                    'per_km_rate': 12.00,
                    'per_minute_rate': 2.00
                }
            )
            Vehicle.objects.update_or_create(
                registration_number=vehicle_number,
                defaults={
                    'driver': driver,
                    'vehicle_type': vtype,
                    'make': 'Maruti',
                    'model': vehicle_model or 'Swift Dzire',
                    'year': 2022,
                    'color': 'White',
                    'is_approved': True,
                    'is_active': True
                }
            )

        print(f"\n==========================================")
        print("[DJANGO BACKEND DRIVER SAVED TO DB]")
        print(f"Captain User ID: {user.id}")
        print(f"Driver ID: {driver.id}")
        print(f"Phone: {user.phone_number}")
        print(f"Vehicle: {vehicle_number}")
        print(f"==========================================\n")

        return Response({
            'status': 'Captain profile and driver details saved to database successfully.',
            'driver_id': str(driver.id),
            'user_id': str(user.id),
            'user': UserSerializer(user).data,
            'documents': DriverDocumentSerializer(driver.documents.all(), many=True).data,
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def toggle_availability(self, request, pk=None):
        driver = self.get_object()
        raw_status = request.data.get('status') or request.data.get('availability_status') or ''
        # Standardize title-case e.g. 'online' -> 'Online'
        new_status = raw_status.strip().title() if isinstance(raw_status, str) else raw_status
        from django.utils import timezone
        today = timezone.now().date()

        # Reset daily duty tracking if new date
        if driver.last_duty_reset_date != today:
            driver.daily_online_seconds = 0
            driver.last_duty_reset_date = today
            driver.last_online_start = None
            driver.save()

        # Enforce strict 12-Hour Daily Shift Limit (43,200 seconds = 12h)
        if new_status == Driver.AvailabilityStatus.ONLINE:
            # Check accumulated duty seconds for today
            if driver.daily_online_seconds >= 43200:
                driver.availability_status = Driver.AvailabilityStatus.OFFLINE
                driver.last_online_start = None
                driver.save()
                return Response({
                    'error': 'Daily 12-hour online shift limit reached for today. Maximum 12 hours online per day permitted. Please rest until tomorrow.',
                    'current_daily_online_seconds': 43200,
                    'max_duty_seconds': 43200
                }, status=status.HTTP_400_BAD_REQUEST)

            driver.last_online_start = timezone.now()
            driver.availability_status = Driver.AvailabilityStatus.ONLINE
            driver.save()
            return Response({
                'status': 'Driver availability set to Online',
                'current_daily_online_seconds': driver.get_current_daily_online_seconds(),
                'max_duty_seconds': 43200
            }, status=status.HTTP_200_OK)

        elif new_status == Driver.AvailabilityStatus.OFFLINE:
            if driver.last_online_start:
                midnight_today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
                effective_start = max(driver.last_online_start, midnight_today)
                elapsed = int((timezone.now() - effective_start).total_seconds())
                driver.daily_online_seconds = min(43200, driver.daily_online_seconds + max(0, elapsed))
                driver.last_online_start = None

            driver.availability_status = Driver.AvailabilityStatus.OFFLINE
            driver.save()
            return Response({
                'status': 'Driver availability set to Offline',
                'current_daily_online_seconds': driver.get_current_daily_online_seconds(),
                'max_duty_seconds': 43200
            }, status=status.HTTP_200_OK)

        if new_status in [choice[0] for choice in Driver.AvailabilityStatus.choices]:
            driver.availability_status = new_status
            driver.save()
            return Response({'status': f'Driver availability set to {new_status}'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid availability status'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_approval(self, request, pk=None):
        driver = self.get_object()
        new_status = request.data.get('status')
        if new_status in [choice[0] for choice in Driver.ApprovalStatus.choices]:
            driver.approval_status = new_status
            driver.save()
            return Response({'status': f'Driver approval status updated to {new_status}'}, status=status.HTTP_200_OK)
        return Response({'error': 'Invalid approval status'}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def update_location(self, request, pk=None):
        driver = self.get_object()
        latitude = request.data.get('latitude')
        longitude = request.data.get('longitude')

        if latitude is not None and longitude is not None:
            from django.utils import timezone
            from tracking.models import DriverLocation

            today = timezone.now().date()
            if driver.last_duty_reset_date != today:
                driver.daily_online_seconds = 0
                driver.last_duty_reset_date = today

            current_duty_sec = driver.get_current_daily_online_seconds()

            # Auto force OFFLINE if 12 hours reached
            if current_duty_sec >= 43200 and driver.availability_status == Driver.AvailabilityStatus.ONLINE:
                driver.availability_status = Driver.AvailabilityStatus.OFFLINE

            lat_val = round(float(latitude), 7)
            lng_val = round(float(longitude), 7)

            driver.current_latitude = lat_val
            driver.current_longitude = lng_val
            driver.last_location_update = timezone.now()
            driver.save()

            # Save in DriverLocation database table
            loc_obj, created = DriverLocation.objects.update_or_create(
                driver=driver,
                defaults={
                    'latitude': lat_val,
                    'longitude': lng_val,
                    'is_online': (driver.availability_status == Driver.AvailabilityStatus.ONLINE or driver.availability_status == Driver.AvailabilityStatus.IN_TRIP),
                    'heading': request.data.get('heading', 0.0),
                    'speed': request.data.get('speed', 0.0)
                }
            )

            return Response({
                'status': 'Driver GPS location updated and saved to DriverLocation table successfully',
                'driver_id': str(driver.id),
                'latitude': driver.current_latitude,
                'longitude': driver.current_longitude,
                'is_online': loc_obj.is_online,
                'current_daily_online_seconds': current_duty_sec,
                'max_duty_seconds': 43200,
                'updated_at': driver.last_location_update
            }, status=status.HTTP_200_OK)
        return Response({'error': 'latitude and longitude are required'}, status=status.HTTP_400_BAD_REQUEST)


class DriverDocumentViewSet(viewsets.ModelViewSet):
    queryset = DriverDocument.objects.all()
    serializer_class = DriverDocumentSerializer


class DriverBankAccountViewSet(viewsets.ModelViewSet):
    queryset = DriverBankAccount.objects.all()
    serializer_class = DriverBankAccountSerializer


class DriverEmergencyContactViewSet(viewsets.ModelViewSet):
    queryset = DriverEmergencyContact.objects.all()
    serializer_class = DriverEmergencyContactSerializer
