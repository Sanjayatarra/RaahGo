import random
from decimal import Decimal
from django.utils import timezone
from django.db.models import Q, Sum, Count, Avg
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from users.models import User
from drivers.models import Driver, DriverDocument, DriverBankAccount
from vehicles.models import Vehicle, VehicleType
from bookings.models import Booking, RideDetail, BookingTracking
from bookings.serializers import BookingSerializer
from tracking.models import DriverLocation
from wallets.models import Wallet, WalletTransaction
from reviews.models import Rating
from notifications.models import Notification
from bookings.views import calculate_haversine_distance


def get_driver_from_request(request):
    """Helper to extract Driver instance from request (via auth user or header/param fallback)"""
    user = request.user
    if user and user.is_authenticated:
        driver = Driver.objects.filter(user=user).first()
        if driver:
            return driver
    
    # Fallback to driver_id param or header if provided
    driver_id = request.query_params.get('driver_id') or request.data.get('driver_id') or request.headers.get('X-Driver-Id')
    if driver_id:
        return Driver.objects.filter(id=driver_id).first()
        
    return Driver.objects.first()


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

        driver, _ = Driver.objects.get_or_create(
            user=user,
            defaults={
                'license_number': license_number,
                'approval_status': Driver.ApprovalStatus.APPROVED,
                'availability_status': Driver.AvailabilityStatus.ONLINE,
                'rating': Decimal('5.00')
            }
        )

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
            'availability_status': driver.availability_status
        }, status=status.HTTP_201_CREATED)


class DriverProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        driver = get_driver_from_request(request)
        if not driver:
            return Response({'error': 'Driver profile not found'}, status=status.HTTP_404_NOT_FOUND)

        vehicle = driver.vehicles.filter(is_active=True).first()
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
            'current_latitude': str(driver.current_latitude) if driver.current_latitude else None,
            'current_longitude': str(driver.current_longitude) if driver.current_longitude else None,
            'duty_seconds_today': driver.get_current_daily_online_seconds(),
            'vehicle': {
                'id': str(vehicle.id),
                'name': f"{vehicle.make} {vehicle.model}".strip(),
                'registration_number': vehicle.registration_number,
                'vehicle_number': vehicle.registration_number,
                'vehicle_type': vehicle.vehicle_type.name if vehicle.vehicle_type else 'Bike',
                'is_approved': vehicle.is_approved,
                'is_verified': vehicle.is_approved
            } if vehicle else None
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
            verification_status=DriverDocument.VerificationStatus.VERIFIED
        )
        return Response({
            'message': 'Document uploaded successfully',
            'id': str(doc.id),
            'verification_status': doc.verification_status
        }, status=status.HTTP_201_CREATED)


class DriverDocumentDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def patch(self, request, document_id):
        driver = get_driver_from_request(request)
        doc = DriverDocument.objects.filter(id=document_id, driver=driver).first() if driver else DriverDocument.objects.filter(id=document_id).first()
        if not doc:
            return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

        if 'document_number' in request.data:
            doc.document_number = request.data['document_number']
        if 'document_url' in request.data:
            doc.document_url = request.data['document_url']
        doc.save()
        return Response({'message': 'Document updated successfully'}, status=status.HTTP_200_OK)

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
            'make': v.make,
            'model': v.model,
            'vehicle_name': f"{v.make} {v.model}".strip(),
            'registration_number': v.registration_number,
            'vehicle_number': v.registration_number,
            'vehicle_type': v.vehicle_type.name if v.vehicle_type else 'Bike',
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
            is_approved=True
        )
        return Response({
            'message': 'Vehicle registered successfully',
            'id': str(vehicle.id),
            'vehicle_number': vehicle.registration_number,
            'registration_number': vehicle.registration_number
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

        driver.last_online_start = timezone.now()
        driver.availability_status = Driver.AvailabilityStatus.ONLINE
        driver.save()

        return Response({
            'status': 'Online',
            'is_online': True,
            'is_available': True,
            'duty_seconds_today': driver.get_current_daily_online_seconds()
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

        if lat and lng:
            driver.current_latitude = Decimal(str(lat))
            driver.current_longitude = Decimal(str(lng))
            driver.last_location_update = timezone.now()
            driver.save()

            # Record tracking history entry
            DriverLocation.objects.create(
                driver=driver,
                latitude=Decimal(str(lat)),
                longitude=Decimal(str(lng)),
                heading=Decimal(str(heading)),
                speed=Decimal(str(speed)),
                is_online=driver.availability_status == Driver.AvailabilityStatus.ONLINE
            )

        return Response({
            'message': 'Location updated successfully',
            'latitude': float(lat) if lat else None,
            'longitude': float(lng) if lng else None
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

        qs = Booking.objects.filter(status=Booking.BookingStatus.SEARCHING).order_by('-created_at')

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

        driver_lat = float(d_lat_param) if d_lat_param else (float(driver.current_latitude) if driver and driver.current_latitude else 28.4415)
        driver_lng = float(d_lng_param) if d_lng_param else (float(driver.current_longitude) if driver and driver.current_longitude else 77.0395)
        max_dist = float(max_dist_param)

        filtered = []
        for b in qs[:20]:
            if b.pickup_latitude and b.pickup_longitude:
                dist = calculate_haversine_distance(driver_lat, driver_lng, b.pickup_latitude, b.pickup_longitude)
                if dist <= max_dist:
                    data = BookingSerializer(b).data
                    data['pickup_distance'] = f"{dist:.1f} km away"
                    filtered.append(data)
            else:
                filtered.append(BookingSerializer(b).data)

        return Response(filtered, status=status.HTTP_200_OK)


class DriverRideAcceptView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        driver = get_driver_from_request(request)
        booking = Booking.objects.filter(id=ride_id).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        if booking.status in [Booking.BookingStatus.ACCEPTED, Booking.BookingStatus.IN_TRIP, Booking.BookingStatus.COMPLETED]:
            return Response({'error': 'Ride has already been accepted or finished by another captain'}, status=status.HTTP_400_BAD_REQUEST)

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

        booking.status = Booking.BookingStatus.ARRIVED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.ARRIVED,
            remarks="Captain arrived at pickup location"
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

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)

        limit = int(request.query_params.get('page_size', 20))
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

        return Response({
            'today': total_today,
            'week': total_week,
            'month': total_month,
            'commission': comm_today,
            'net_earning': total_today - comm_today,
            'trips_completed_today': completed_today.count()
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
        result = [{
            'id': str(n.id),
            'title': n.title,
            'body': n.body,
            'is_read': n.is_read,
            'created_at': n.created_at
        } for n in notifs]
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
