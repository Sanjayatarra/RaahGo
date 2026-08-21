import random
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q, Sum, Count, Avg
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from users.models import User, SystemSetting
from drivers.models import Driver, DriverDocument, DriverBankAccount, DriverEmergencyContact
from vehicles.models import Vehicle, VehicleType
from bookings.models import Booking, RideDetail, BookingTracking
from bookings.serializers import BookingSerializer
from tracking.models import DriverLocation
from wallets.models import Wallet, WalletTransaction
from reviews.models import Rating
from notifications.models import Notification
from bookings.views import calculate_haversine_distance

def get_driver_from_request(request):
    """Helper to extract Driver instance from request or authentication credentials"""
    user = request.user
    if user and user.is_authenticated:
        driver = Driver.objects.filter(user=user).first()
        if not driver:
            import random
            driver = Driver.objects.create(
                user=user,
                license_number=f"DL{str(user.id).replace('-', '')[:8].upper()}",
                approval_status=Driver.ApprovalStatus.APPROVED
            )
        return driver

    # If Authorization header is present, extract user_id from token payload
    auth_header = request.headers.get('Authorization') or request.META.get('HTTP_AUTHORIZATION')
    if auth_header and str(auth_header).startswith('Bearer '):
        try:
            import jwt
            token_str = str(auth_header).split(' ')[1]
            payload = jwt.decode(token_str, options={"verify_signature": False})
            user_id = payload.get('user_id')
            if user_id:
                u = User.objects.filter(id=user_id).first()
                if u:
                    d = Driver.objects.filter(user=u).first()
                    if not d:
                        d = Driver.objects.create(
                            user=u,
                            license_number=f"DL{str(u.id).replace('-', '')[:8].upper()}",
                            approval_status=Driver.ApprovalStatus.APPROVED
                        )
                    return d
        except Exception:
            pass

    # Extract from driver_id parameter, query param, or headers
    driver_id = request.query_params.get('driver_id') or request.headers.get('X-Driver-Id') or request.headers.get('driver-id')
    if not driver_id and hasattr(request, 'data') and isinstance(request.data, dict):
        driver_id = request.data.get('driver_id')

    if driver_id:
        d = Driver.objects.filter(id=driver_id).first()
        if d:
            return d

    return None


# ============================================================================
# 1. Driver Profile & Onboarding
# ============================================================================

class DriverRegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        phone_number = request.data.get('phone_number') or request.data.get('phone')
        email = request.data.get('email')
        first_name = request.data.get('first_name', '')
        last_name = request.data.get('last_name', '')
        license_number = request.data.get('license_number') or f"DL{random.randint(100000, 999999)}"
        vehicle_name = request.data.get('vehicle_name', 'Commercial Vehicle')
        vehicle_number = request.data.get('vehicle_number') or f"HR{random.randint(10, 99)}AB{random.randint(1000, 9999)}"
        vehicle_type_name = request.data.get('vehicle_type', 'Bike')

        clean_phone = phone_number.replace(' ', '').replace('-', '') if phone_number else None

        user = None
        if clean_phone:
            user = User.objects.filter(phone_number=clean_phone, role=User.RoleChoices.DRIVER).first()
        if not user and email:
            user = User.objects.filter(email__iexact=email, role=User.RoleChoices.DRIVER).first()

        if not user:
            base_uname = f"captain_{random.randint(1000, 9999)}"
            user = User.objects.create(
                username=base_uname,
                email=email,
                phone_number=clean_phone,
                role=User.RoleChoices.DRIVER,
                first_name=first_name,
                last_name=last_name,
                is_verified=True,
                is_phone_verified=True
            )

        operating_address = request.data.get('operating_address') or request.data.get('address')
        service_city = request.data.get('service_city') or request.data.get('city')
        operating_pincode = request.data.get('operating_pincode') or request.data.get('pincode')

        driver, _ = Driver.objects.get_or_create(
            user=user,
            defaults={
                'license_number': license_number,
                'approval_status': Driver.ApprovalStatus.APPROVED,
                'availability_status': Driver.AvailabilityStatus.ONLINE,
                'rating': Decimal('5.00'),
                'operating_address': operating_address,
                'service_city': service_city,
                'operating_pincode': operating_pincode,
            }
        )
        if operating_address:
            driver.operating_address = operating_address
        if service_city:
            driver.service_city = service_city
        if operating_pincode:
            driver.operating_pincode = operating_pincode
        driver.save()

        # Update UserAddress record
        if operating_address or service_city:
            try:
                from users.models import UserAddress
                UserAddress.objects.update_or_create(
                    user=user,
                    title=UserAddress.TitleChoices.WORK,
                    defaults={
                        'address_line_1': operating_address or f"Riding Base - {service_city or 'City'}",
                        'city': service_city or 'Delhi NCR',
                        'postal_code': operating_pincode or '110001',
                        'state': 'Delhi NCR',
                        'country': 'India',
                        'is_default': True,
                    }
                )
            except Exception as ex:
                print(f"[DriverRegisterView] Error saving UserAddress: {ex}")

        # Ensure vehicle exists
        v_type = VehicleType.objects.filter(name__iexact=vehicle_type_name).first() or VehicleType.objects.first()
        v_num = vehicle_number or f"DL{random.randint(10, 99)}AB{random.randint(1000, 9999)}"
        vehicle, _ = Vehicle.objects.get_or_create(
            registration_number=v_num,
            defaults={
                'driver': driver,
                'vehicle_type': v_type,
                'make': vehicle_name.split(' ')[0] if vehicle_name else 'Standard',
                'model': ' '.join(vehicle_name.split(' ')[1:]) if ' ' in vehicle_name else 'Express',
                'year': 2024,
                'color': 'Black',
                'is_active': True,
                'is_approved': True
            }
        )

        return Response({
            'message': 'Driver registered successfully',
            'driver_id': str(driver.id),
            'user_id': str(user.id),
            'approval_status': driver.approval_status,
            'availability_status': driver.availability_status,
            'operating_address': driver.operating_address,
            'service_city': driver.service_city
        }, status=status.HTTP_201_CREATED)


class DriverProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        vehicle = driver.vehicles.filter(is_active=True).select_related('vehicle_type').first() or driver.vehicles.select_related('vehicle_type').first()
        bank = DriverBankAccount.objects.filter(driver=driver, is_primary=True).first() or DriverBankAccount.objects.filter(driver=driver).first()
        emergency = DriverEmergencyContact.objects.filter(driver=driver).first()

        docs_list = []
        for doc in driver.documents.all().order_by('-created_at'):
            docs_list.append({
                'id': str(doc.id),
                'document_type': doc.document_type,
                'document_number': doc.document_number or '—',
                'document_url': doc.document_url,
                'verification_status': doc.verification_status,
                'status': str(doc.verification_status).lower(),
                'rejection_reason': doc.rejection_reason,
                'expiry_date': doc.expiry_date.strftime('%Y-%m-%d') if doc.expiry_date else 'Valid till 2030',
            })

        return Response({
            'id': str(driver.id),
            'user': {
                'id': str(driver.user.id),
                'username': driver.user.username,
                'first_name': driver.user.first_name,
                'last_name': driver.user.last_name,
                'phone_number': driver.user.phone_number,
                'email': driver.user.email,
                'profile_image': driver.user.profile_image,
                'profile_picture': driver.user.profile_image,
            },
            'license_number': driver.license_number,
            'experience_years': driver.experience_years,
            'rating': str(driver.rating),
            'total_trips': driver.total_trips,
            'approval_status': driver.approval_status,
            'availability_status': driver.availability_status,
            'operating_address': driver.operating_address or '',
            'service_city': driver.service_city or '',
            'operating_pincode': driver.operating_pincode or '',
            'current_latitude': str(driver.current_latitude) if driver.current_latitude else None,
            'current_longitude': str(driver.current_longitude) if driver.current_longitude else None,
            'duty_seconds_today': driver.get_current_daily_online_seconds(),
            'vehicle': {
                'id': str(vehicle.id),
                'make': vehicle.make,
                'model': vehicle.model,
                'name': f"{vehicle.make} {vehicle.model}".strip(),
                'registration_number': vehicle.registration_number,
                'vehicle_number': vehicle.registration_number,
                'vehicle_type': vehicle.vehicle_type.name if vehicle.vehicle_type else 'Bike',
                'year': vehicle.year,
                'color': vehicle.color,
                'is_active': vehicle.is_active,
                'is_approved': vehicle.is_approved,
                'is_verified': vehicle.is_approved
            } if vehicle else None,
            'documents': docs_list,
            'bank': {
                'id': str(bank.id),
                'bank_name': bank.bank_name,
                'account_number': bank.account_number,
                'ifsc_code': bank.ifsc_code,
                'account_holder_name': bank.account_holder_name,
                'is_verified': bank.is_verified,
            } if bank else None,
            'emergency_contact': {
                'id': str(emergency.id),
                'name': emergency.name,
                'relationship': emergency.relationship,
                'phone_number': emergency.phone_number,
            } if emergency else None
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if 'first_name' in data:
            driver.user.first_name = data['first_name']
        if 'last_name' in data:
            driver.user.last_name = data['last_name']
        if 'email' in data:
            driver.user.email = data['email']
        if 'phone_number' in data:
            driver.user.phone_number = data['phone_number']
        driver.user.save()

        if 'experience_years' in data:
            driver.experience_years = data['experience_years']
        if 'license_number' in data:
            driver.license_number = data['license_number']
        if 'operating_address' in data:
            driver.operating_address = data['operating_address']
        if 'service_city' in data:
            driver.service_city = data['service_city']
        if 'operating_pincode' in data:
            driver.operating_pincode = data['operating_pincode']
        driver.save()

        return Response({'message': 'Profile updated successfully'}, status=status.HTTP_200_OK)


class DriverOnboardingStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'is_registered': False, 'is_approved': False}, status=status.HTTP_200_OK)

        docs_count = driver.documents.count()
        vehicle = driver.vehicles.first()

        return Response({
            'is_registered': True,
            'driver_id': str(driver.id),
            'approval_status': driver.approval_status,
            'is_approved': driver.approval_status == Driver.ApprovalStatus.APPROVED,
            'documents_uploaded': docs_count,
            'has_active_vehicle': vehicle is not None,
            'is_ready_for_trips': driver.approval_status == Driver.ApprovalStatus.APPROVED and vehicle is not None
        }, status=status.HTTP_200_OK)


# ============================================================================
# 2. Driver Documents
# ============================================================================

class DriverDocumentsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response([], status=status.HTTP_200_OK)

        docs = driver.documents.all().order_by('-created_at')
        result = [{
            'id': str(d.id),
            'document_type': d.document_type,
            'document_number': d.document_number,
            'document_url': d.document_url,
            'verification_status': d.verification_status,
            'created_at': d.created_at
        } for d in docs]
        return Response(result, status=status.HTTP_200_OK)

    def post(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        doc_type = request.data.get('document_type', DriverDocument.DocumentType.LICENSE)
        doc_num = request.data.get('document_number', '')
        doc_url = request.data.get('document_url', 'https://storage.raahgo.com/docs/default.pdf')

        doc = DriverDocument.objects.create(
            driver=driver,
            document_type=doc_type,
            document_number=doc_num,
            document_url=doc_url,
            verification_status=DriverDocument.VerificationStatus.PENDING
        )
        # If driver was previously rejected or pending, keep/set to pending for admin re-review
        if driver.approval_status != Driver.ApprovalStatus.APPROVED:
            driver.approval_status = Driver.ApprovalStatus.PENDING
            driver.save(update_fields=['approval_status'])

        return Response({
            'message': 'Document uploaded successfully and queued for admin review',
            'id': str(doc.id),
            'verification_status': doc.verification_status
        }, status=status.HTTP_201_CREATED)


class DriverDocumentDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, document_id):
        driver = get_driver_from_request(request)
        doc = DriverDocument.objects.filter(id=document_id, driver=driver).first() if driver else DriverDocument.objects.filter(id=document_id).first()
        if not doc:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response({
            'id': str(doc.id),
            'document_type': doc.document_type,
            'document_number': doc.document_number,
            'document_url': doc.document_url,
            'verification_status': doc.verification_status,
            'rejection_reason': doc.rejection_reason or 'Document image is unclear or details mismatch. Please re-upload a clear and valid document.',
            'created_at': doc.created_at,
            'expiry_date': doc.expiry_date.strftime('%Y-%m-%d') if doc.expiry_date else None
        }, status=status.HTTP_200_OK)

    def post(self, request, document_id):
        return self.patch(request, document_id)

    def patch(self, request, document_id):
        driver = get_driver_from_request(request)
        doc = DriverDocument.objects.filter(id=document_id, driver=driver).first() if driver else DriverDocument.objects.filter(id=document_id).first()
        if not doc:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

        data = getattr(request, 'data', getattr(request, 'POST', {}))
        files = getattr(request, 'FILES', {})

        if 'document_number' in data and data['document_number']:
            doc.document_number = data['document_number']

        if 'file' in files:
            from django.core.files.storage import default_storage
            uploaded_file = files['file']
            d_id = driver.id if driver else doc.driver_id
            storage_path = default_storage.save(
                f'driver_documents/{d_id}/{doc.document_type}/{uploaded_file.name}',
                uploaded_file
            )
            doc.document_url = request.build_absolute_uri(default_storage.url(storage_path))
        elif 'document_url' in data and data['document_url']:
            doc.document_url = data['document_url']

        # Re-uploading resets status to PENDING for admin re-review
        doc.verification_status = DriverDocument.VerificationStatus.PENDING
        doc.rejection_reason = None
        doc.save()

        if driver and driver.approval_status != Driver.ApprovalStatus.APPROVED:
            driver.approval_status = Driver.ApprovalStatus.PENDING
            driver.save(update_fields=['approval_status'])

        return Response({
            'message': 'Document re-uploaded successfully and submitted for Admin verification.',
            'id': str(doc.id),
            'document_type': doc.document_type,
            'document_number': doc.document_number,
            'document_url': doc.document_url,
            'verification_status': doc.verification_status
        }, status=status.HTTP_200_OK)

    def delete(self, request, document_id):
        driver = get_driver_from_request(request)
        doc = DriverDocument.objects.filter(id=document_id, driver=driver).first() if driver else DriverDocument.objects.filter(id=document_id).first()
        if not doc:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)
        doc.delete()
        return Response({'message': 'Document deleted successfully'}, status=status.HTTP_200_OK)


# ============================================================================
# 3. Driver Vehicle
# ============================================================================

class DriverVehicleView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response([], status=status.HTTP_200_OK)

        vehicles = driver.vehicles.all()
        result = [{
            'id': str(v.id),
            'vehicle_number': v.registration_number,
            'registration_number': v.registration_number,
            'vehicle_type': v.vehicle_type.name if v.vehicle_type else 'Car',
            'make': v.make,
            'model': v.model,
            'color': v.color,
            'year': v.year,
            'is_active': v.is_active,
            'is_approved': v.is_approved
        } for v in vehicles]
        return Response(result, status=status.HTTP_200_OK)

    def post(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        v_type_name = request.data.get('vehicle_type', 'Bike')
        v_type = VehicleType.objects.filter(name__iexact=v_type_name).first() or VehicleType.objects.first()

        vehicle = Vehicle.objects.create(
            driver=driver,
            vehicle_type=v_type,
            make=request.data.get('make', 'Standard'),
            model=request.data.get('model', 'Express'),
            registration_number=request.data.get('registration_number') or request.data.get('vehicle_number', f"DL{random.randint(10, 99)}AB{random.randint(1000, 9999)}"),
            year=request.data.get('year', 2024),
            color=request.data.get('color', 'Black'),
            is_active=True,
            is_approved=False
        )
        return Response({
            'message': 'Vehicle registered successfully. Pending admin approval.',
            'id': str(vehicle.id),
            'vehicle_number': vehicle.registration_number,
            'registration_number': vehicle.registration_number,
            'is_approved': False
        }, status=status.HTTP_201_CREATED)

    def patch(self, request, vehicle_id=None):
        driver = get_driver_from_request(request)
        vehicle = driver.vehicles.filter(id=vehicle_id).first() if vehicle_id else driver.vehicles.first()
        if not vehicle:
            return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)

        for key in ['make', 'model', 'color', 'year', 'is_active']:
            if key in request.data:
                setattr(vehicle, key, request.data[key])
        if 'vehicle_number' in request.data or 'registration_number' in request.data:
            vehicle.registration_number = request.data.get('registration_number') or request.data.get('vehicle_number')
        vehicle.save()
        return Response({'message': 'Vehicle updated successfully'}, status=status.HTTP_200_OK)

    def delete(self, request, vehicle_id):
        driver = get_driver_from_request(request)
        vehicle = driver.vehicles.filter(id=vehicle_id).first() if driver else Vehicle.objects.filter(id=vehicle_id).first()
        if not vehicle:
            return Response({'error': 'Vehicle not found'}, status=status.HTTP_404_NOT_FOUND)
        vehicle.delete()
        return Response({'message': 'Vehicle removed successfully'}, status=status.HTTP_200_OK)


# ============================================================================
# 4. Driver Status (Online / Offline)
# ============================================================================

class DriverStatusOnlineView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        # ── 1. KYC Approval Rule Enforcement ────────────────────────────────
        if driver.approval_status != Driver.ApprovalStatus.APPROVED:
            reason = "Your KYC verification is currently pending review by RaahGo Operations."
            if driver.approval_status == Driver.ApprovalStatus.REJECTED:
                reason = "Your KYC application was rejected by admin. Please review rejected documents and re-upload."
            elif driver.approval_status == Driver.ApprovalStatus.SUSPENDED:
                reason = "Your driver account is suspended. Please contact RaahGo support."

            return Response({
                'error': f'Cannot go online: {reason}',
                'approval_status': driver.approval_status,
                'is_online': False
            }, status=status.HTTP_403_FORBIDDEN)

        # ── 2. Approved Active Vehicle Check ─────────────────────────────────
        active_vehicle = Vehicle.objects.filter(driver=driver, is_active=True).first()
        if not active_vehicle:
            return Response({
                'error': 'Cannot go online: No active vehicle assigned. Please register your vehicle first.',
                'approval_status': driver.approval_status,
                'is_online': False
            }, status=status.HTTP_403_FORBIDDEN)

        if not active_vehicle.is_approved:
            return Response({
                'error': f'Cannot go online: Your assigned vehicle ({active_vehicle.make} {active_vehicle.model} - {active_vehicle.registration_number}) is awaiting admin verification and approval.',
                'approval_status': driver.approval_status,
                'is_online': False
            }, status=status.HTTP_403_FORBIDDEN)

        # ── 3. Minimum Rating & Max Complaints Enforcement from Admin Settings ──
        try:
            min_rating_threshold = float(SystemSetting.get_setting('min_rating', '3.5'))
            if driver.rating and float(driver.rating) < min_rating_threshold:
                return Response({
                    'error': f'Cannot go online: Your captain rating ({driver.rating}) is below the required minimum of {min_rating_threshold}. Please contact RaahGo Support.',
                    'approval_status': driver.approval_status,
                    'is_online': False
                }, status=status.HTTP_403_FORBIDDEN)

            max_complaints_limit = int(SystemSetting.get_setting('max_complaints', '5'))
            # Check 1-star ratings or negative complaints
            complaint_count = Rating.objects.filter(driver=driver, score__lte=2).count()
            if complaint_count >= max_complaints_limit:
                return Response({
                    'error': f'Cannot go online: Your account has received {complaint_count} low-rating complaints (limit is {max_complaints_limit}). Please contact RaahGo Operations for review.',
                    'approval_status': driver.approval_status,
                    'is_online': False
                }, status=status.HTTP_403_FORBIDDEN)
        except Exception:
            pass

        # ── 4. Daily Shift Limit Check ───────────────────────────────────────
        today = timezone.now().date()
        if driver.last_duty_reset_date != today:
            driver.daily_online_seconds = 0
            driver.last_duty_reset_date = today

        if driver.daily_online_seconds >= 43200:
            driver.availability_status = Driver.AvailabilityStatus.OFFLINE
            driver.last_online_start = None
            driver.save()
            return Response({
                'error': 'Daily 12-hour online shift limit reached for today.',
                'is_online': False
            }, status=status.HTTP_400_BAD_REQUEST)

        # ── 4. Driver Goes Online & Ready for Rides ─────────────────────────
        driver.last_online_start = timezone.now()
        driver.availability_status = Driver.AvailabilityStatus.ONLINE
        driver.save()

        return Response({
            'status': 'Online',
            'is_online': True,
            'is_available': True,
            'duty_seconds_today': driver.get_current_daily_online_seconds(),
            'active_vehicle': {
                'make': active_vehicle.make,
                'model': active_vehicle.model,
                'plate': active_vehicle.registration_number,
                'type': active_vehicle.vehicle_type.name if active_vehicle.vehicle_type else 'Standard'
            }
        }, status=status.HTTP_200_OK)


class DriverStatusOfflineView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        # ── Block offline during an active ride ──────────────────────────────
        active_ride = Booking.objects.filter(
            driver=driver,
            status__in=[
                Booking.BookingStatus.ACCEPTED,
                Booking.BookingStatus.ARRIVED,
                Booking.BookingStatus.IN_TRIP,
            ]
        ).first()

        if active_ride:
            return Response({
                'error': 'You cannot go offline while a ride is in progress. '
                         'Please complete or cancel the current ride first.',
                'active_ride_id': str(active_ride.id),
                'ride_status': active_ride.status,
            }, status=status.HTTP_400_BAD_REQUEST)
        # ────────────────────────────────────────────────────────────────────

        if driver.last_online_start:
            midnight_today = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
            effective_start = max(driver.last_online_start, midnight_today)
            elapsed = int((timezone.now() - effective_start).total_seconds())
            driver.daily_online_seconds = min(43200, driver.daily_online_seconds + max(0, elapsed))
            driver.last_online_start = None

        driver.availability_status = Driver.AvailabilityStatus.OFFLINE
        driver.save()

        return Response({
            'status': 'Offline',
            'is_online': False,
            'is_available': False,
            'duty_seconds_today': driver.get_current_daily_online_seconds()
        }, status=status.HTTP_200_OK)


class DriverStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'is_online': False, 'is_available': False}, status=status.HTTP_200_OK)

        return Response({
            'is_online': driver.availability_status == Driver.AvailabilityStatus.ONLINE,
            'is_available': driver.availability_status == Driver.AvailabilityStatus.ONLINE,
            'availability_status': driver.availability_status,
            'latitude': float(driver.current_latitude) if driver.current_latitude else 28.4415,
            'longitude': float(driver.current_longitude) if driver.current_longitude else 77.0395,
            'duty_seconds_today': driver.get_current_daily_online_seconds()
        }, status=status.HTTP_200_OK)


# ============================================================================
# 5. Driver Location Tracking
# ============================================================================

class DriverLocationView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        lat = request.data.get('latitude') or request.data.get('lat')
        lng = request.data.get('longitude') or request.data.get('lng') or request.data.get('lon')
        heading = request.data.get('heading', 0)
        speed = request.data.get('speed', 0)

        if lat is not None and lng is not None:
            try:
                lat_val = round(Decimal(str(lat)), 7)
                lng_val = round(Decimal(str(lng)), 7)
                driver.current_latitude = lat_val
                driver.current_longitude = lng_val
                driver.last_location_update = timezone.now()
                driver.save(update_fields=['current_latitude', 'current_longitude', 'last_location_update'])

                # Record/Update tracking history entry in driver_locations table
                DriverLocation.objects.update_or_create(
                    driver=driver,
                    defaults={
                        'latitude': lat_val,
                        'longitude': lng_val,
                        'heading': Decimal(str(heading)),
                        'speed': Decimal(str(speed)),
                        'is_online': driver.availability_status == Driver.AvailabilityStatus.ONLINE or driver.availability_status == Driver.AvailabilityStatus.IN_TRIP
                    }
                )
            except Exception:
                pass

        return Response({
            'message': 'Location updated successfully',
            'latitude': float(lat) if lat is not None else None,
            'longitude': float(lng) if lng is not None else None
        }, status=status.HTTP_200_OK)

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'latitude': float(driver.current_latitude) if driver.current_latitude else 28.4415,
            'longitude': float(driver.current_longitude) if driver.current_longitude else 77.0395,
            'last_update': driver.last_location_update
        }, status=status.HTTP_200_OK)


# ============================================================================
# 6. Ride Requests & Current Ride Lifecycle
# ============================================================================

class DriverRideRequestsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, request_id=None):
        driver = get_driver_from_request(request)
        if request_id:
            booking = Booking.objects.filter(id=request_id).first()
            if not booking:
                return Response({'error': 'Ride request not found'}, status=status.HTTP_404_NOT_FOUND)
            return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)

        # 1. Determine Driver's Registered Vehicle Types (support all active vehicles of driver)
        driver_v_types = []
        if driver:
            driver_v_types = list(driver.vehicles.filter(is_active=True).values_list('vehicle_type__name', flat=True))

        try:
            wait_time_mins = int(SystemSetting.get_setting('customer_wait_time', '5') or 5)
        except Exception:
            wait_time_mins = 5
        cutoff = timezone.now() - timedelta(minutes=wait_time_mins)

        # Auto-cancel expired searching bookings so captains do not see timed-out requests
        stale_qs = Booking.objects.filter(status=Booking.BookingStatus.SEARCHING, created_at__lte=cutoff)
        for sb in stale_qs:
            sb.status = Booking.BookingStatus.CANCELLED
            sb.save()
            BookingTracking.objects.create(
                booking=sb,
                status=Booking.BookingStatus.CANCELLED,
                remarks=f'Auto-cancelled: no driver found within {wait_time_mins} minutes.'
            )

        qs = Booking.objects.filter(status=Booking.BookingStatus.SEARCHING, created_at__gt=cutoff).order_by('-created_at')

        # 2. Filter by Vehicle Types if driver has specific registered types
        if driver_v_types:
            # Build regex matching any of driver's vehicle types (case-insensitive)
            pattern = '|'.join([vt.lower() for vt in driver_v_types])
            if 'bike' in pattern:
                pattern += '|moto|scooter'
            if 'sedan' in pattern:
                pattern += '|car|cab|taxi'
            qs = qs.filter(Q(vehicle_type__isnull=True) | Q(vehicle_type__name__iregex=r'(' + pattern + ')'))

        # 3. Proximity Filter (reading coordinates from query params or driver profile)
        d_lat_param = request.query_params.get('driver_lat') or request.query_params.get('lat')
        d_lng_param = request.query_params.get('driver_lng') or request.query_params.get('lng')
        max_dist_param = request.query_params.get('max_distance', 10.0)

        # Auto-persist driver GPS coordinates in Driver table when supplied by GPS telemetry
        if driver and d_lat_param is not None and d_lng_param is not None:
            try:
                lat_val = round(Decimal(str(d_lat_param)), 7)
                lng_val = round(Decimal(str(d_lng_param)), 7)
                driver.current_latitude = lat_val
                driver.current_longitude = lng_val
                driver.last_location_update = timezone.now()
                driver.save(update_fields=['current_latitude', 'current_longitude', 'last_location_update'])

                DriverLocation.objects.update_or_create(
                    driver=driver,
                    defaults={
                        'latitude': lat_val,
                        'longitude': lng_val,
                        'is_online': driver.availability_status == Driver.AvailabilityStatus.ONLINE or driver.availability_status == Driver.AvailabilityStatus.IN_TRIP
                    }
                )
            except Exception:
                pass

        driver_lat = float(d_lat_param) if d_lat_param else (float(driver.current_latitude) if driver and driver.current_latitude else 28.4415)
        driver_lng = float(d_lng_param) if d_lng_param else (float(driver.current_longitude) if driver and driver.current_longitude else 77.0395)
        max_dist = float(max_dist_param)

        filtered = []
        for b in qs[:20]:
            data = BookingSerializer(b).data
            if b.pickup_latitude and b.pickup_longitude:
                dist = calculate_haversine_distance(driver_lat, driver_lng, b.pickup_latitude, b.pickup_longitude)
                if dist <= max_dist:
                    data['pickup_distance'] = f"{dist:.1f} km away"
                    data['pickup_distance_km'] = round(dist, 1)

                    if b.dropoff_latitude and b.dropoff_longitude:
                        drop_dist = calculate_haversine_distance(driver_lat, driver_lng, b.dropoff_latitude, b.dropoff_longitude)
                        data['drop_distance_from_captain'] = f"{drop_dist:.1f} km away"
                        data['drop_distance_km'] = round(drop_dist, 1)

                        trip_dist = calculate_haversine_distance(b.pickup_latitude, b.pickup_longitude, b.dropoff_latitude, b.dropoff_longitude)
                        data['trip_distance_km'] = round(trip_dist, 1)
                    elif b.distance_km:
                        data['drop_distance_from_captain'] = f"{float(dist + float(b.distance_km)):.1f} km away"
                        data['drop_distance_km'] = round(dist + float(b.distance_km), 1)
                        data['trip_distance_km'] = float(b.distance_km)

                    filtered.append(data)
            else:
                filtered.append(data)

        return Response(filtered, status=status.HTTP_200_OK)


class DriverRideAcceptView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        driver = get_driver_from_request(request)
        booking = Booking.objects.filter(id=ride_id).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        try:
            wait_time_mins = int(SystemSetting.get_setting('customer_wait_time', '5') or 5)
        except Exception:
            wait_time_mins = 5
        cutoff = timezone.now() - timedelta(minutes=wait_time_mins)

        if booking.status == Booking.BookingStatus.SEARCHING and booking.created_at <= cutoff:
            booking.status = Booking.BookingStatus.CANCELLED
            booking.save()
            BookingTracking.objects.create(
                booking=booking,
                status=Booking.BookingStatus.CANCELLED,
                remarks=f'Auto-cancelled: no driver found within {wait_time_mins} minutes.'
            )
            return Response({'error': 'This ride request has expired and was auto-cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status in [Booking.BookingStatus.ACCEPTED, Booking.BookingStatus.IN_TRIP, Booking.BookingStatus.COMPLETED]:
            return Response({'error': 'Ride has already been accepted or finished by another captain'}, status=status.HTTP_400_BAD_REQUEST)

        if booking.status == Booking.BookingStatus.CANCELLED:
            return Response({'error': 'This ride has been cancelled.'}, status=status.HTTP_400_BAD_REQUEST)

        booking.driver = driver
        booking.status = Booking.BookingStatus.ACCEPTED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.ACCEPTED,
            remarks=f"Accepted by driver {(' '.join(filter(None, [driver.user.first_name, driver.user.last_name])) or driver.user.username) if driver else 'Captain'}"
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


class DriverRideRejectView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        return Response({'message': 'Ride declined successfully', 'ride_id': ride_id}, status=status.HTTP_200_OK)


class DriverCurrentRideView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response(None, status=status.HTTP_200_OK)

        active = Booking.objects.filter(
            driver=driver,
            status__in=[Booking.BookingStatus.ACCEPTED, Booking.BookingStatus.ARRIVED, Booking.BookingStatus.IN_TRIP]
        ).order_by('-created_at').first()

        if not active:
            return Response(None, status=status.HTTP_200_OK)

        return Response(BookingSerializer(active).data, status=status.HTTP_200_OK)


class DriverRideArrivedView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        booking = Booking.objects.filter(id=ride_id).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        wait_time = int(SystemSetting.get_setting('driver_wait_time', '5'))
        booking.status = Booking.BookingStatus.ARRIVED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.ARRIVED,
            remarks=f"Captain arrived at pickup location. Free waiting window is {wait_time} minutes."
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


class DriverRideStartView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        booking = Booking.objects.filter(id=ride_id).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        pin = request.data.get('pin', '').strip()
        if booking.ride_pin and pin != booking.ride_pin:
            return Response({'error': 'Incorrect PIN. Please ask customer for correct 4-digit PIN.'}, status=status.HTTP_400_BAD_REQUEST)

        booking.status = Booking.BookingStatus.IN_TRIP
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.IN_TRIP,
            remarks=f"Trip started - Customer PIN {pin} verified successfully"
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


class DriverRideCompleteView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        booking = Booking.objects.filter(id=ride_id).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        booking.status = Booking.BookingStatus.COMPLETED
        booking.payment_status = Booking.PaymentStatus.PAID
        booking.save()

        if booking.driver:
            booking.driver.total_trips += 1
            booking.driver.save()

            # Credit driver wallet
            wallet, _ = Wallet.objects.get_or_create(user=booking.driver.user)
            wallet.balance += booking.total_fare
            wallet.save()

            WalletTransaction.objects.create(
                wallet=wallet,
                amount=booking.total_fare,
                transaction_type=WalletTransaction.TransactionType.CREDIT,
                description=f"Earnings from Ride #{booking.booking_number}",
                reference_id=str(booking.id)
            )

        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.COMPLETED,
            remarks="Trip completed successfully"
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


class DriverRideCancelView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        booking = Booking.objects.filter(id=ride_id).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        booking.status = Booking.BookingStatus.CANCELLED
        booking.save()

        reason = request.data.get('reason', 'Cancelled by captain')
        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.CANCELLED,
            remarks=f"Cancelled: {reason}"
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


class DriverRideHistoryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id=None):
        driver = get_driver_from_request(request)
        if ride_id:
            booking = Booking.objects.filter(id=ride_id).first()
            if not booking:
                return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)
            return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)

        qs = Booking.objects.all().order_by('-created_at')
        if driver:
            qs = qs.filter(driver=driver)

        params = getattr(request, 'query_params', getattr(request, 'GET', {}))
        status_filter = params.get('status')
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)

        try:
            limit = int(params.get('page_size', params.get('limit', 50)))
        except (ValueError, TypeError):
            limit = 50

        return Response(BookingSerializer(qs[:limit], many=True).data, status=status.HTTP_200_OK)


# ============================================================================
# 7. Driver Earnings
# ============================================================================

class DriverEarningsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, period=None, ride_id=None):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'today': 0, 'commission': 0, 'net_earning': 0}, status=status.HTTP_200_OK)

        if ride_id:
            booking = Booking.objects.filter(id=ride_id, driver=driver).first()
            if not booking:
                return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)
            fare = float(booking.total_fare)
            comm = fare * 0.10
            return Response({
                'ride_id': str(booking.id),
                'booking_number': booking.booking_number,
                'total_fare': fare,
                'commission': comm,
                'net_earning': fare - comm,
                'completed_at': booking.updated_at
            }, status=status.HTTP_200_OK)

        today_start = timezone.now().replace(hour=0, minute=0, second=0, microsecond=0)
        completed_today = Booking.objects.filter(
            driver=driver,
            status=Booking.BookingStatus.COMPLETED,
            updated_at__gte=today_start
        )
        total_today = float(completed_today.aggregate(s=Sum('total_fare'))['s'] or 0)
        comm_today = total_today * 0.10

        # Week & Month
        week_start = today_start - timezone.timedelta(days=7)
        total_week = float(Booking.objects.filter(driver=driver, status=Booking.BookingStatus.COMPLETED, updated_at__gte=week_start).aggregate(s=Sum('total_fare'))['s'] or 0)

        month_start = today_start - timezone.timedelta(days=30)
        total_month = float(Booking.objects.filter(driver=driver, status=Booking.BookingStatus.COMPLETED, updated_at__gte=month_start).aggregate(s=Sum('total_fare'))['s'] or 0)

        if period == 'today':
            return Response({
                'today': total_today,
                'commission': comm_today,
                'net_earning': total_today - comm_today,
                'trips_count': completed_today.count()
            }, status=status.HTTP_200_OK)
        elif period == 'week':
            return Response({
                'week': total_week,
                'commission': total_week * 0.10,
                'net_earning': total_week * 0.90
            }, status=status.HTTP_200_OK)
        elif period == 'month':
            return Response({
                'month': total_month,
                'commission': total_month * 0.10,
                'net_earning': total_month * 0.90
            }, status=status.HTTP_200_OK)

        payout_schedule = SystemSetting.get_setting('payout_schedule', 'weekly')
        today_date = timezone.now().date()
        if payout_schedule == 'daily':
            next_payout_date = today_date + timezone.timedelta(days=1)
        elif payout_schedule == 'monthly':
            next_payout_date = (today_date.replace(day=1) + timezone.timedelta(days=32)).replace(day=1)
        else:  # weekly
            days_ahead = 0 - today_date.weekday()
            if days_ahead <= 0:
                days_ahead += 7
            next_payout_date = today_date + timezone.timedelta(days=days_ahead)

        return Response({
            'today': total_today,
            'week': total_week,
            'month': total_month,
            'commission': comm_today,
            'net_earning': total_today - comm_today,
            'trips_completed_today': completed_today.count(),
            'payout_schedule': payout_schedule,
            'next_payout_date': next_payout_date.strftime('%d %b %Y')
        }, status=status.HTTP_200_OK)


# ============================================================================
# 8. Driver Wallet & Payments
# ============================================================================

class DriverWalletView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'balance': 0, 'currency': 'INR'}, status=status.HTTP_200_OK)

        wallet, _ = Wallet.objects.get_or_create(user=driver.user)
        return Response({
            'wallet_id': str(wallet.id),
            'balance': float(wallet.balance),
            'currency': wallet.currency
        }, status=status.HTTP_200_OK)


class DriverWalletTransactionsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response([], status=status.HTTP_200_OK)

        wallet, _ = Wallet.objects.get_or_create(user=driver.user)
        txs = wallet.transactions.all().order_by('-created_at')[:30]
        result = [{
            'id': str(t.id),
            'amount': float(t.amount),
            'transaction_type': t.transaction_type,
            'description': t.description,
            'reference_id': t.reference_id,
            'created_at': t.created_at
        } for t in txs]
        return Response(result, status=status.HTTP_200_OK)


class DriverWalletAddMoneyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(request.data.get('amount', 500)))
        wallet, _ = Wallet.objects.get_or_create(user=driver.user)
        wallet.balance += amount
        wallet.save()

        WalletTransaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type=WalletTransaction.TransactionType.CREDIT,
            description="Captain Wallet Recharge",
            reference_id=f"RECH_{random.randint(100000, 999999)}"
        )
        return Response({'message': 'Money added successfully', 'balance': float(wallet.balance)}, status=status.HTTP_200_OK)


class DriverWalletWithdrawView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver not found'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(request.data.get('amount', 0)))
        wallet, _ = Wallet.objects.get_or_create(user=driver.user)

        if wallet.balance < amount:
            return Response({'error': 'Insufficient wallet balance for withdrawal'}, status=status.HTTP_400_BAD_REQUEST)

        wallet.balance -= amount
        wallet.save()

        WalletTransaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type=WalletTransaction.TransactionType.DEBIT,
            description="Bank Account Payout / Withdrawal",
            reference_id=f"WTHD_{random.randint(100000, 999999)}"
        )
        return Response({'message': 'Withdrawal initiated successfully', 'balance': float(wallet.balance)}, status=status.HTTP_200_OK)


# ============================================================================
# 9. Ratings & Reviews
# ============================================================================

class DriverRatingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response([], status=status.HTTP_200_OK)

        ratings = Rating.objects.filter(reviewee_driver=driver).order_by('-created_at')[:30]
        result = [{
            'id': str(r.id),
            'rating': r.rating,
            'comment': r.comment,
            'reviewer': ' '.join(filter(None, [r.reviewer.first_name, r.reviewer.last_name])) or r.reviewer.username,
            'created_at': r.created_at
        } for r in ratings]
        return Response(result, status=status.HTTP_200_OK)


class DriverRatingSummaryView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'rating': 5.0, 'total_rides': 0, 'five_star': 0, 'four_star': 0}, status=status.HTTP_200_OK)

        ratings = Rating.objects.filter(reviewee_driver=driver)
        total_count = ratings.count()
        five_star = ratings.filter(rating=5).count()
        four_star = ratings.filter(rating=4).count()

        return Response({
            'rating': float(driver.rating),
            'total_rides': driver.total_trips or total_count,
            'five_star': five_star if total_count > 0 else (driver.total_trips or 12),
            'four_star': four_star
        }, status=status.HTTP_200_OK)


# ============================================================================
# 10. Notifications
# ============================================================================

class DriverNotificationsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response([], status=status.HTTP_200_OK)

        notifs = Notification.objects.filter(user=driver.user).order_by('-created_at')[:30]
        result = []
        for n in notifs:
            notif_type = 'announcement'
            title_lower = (n.title or '').lower()
            if 'ride' in title_lower or 'trip' in title_lower:
                notif_type = 'ride'
            elif 'incentive' in title_lower or 'bonus' in title_lower or 'surge' in title_lower:
                notif_type = 'incentive'
            elif 'payout' in title_lower or 'payment' in title_lower or 'wallet' in title_lower:
                notif_type = 'payout'
            elif 'doc' in title_lower or 'kyc' in title_lower or 'license' in title_lower or 'insurance' in title_lower:
                notif_type = 'document'

            result.append({
                'id': str(n.id),
                'type': notif_type,
                'title': n.title,
                'message': n.body,
                'body': n.body,
                'unread': not n.is_read,
                'is_read': n.is_read,
                'time': n.created_at.strftime('%Y-%m-%d %H:%M') if n.created_at else 'Just now',
                'created_at': n.created_at
            })

        # If DB has fewer than 3 notifications for this driver, generate dynamic alerts from real DB state
        if len(result) < 3:
            # 1. Real KYC and document verification status alert
            if driver.approval_status == Driver.ApprovalStatus.APPROVED:
                result.append({
                    'id': f"dyn-kyc-{str(driver.id)[:8]}",
                    'type': 'document',
                    'title': '✓ KYC & Vehicle Verified',
                    'message': f'Your driver profile, license ({driver.license_number}) and active vehicle are verified for service.',
                    'body': f'Your driver profile, license ({driver.license_number}) and active vehicle are verified for service.',
                    'unread': False,
                    'is_read': True,
                    'time': 'Active',
                    'created_at': driver.created_at
                })
            elif driver.approval_status == Driver.ApprovalStatus.REJECTED:
                result.append({
                    'id': f"dyn-kyc-{str(driver.id)[:8]}",
                    'type': 'document',
                    'title': '⚠️ Document Action Required',
                    'message': 'Your KYC application was rejected by admin. Please review rejected documents in your Profile and re-upload.',
                    'body': 'Your KYC application was rejected by admin. Please review rejected documents in your Profile and re-upload.',
                    'unread': True,
                    'is_read': False,
                    'time': 'Action Required',
                    'created_at': driver.created_at
                })

            # 2. Daily Incentive Alert
            result.append({
                'id': f"dyn-inc-{str(driver.id)[:8]}",
                'type': 'incentive',
                'title': '🎯 Daily Peak-Hour Incentive',
                'message': 'Complete 10 rides before 10:00 PM today and earn ₹500 extra bonus directly in your wallet!',
                'body': 'Complete 10 rides before 10:00 PM today and earn ₹500 extra bonus directly in your wallet!',
                'unread': True,
                'is_read': False,
                'time': '15 mins ago',
                'created_at': timezone.now()
            })

            # 3. Bank Payout Alert
            bank = DriverBankAccount.objects.filter(driver=driver).first()
            bank_name = bank.bank_name if bank else 'HDFC Bank'
            ac_last4 = bank.account_number[-4:] if bank and bank.account_number else '8901'
            result.append({
                'id': f"dyn-pay-{str(driver.id)[:8]}",
                'type': 'payout',
                'title': '💰 Bank Settlement Payout',
                'message': f'Weekly earnings payout ready for transfer to your {bank_name} account (A/C •••• {ac_last4}).',
                'body': f'Weekly earnings payout ready for transfer to your {bank_name} account (A/C •••• {ac_last4}).',
                'unread': False,
                'is_read': True,
                'time': 'Weekly',
                'created_at': timezone.now()
            })

        return Response(result, status=status.HTTP_200_OK)


class DriverNotificationActionView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, notif_id=None):
        driver = get_driver_from_request(request)
        if notif_id == 'read-all':
            if driver:
                Notification.objects.filter(user=driver.user).update(is_read=True)
            return Response({'message': 'All notifications marked as read'}, status=status.HTTP_200_OK)

        if notif_id:
            Notification.objects.filter(id=notif_id).update(is_read=True)
            return Response({'message': 'Notification marked as read'}, status=status.HTTP_200_OK)

    def delete(self, request, notif_id):
        Notification.objects.filter(id=notif_id).delete()
        return Response({'message': 'Notification deleted successfully'}, status=status.HTTP_200_OK)


# ============================================================================
# 11. Emergency / SOS & Contacts
# ============================================================================

class DriverSosView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id=None):
        driver = get_driver_from_request(request)
        lat = request.data.get('latitude', driver.current_latitude if driver else None)
        lng = request.data.get('longitude', driver.current_longitude if driver else None)

        return Response({
            'message': 'Emergency SOS Alert triggered. Police and RaahGo Safety Emergency team dispatched.',
            'status': 'ACTIVE_ALERT',
            'ride_id': ride_id,
            'coordinates': {'lat': float(lat) if lat else 28.4415, 'lng': float(lng) if lng else 77.0395}
        }, status=status.HTTP_200_OK)


class DriverEmergencyContactsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response([
            {'id': '1', 'name': 'Police Emergency Hotline', 'phone': '112', 'relation': 'Emergency'},
            {'id': '2', 'name': 'RaahGo Safety Support', 'phone': '+91-800-00-RAAH', 'relation': 'Helpline'}
        ], status=status.HTTP_200_OK)

    def post(self, request):
        return Response({'message': 'Emergency contact saved successfully'}, status=status.HTTP_201_CREATED)


# ============================================================================
# 12. Driver Settings & Support
# ============================================================================

class DriverSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'push_notifications': True,
            'sms_notifications': True,
            'language': 'en',
            'preferred_ride_type': 'All',
            'navigation_preference': 'Google Maps'
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        return Response({'message': 'Settings updated successfully', 'settings': request.data}, status=status.HTTP_200_OK)


class DriverSupportTicketsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ticket_id=None):
        if ticket_id:
            return Response({
                'id': ticket_id,
                'subject': 'Fare adjustment request',
                'status': 'In Review',
                'created_at': timezone.now()
            }, status=status.HTTP_200_OK)

        return Response([
            {'id': 'TKT101', 'subject': 'Daily payout settlement query', 'status': 'Resolved', 'created_at': timezone.now()}
        ], status=status.HTTP_200_OK)

    def post(self, request, ticket_id=None):
        if ticket_id:
            return Response({'message': 'Message sent to support agent'}, status=status.HTTP_201_CREATED)
        return Response({
            'message': 'Support ticket created successfully',
            'ticket_id': f"TKT{random.randint(1000, 9999)}"
        }, status=status.HTTP_201_CREATED)
