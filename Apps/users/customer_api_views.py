import random
import urllib.request
import urllib.parse
import json
from decimal import Decimal
from datetime import timedelta
from django.utils import timezone
from django.db.models import Q, Sum, Avg, Count
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions

from users.models import User, UserAddress, OTPVerification, SystemSetting
from vehicles.models import Vehicle, VehicleType
from bookings.models import Booking, RideDetail, ParcelDetail, MovingDetail, BookingTracking
from bookings.serializers import BookingSerializer
from tracking.models import DriverLocation
from wallets.models import Wallet, WalletTransaction
from reviews.models import Rating
from notifications.models import Notification
from coupons.models import Coupon
from payments.models import Payment, Refund
from bookings.views import calculate_haversine_distance

CUSTOMER_ROLE = User.RoleChoices.CUSTOMER


def get_customer_from_request(request):
    """Helper to extract Customer User instance from request (via auth user or fallback)"""
    user = request.user
    if user and user.is_authenticated and getattr(user, 'role', '') == CUSTOMER_ROLE:
        return user
    
    customer_id = request.query_params.get('customer_id') or request.data.get('customer_id') or request.headers.get('X-Customer-Id')
    if customer_id:
        c = User.objects.filter(id=customer_id, role=CUSTOMER_ROLE).first()
        if c:
            return c

    return User.objects.filter(role=CUSTOMER_ROLE).first()


# ============================================================================
# 1. Customer Profile & Image APIs
# ============================================================================

class CustomerProfileView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        full_name = f"{customer.first_name or ''} {customer.last_name or ''}".strip() or customer.username
        return Response({
            'id': str(customer.id),
            'name': full_name,
            'first_name': customer.first_name or '',
            'last_name': customer.last_name or '',
            'email': customer.email or '',
            'phone': customer.phone_number or '',
            'phone_number': customer.phone_number or '',
            'profile_image': customer.profile_image or '',
            'gender': customer.gender or 'other',
            'date_of_birth': str(customer.date_of_birth) if customer.date_of_birth else None,
            'is_phone_verified': customer.is_phone_verified,
            'is_email_verified': customer.is_email_verified,
            'created_at': customer.created_at
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        if 'name' in data and data['name']:
            parts = data['name'].strip().split(' ', 1)
            customer.first_name = parts[0]
            customer.last_name = parts[1] if len(parts) > 1 else ''
        if 'first_name' in data:
            customer.first_name = data['first_name']
        if 'last_name' in data:
            customer.last_name = data['last_name']
        if 'email' in data:
            customer.email = data['email']
        if 'phone' in data or 'phone_number' in data:
            customer.phone_number = data.get('phone') or data.get('phone_number')
        if 'gender' in data:
            customer.gender = data['gender']
        if 'date_of_birth' in data:
            customer.date_of_birth = data['date_of_birth']
        if 'profile_image' in data:
            customer.profile_image = data['profile_image']

        customer.save()
        return Response({'message': 'Profile updated successfully', 'customer_id': str(customer.id)}, status=status.HTTP_200_OK)

    def delete(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)
        
        customer.is_active = False
        customer.save()
        return Response({'message': 'Customer account deactivated successfully'}, status=status.HTTP_200_OK)


class CustomerProfileImageView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        image_url = request.data.get('profile_image') or request.data.get('image_url') or 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80'
        customer.profile_image = image_url
        customer.save()
        return Response({
            'message': 'Profile image uploaded successfully',
            'profile_image': customer.profile_image
        }, status=status.HTTP_200_OK)

    def delete(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        customer.profile_image = None
        customer.save()
        return Response({'message': 'Profile image removed successfully'}, status=status.HTTP_200_OK)


# ============================================================================
# 2. Customer Address APIs (Home, Work, Saved Locations)
# ============================================================================

class CustomerAddressesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response([], status=status.HTTP_200_OK)

        addresses = UserAddress.objects.filter(user=customer).order_by('-is_default', '-created_at')
        result = [{
            'id': str(a.id),
            'label': a.title,
            'title': a.title,
            'address': f"{a.address_line_1}, {a.city}".strip(', '),
            'address_line_1': a.address_line_1,
            'address_line_2': a.address_line_2 or '',
            'city': a.city,
            'state': a.state,
            'postal_code': a.postal_code,
            'latitude': float(a.latitude) if a.latitude else 28.4415,
            'longitude': float(a.longitude) if a.longitude else 77.0395,
            'is_default': a.is_default,
            'created_at': a.created_at
        } for a in addresses]
        return Response(result, status=status.HTTP_200_OK)

    def post(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        label = request.data.get('label') or request.data.get('title', 'Home')
        addr_text = request.data.get('address') or request.data.get('address_line_1', 'City Center')
        lat = request.data.get('latitude') or request.data.get('lat', 28.4415)
        lng = request.data.get('longitude') or request.data.get('lon') or request.data.get('lng', 77.0395)
        is_default = bool(request.data.get('is_default', False))

        if is_default:
            UserAddress.objects.filter(user=customer).update(is_default=False)

        addr = UserAddress.objects.create(
            user=customer,
            title=label,
            address_line_1=addr_text,
            city=request.data.get('city', 'Gurgaon'),
            state=request.data.get('state', 'Haryana'),
            postal_code=request.data.get('postal_code', '122001'),
            latitude=Decimal(str(lat)),
            longitude=Decimal(str(lng)),
            is_default=is_default
        )

        return Response({
            'message': 'Address saved successfully',
            'id': str(addr.id),
            'label': addr.title,
            'address': addr.address_line_1,
            'latitude': float(addr.latitude),
            'longitude': float(addr.longitude),
            'is_default': addr.is_default
        }, status=status.HTTP_201_CREATED)


class CustomerAddressDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, address_id):
        customer = get_customer_from_request(request)
        addr = UserAddress.objects.filter(id=address_id, user=customer).first() if customer else UserAddress.objects.filter(id=address_id).first()
        if not addr:
            return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'id': str(addr.id),
            'label': addr.title,
            'address': addr.address_line_1,
            'latitude': float(addr.latitude) if addr.latitude else None,
            'longitude': float(addr.longitude) if addr.longitude else None,
            'is_default': addr.is_default
        }, status=status.HTTP_200_OK)

    def patch(self, request, address_id):
        customer = get_customer_from_request(request)
        addr = UserAddress.objects.filter(id=address_id, user=customer).first() if customer else UserAddress.objects.filter(id=address_id).first()
        if not addr:
            return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)

        if 'label' in request.data or 'title' in request.data:
            addr.title = request.data.get('label') or request.data.get('title')
        if 'address' in request.data or 'address_line_1' in request.data:
            addr.address_line_1 = request.data.get('address') or request.data.get('address_line_1')
        if 'latitude' in request.data:
            addr.latitude = Decimal(str(request.data['latitude']))
        if 'longitude' in request.data:
            addr.longitude = Decimal(str(request.data['longitude']))
        if 'is_default' in request.data and request.data['is_default']:
            if customer:
                UserAddress.objects.filter(user=customer).update(is_default=False)
            addr.is_default = True

        addr.save()
        return Response({'message': 'Address updated successfully'}, status=status.HTTP_200_OK)

    def delete(self, request, address_id):
        customer = get_customer_from_request(request)
        addr = UserAddress.objects.filter(id=address_id, user=customer).first() if customer else UserAddress.objects.filter(id=address_id).first()
        if not addr:
            return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)
        addr.delete()
        return Response({'message': 'Address removed successfully'}, status=status.HTTP_200_OK)


class CustomerAddressSetDefaultView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, address_id):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        UserAddress.objects.filter(user=customer).update(is_default=False)
        addr = UserAddress.objects.filter(id=address_id, user=customer).first()
        if not addr:
            return Response({'error': 'Address not found'}, status=status.HTTP_404_NOT_FOUND)

        addr.is_default = True
        addr.save()
        return Response({'message': 'Default address updated successfully', 'address_id': str(addr.id)}, status=status.HTTP_200_OK)


# ============================================================================
# 3. Location & Search APIs
# ============================================================================

class CustomerLocationReverseGeocodeView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        lat = request.query_params.get('lat') or request.query_params.get('latitude')
        lon = request.query_params.get('lon') or request.query_params.get('lng') or request.query_params.get('longitude')
        if not lat or not lon:
            return Response({'error': 'lat and lon are required'}, status=status.HTTP_400_BAD_REQUEST)

        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18&addressdetails=1"
        req = urllib.request.Request(url, headers={'User-Agent': 'RaahGoApp/2.0'})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                display_name = data.get('display_name', f'Location ({lat}, {lon})')
                address_parts = data.get('address', {})
                return Response({
                    'display_name': display_name,
                    'address': display_name,
                    'city': address_parts.get('city') or address_parts.get('town') or address_parts.get('state_district', ''),
                    'state': address_parts.get('state', ''),
                    'postcode': address_parts.get('postcode', ''),
                    'latitude': float(lat),
                    'longitude': float(lon)
                }, status=status.HTTP_200_OK)
        except Exception:
            return Response({
                'display_name': f"Near Pin ({float(lat):.4f}, {float(lon):.4f})",
                'address': f"Near Pin ({float(lat):.4f}, {float(lon):.4f})",
                'latitude': float(lat),
                'longitude': float(lon)
            }, status=status.HTTP_200_OK)


class CustomerLocationSearchView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        if not query:
            return Response({'results': []}, status=status.HTTP_200_OK)

        url = f"https://photon.komoot.io/api/?q={urllib.parse.quote(query)}&limit=6"
        req = urllib.request.Request(url, headers={'User-Agent': 'RaahGoApp/2.0'})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                results = []
                for item in data.get('features', []):
                    props = item.get('properties', {})
                    coords = item.get('geometry', {}).get('coordinates', [])
                    name = props.get('name') or props.get('street') or query
                    city = props.get('city') or props.get('state') or props.get('country', '')
                    full_addr = f"{name}, {city}".strip(', ')
                    if len(coords) == 2:
                        results.append({
                            'name': name,
                            'address': full_addr,
                            'latitude': coords[1],
                            'longitude': coords[0]
                        })
                return Response({'results': results}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'results': []}, status=status.HTTP_200_OK)


class CustomerLocationSuggestionsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon') or request.query_params.get('lng')

        if not query:
            return Response({'suggestions': []}, status=status.HTTP_200_OK)

        url = f"https://photon.komoot.io/api/?q={urllib.parse.quote(query)}&limit=6"
        if lat and lon:
            url += f"&lat={lat}&lon={lon}"

        req = urllib.request.Request(url, headers={'User-Agent': 'RaahGoApp/2.0'})
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                suggestions = []
                for item in data.get('features', []):
                    props = item.get('properties', {})
                    coords = item.get('geometry', {}).get('coordinates', [])
                    name = props.get('name') or props.get('street') or ''
                    city = props.get('city') or props.get('state') or props.get('country', '')
                    display = f"{name}, {city}".strip(', ') or query
                    if len(coords) == 2:
                        dist = 0.0
                        if lat and lon:
                            try:
                                dist = calculate_haversine_distance(float(lat), float(lon), coords[1], coords[0])
                            except Exception:
                                pass
                        suggestions.append({
                            'display_name': display,
                            'title': name or display,
                            'subtitle': city,
                            'lat': coords[1],
                            'lon': coords[0],
                            'distance_km': round(dist, 1)
                        })
                return Response({'suggestions': suggestions}, status=status.HTTP_200_OK)
        except Exception:
            return Response({'suggestions': []}, status=status.HTTP_200_OK)


# ============================================================================
# 4. Ride & Fare Estimation APIs
# ============================================================================

class CustomerRideFareEstimateView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        p_lat = request.data.get('pickup', {}).get('latitude') or request.data.get('pickup_latitude', 28.5708)
        p_lng = request.data.get('pickup', {}).get('longitude') or request.data.get('pickup_longitude', 77.3260)
        d_lat = request.data.get('drop', {}).get('latitude') or request.data.get('dropoff_latitude', 28.6139)
        d_lng = request.data.get('drop', {}).get('longitude') or request.data.get('dropoff_longitude', 77.2090)
        v_type_name = str(request.data.get('vehicle_type', 'bike')).lower()

        dist_km = calculate_haversine_distance(p_lat, p_lng, d_lat, d_lng)
        dist_km = max(1.5, round(dist_km, 1))
        duration_mins = max(5, int(dist_km * 2.2))

        rates = {
            'bike': {'base': 25, 'per_km': 10, 'min': 30},
            'auto': {'base': 35, 'per_km': 14, 'min': 45},
            'e-rickshaw': {'base': 25, 'per_km': 12, 'min': 35},
            'car': {'base': 50, 'per_km': 18, 'min': 70},
            'cab': {'base': 50, 'per_km': 18, 'min': 70},
            'suv': {'base': 80, 'per_km': 24, 'min': 120}
        }
        r = rates.get(v_type_name, rates['bike'])

        base_fare = float(r['base'])
        dist_fare = float(dist_km * r['per_km'])
        tax = round((base_fare + dist_fare) * 0.05, 2)
        discount = 20.0 if (base_fare + dist_fare) > 100 else 0.0
        total = max(r['min'], round(base_fare + dist_fare + tax - discount))

        return Response({
            'distance_km': dist_km,
            'duration_minutes': duration_mins,
            'base_fare': base_fare,
            'distance_fare': dist_fare,
            'tax': tax,
            'discount': discount,
            'total': total,
            'currency': 'INR'
        }, status=status.HTTP_200_OK)


class CustomerVehicleTypesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        types = VehicleType.objects.all()
        if not types.exists():
            # Return default options
            return Response([
                {'id': '1', 'name': 'Bike', 'icon': '🏍️', 'capacity': 1, 'estimated_fare': 45, 'eta': '3 min'},
                {'id': '2', 'name': 'Auto', 'icon': '🛺', 'capacity': 3, 'estimated_fare': 75, 'eta': '5 min'},
                {'id': '3', 'name': 'Car', 'icon': '🚗', 'capacity': 4, 'estimated_fare': 130, 'eta': '6 min'},
                {'id': '4', 'name': 'SUV', 'icon': '🚙', 'capacity': 6, 'estimated_fare': 210, 'eta': '8 min'}
            ], status=status.HTTP_200_OK)

        result = [{
            'id': str(t.id),
            'name': t.name,
            'icon': '🏍️' if 'bike' in t.name.lower() else ('🛺' if 'auto' in t.name.lower() else '🚗'),
            'capacity': t.capacity_passengers or 4,
            'base_fare': float(t.base_fare),
            'per_km_rate': float(t.per_km_rate)
        } for t in types]
        return Response(result, status=status.HTTP_200_OK)


class CustomerRidesView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        customer = get_customer_from_request(request)
        qs = Booking.objects.all().order_by('-created_at')
        if customer:
            qs = qs.filter(customer=customer)

        status_filter = request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status__iexact=status_filter)

        date_from = request.query_params.get('date_from')
        if date_from:
            qs = qs.filter(created_at__gte=date_from)
        date_to = request.query_params.get('date_to')
        if date_to:
            qs = qs.filter(created_at__lte=date_to)

        limit = int(request.query_params.get('limit', 20))
        return Response(BookingSerializer(qs[:limit], many=True).data, status=status.HTTP_200_OK)

    def post(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer authentication required'}, status=status.HTTP_401_UNAUTHORIZED)

        # Parse pickup & drop
        pickup_data = request.data.get('pickup') or {}
        drop_data = request.data.get('drop') or {}

        p_lat = pickup_data.get('latitude') or request.data.get('pickup_latitude') or 28.4415
        p_lng = pickup_data.get('longitude') or request.data.get('pickup_longitude') or 77.0395
        p_addr = pickup_data.get('address') or request.data.get('pickup_address', 'Current Location')

        d_lat = drop_data.get('latitude') or request.data.get('dropoff_latitude') or 28.5355
        d_lng = drop_data.get('longitude') or request.data.get('dropoff_longitude') or 77.3910
        d_addr = drop_data.get('address') or request.data.get('dropoff_address', 'Selected Destination')

        v_type_name = request.data.get('vehicle_type') or request.data.get('selected_ride', 'bike')
        dist_km = Decimal(str(request.data.get('distance_km', '5.0')))
        fare = Decimal(str(request.data.get('total_fare', request.data.get('base_fare', '65.0'))))

        # Vehicle Type
        v_type = VehicleType.objects.filter(name__iexact=v_type_name).first() or VehicleType.objects.first()
        pin = f"{random.randint(1000, 9999)}"

        booking = Booking.objects.create(
            booking_number=f"RG{random.randint(10000000, 99999999)}",
            customer=customer,
            vehicle_type=v_type,
            pickup_address=p_addr,
            pickup_latitude=Decimal(str(p_lat)),
            pickup_longitude=Decimal(str(p_lng)),
            dropoff_address=d_addr,
            dropoff_latitude=Decimal(str(d_lat)),
            dropoff_longitude=Decimal(str(d_lng)),
            distance_km=dist_km,
            estimated_duration_mins=int(dist_km * 2),
            base_fare=fare,
            total_fare=fare,
            ride_pin=pin,
            payment_method=request.data.get('payment_method', Booking.PaymentMethod.CASH),
            status=Booking.BookingStatus.SEARCHING
        )

        RideDetail.objects.create(
            booking=booking,
            passenger_count=1,
            notes_for_driver=request.data.get('notes_for_driver', '')
        )

        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.SEARCHING,
            remarks="Ride created, finding nearest captains."
        )

        return Response(BookingSerializer(booking).data, status=status.HTTP_201_CREATED)


class CustomerActiveRideView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response(None, status=status.HTTP_200_OK)

        active = Booking.objects.filter(
            customer=customer,
            status__in=[
                Booking.BookingStatus.SEARCHING,
                Booking.BookingStatus.ACCEPTED,
                Booking.BookingStatus.ARRIVED,
                Booking.BookingStatus.IN_TRIP
            ]
        ).order_by('-created_at').first()

        if not active:
            return Response(None, status=status.HTTP_200_OK)

        # Auto-cancel after customer_wait_time min if still Searching
        if active.status == Booking.BookingStatus.SEARCHING:
            try:
                wait_time_mins = int(SystemSetting.get_setting('customer_wait_time', '5') or 5)
            except Exception:
                wait_time_mins = 5
            cutoff = timezone.now() - timedelta(minutes=wait_time_mins)
            if active.created_at <= cutoff:
                active.status = Booking.BookingStatus.CANCELLED
                active.save()
                BookingTracking.objects.create(
                    booking=active,
                    status=Booking.BookingStatus.CANCELLED,
                    remarks=f'Auto-cancelled: no driver found within {wait_time_mins} minutes.'
                )
                return Response({'auto_cancelled': True, 'booking': BookingSerializer(active).data}, status=status.HTTP_200_OK)

        return Response(BookingSerializer(active).data, status=status.HTTP_200_OK)


class CustomerRideDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id):
        booking = Booking.objects.filter(Q(id=ride_id) | Q(booking_number=ride_id)).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


class CustomerRideDriverView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id):
        booking = Booking.objects.filter(Q(id=ride_id) | Q(booking_number=ride_id)).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        if not booking.driver:
            return Response({
                'ride_id': booking.booking_number,
                'status': 'searching_driver',
                'driver': None
            }, status=status.HTTP_200_OK)

        driver = booking.driver
        user = driver.user
        vehicle = driver.vehicles.first()

        return Response({
            'ride_id': booking.booking_number,
            'status': 'driver_assigned',
            'driver': {
                'id': str(driver.id),
                'name': f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username,
                'rating': float(driver.rating),
                'phone': user.phone_number or '********21',
                'profile_image': user.profile_image or '',
                'vehicle': {
                    'type': vehicle.vehicle_type.name if (vehicle and vehicle.vehicle_type) else 'Bike',
                    'model': f"{vehicle.make} {vehicle.model}" if vehicle else 'Commercial Express',
                    'number': vehicle.registration_number if vehicle else 'DL 01 AB 1234'
                }
            }
        }, status=status.HTTP_200_OK)


class CustomerRideLocationView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id):
        booking = Booking.objects.filter(Q(id=ride_id) | Q(booking_number=ride_id)).first()
        if not booking or not booking.driver:
            return Response({'latitude': 28.4415, 'longitude': 77.0395, 'bearing': 0, 'speed': 0}, status=status.HTTP_200_OK)

        driver = booking.driver
        loc = DriverLocation.objects.filter(driver=driver).order_by('-timestamp').first()
        lat = float(loc.latitude) if loc else (float(driver.current_latitude) if driver.current_latitude else 28.4415)
        lng = float(loc.longitude) if loc else (float(driver.current_longitude) if driver.current_longitude else 77.0395)

        return Response({
            'event': 'driver_location',
            'latitude': lat,
            'longitude': lng,
            'bearing': float(loc.heading) if loc else 0,
            'speed': float(loc.speed) if loc else 25
        }, status=status.HTTP_200_OK)


class CustomerRideStatusView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id):
        booking = Booking.objects.filter(Q(id=ride_id) | Q(booking_number=ride_id)).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        status_map = {
            'Searching': 'searching_driver',
            'Accepted': 'driver_assigned',
            'Arrived': 'driver_arrived',
            'In Trip': 'trip_started',
            'Completed': 'trip_completed',
            'Cancelled': 'cancelled_by_customer'
        }

        return Response({
            'ride_id': booking.booking_number,
            'status': status_map.get(booking.status, booking.status.lower()),
            'booking_status': booking.status,
            'ride_pin': booking.ride_pin,
            'total_fare': float(booking.total_fare)
        }, status=status.HTTP_200_OK)


class CustomerRideCancelReasonsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id=None):
        return Response({
            'reasons': [
                {'id': 1, 'reason': 'Driver is taking too long to arrive'},
                {'id': 2, 'reason': 'Driver requested to cancel'},
                {'id': 3, 'reason': 'Selected wrong pickup or drop location'},
                {'id': 4, 'reason': 'Changed my mind / No longer needed'},
                {'id': 5, 'reason': 'Booked another ride'}
            ]
        }, status=status.HTTP_200_OK)


class CustomerRideCancelView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, ride_id):
        booking = Booking.objects.filter(Q(id=ride_id) | Q(booking_number=ride_id)).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        reason = request.data.get('comment') or request.data.get('reason', 'Cancelled by customer')
        booking.status = Booking.BookingStatus.CANCELLED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=Booking.BookingStatus.CANCELLED,
            remarks=f"Cancelled by customer: {reason}"
        )
        return Response({'message': 'Ride cancelled successfully', 'ride_id': booking.booking_number}, status=status.HTTP_200_OK)


class CustomerRideInvoiceView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id):
        booking = Booking.objects.filter(Q(id=ride_id) | Q(booking_number=ride_id)).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        fare = float(booking.total_fare)
        base = round(fare * 0.70, 2)
        dist_charge = round(fare * 0.25, 2)
        tax = round(fare * 0.05, 2)

        return Response({
            'invoice_number': f"INV-{booking.booking_number}",
            'ride_id': booking.booking_number,
            'pickup': booking.pickup_address,
            'dropoff': booking.dropoff_address,
            'distance_km': float(booking.distance_km),
            'base_fare': base,
            'distance_charge': dist_charge,
            'taxes': tax,
            'total_fare': fare,
            'payment_status': booking.payment_status,
            'payment_method': booking.payment_method,
            'date': booking.created_at
        }, status=status.HTTP_200_OK)


class CustomerRideRatingView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, ride_id):
        rating_obj = Rating.objects.filter(booking__id=ride_id).first() or Rating.objects.filter(booking__booking_number=ride_id).first()
        if not rating_obj:
            return Response({'is_rated': False}, status=status.HTTP_200_OK)
        return Response({
            'is_rated': True,
            'rating': rating_obj.rating,
            'comment': rating_obj.comment,
            'created_at': rating_obj.created_at
        }, status=status.HTTP_200_OK)

    def post(self, request, ride_id):
        customer = get_customer_from_request(request)
        booking = Booking.objects.filter(Q(id=ride_id) | Q(booking_number=ride_id)).first()
        if not booking:
            return Response({'error': 'Ride not found'}, status=status.HTTP_404_NOT_FOUND)

        score = int(request.data.get('rating', 5))
        comment = request.data.get('comment', '')

        rating_obj, _ = Rating.objects.get_or_create(
            booking=booking,
            reviewer=customer or booking.customer,
            defaults={
                'reviewee_driver': booking.driver,
                'rating': score,
                'comment': comment
            }
        )

        # Update Driver overall rating
        if booking.driver:
            avg_score = Rating.objects.filter(reviewee_driver=booking.driver).aggregate(a=Avg('rating'))['a'] or score
            booking.driver.rating = Decimal(str(round(avg_score, 2)))
            booking.driver.save()

        return Response({
            'message': 'Thank you! Rating submitted successfully.',
            'rating': rating_obj.rating,
            'comment': rating_obj.comment
        }, status=status.HTTP_201_CREATED)


# ============================================================================
# 5. Payment & Wallet APIs
# ============================================================================

class CustomerPaymentMethodsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'methods': [
                {'id': 'cash', 'name': 'Cash on Delivery', 'icon': '💵', 'enabled': True},
                {'id': 'upi', 'name': 'UPI (GPay / PhonePe / Paytm)', 'icon': '⚡', 'enabled': True, 'default': True},
                {'id': 'card', 'name': 'Credit / Debit Cards', 'icon': '💳', 'enabled': True},
                {'id': 'wallet', 'name': 'RaahGo Pay Wallet', 'icon': '👛', 'enabled': True},
                {'id': 'coins', 'name': 'RaahGo Coins', 'icon': '🪙', 'enabled': True}
            ]
        }, status=status.HTTP_200_OK)


class CustomerPaymentCreateOrderView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        customer = get_customer_from_request(request)
        amount = request.data.get('amount', 100)
        ride_id = request.data.get('ride_id')

        order_id = f"ORDER_{random.randint(100000, 999999)}"
        return Response({
            'order_id': order_id,
            'amount': float(amount),
            'currency': 'INR',
            'customer_id': str(customer.id) if customer else None,
            'ride_id': ride_id,
            'gateway_url': f"https://api.raahgo.com/pay/{order_id}"
        }, status=status.HTTP_201_CREATED)


class CustomerPaymentVerifyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        order_id = request.data.get('order_id')
        return Response({
            'status': 'success',
            'transaction_id': f"TXN_{random.randint(10000000, 99999999)}",
            'order_id': order_id,
            'message': 'Payment verified successfully.'
        }, status=status.HTTP_200_OK)


class CustomerWalletView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'balance': 0.0, 'currency': 'INR'}, status=status.HTTP_200_OK)

        wallet, _ = Wallet.objects.get_or_create(user=customer)
        return Response({
            'balance': float(wallet.balance),
            'currency': wallet.currency,
            'wallet_id': str(wallet.id)
        }, status=status.HTTP_200_OK)


class CustomerWalletTransactionsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response([], status=status.HTTP_200_OK)

        wallet, _ = Wallet.objects.get_or_create(user=customer)
        txns = wallet.transactions.all().order_by('-created_at')[:20]
        return Response([{
            'id': str(t.id),
            'type': t.transaction_type.lower(),
            'amount': float(t.amount),
            'description': t.description,
            'created_at': t.created_at
        } for t in txns], status=status.HTTP_200_OK)


class CustomerWalletAddMoneyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

        amount = Decimal(str(request.data.get('amount', '100.00')))
        wallet, _ = Wallet.objects.get_or_create(user=customer)
        wallet.balance += amount
        wallet.save()

        WalletTransaction.objects.create(
            wallet=wallet,
            amount=amount,
            transaction_type=WalletTransaction.TransactionType.CREDIT,
            description=f"Added money via {request.data.get('payment_method', 'UPI')}"
        )

        return Response({
            'message': f"₹{amount} added to wallet successfully",
            'new_balance': float(wallet.balance)
        }, status=status.HTTP_200_OK)


# ============================================================================
# 6. RaahGo Coins APIs
# ============================================================================

class CustomerCoinsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'balance': 150,
            'value': 150,
            'currency': 'INR',
            'rate': '1 Coin = ₹1'
        }, status=status.HTTP_200_OK)


class CustomerCoinsBalanceView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({'balance': 150, 'value': 150, 'currency': 'INR'}, status=status.HTTP_200_OK)


class CustomerCoinsTransactionsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'transactions': [
                {'id': 'TX1', 'type': 'earned', 'coins': 100, 'reason': 'Welcome Signup Bonus', 'created_at': '2026-08-16T10:00:00Z'},
                {'id': 'TX2', 'type': 'earned', 'coins': 50, 'reason': 'Completed First Bike Ride', 'created_at': '2026-08-16T12:30:00Z'}
            ]
        }, status=status.HTTP_200_OK)


class CustomerCoinsRewardsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'rewards': [
                {'id': 'R1', 'title': '₹25 Off Any Bike Ride', 'cost_coins': 25, 'is_available': True},
                {'id': 'R2', 'title': '₹50 Off Any Auto Ride', 'cost_coins': 50, 'is_available': True},
                {'id': 'R3', 'title': 'Free 1-Hour Power Pass', 'cost_coins': 100, 'is_available': True}
            ]
        }, status=status.HTTP_200_OK)


class CustomerCoinsOffersView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'offers': [
                {'id': 'O1', 'code': 'DOUBLECOIN', 'description': 'Earn 2x Coins on every Auto trip this weekend!'},
                {'id': 'O2', 'code': 'RAINYDAY', 'description': 'Flat 30% coins cashback on Cab rides during rain.'}
            ]
        }, status=status.HTTP_200_OK)


class CustomerCoinsRedeemView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        coins = int(request.data.get('coins', 50))
        return Response({
            'message': f"{coins} coins redeemed successfully! ₹{coins} discount will apply to your next trip.",
            'discount_amount': coins,
            'remaining_coins': max(0, 150 - coins)
        }, status=status.HTTP_200_OK)


# ============================================================================
# 7. Coupons APIs
# ============================================================================

class CustomerCouponsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        coupons = Coupon.objects.filter(is_active=True)
        if not coupons.exists():
            return Response([
                {'code': 'RAAHGO50', 'title': '₹50 Off on First Ride', 'discount': '50', 'discount_type': 'Flat', 'min_fare': 50},
                {'code': 'SUPERBIKE', 'title': '20% Off on Bike Rides', 'discount': '20', 'discount_type': 'Percentage', 'min_fare': 30}
            ], status=status.HTTP_200_OK)

        return Response([{
            'code': c.code,
            'discount': float(c.discount_value),
            'discount_type': c.discount_type,
            'min_booking_amount': float(c.min_booking_amount)
        } for c in coupons], status=status.HTTP_200_OK)


class CustomerCouponApplyView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        code = request.data.get('code', '').strip().upper()
        ride_id = request.data.get('ride_id')

        discount = 50.0 if code == 'RAAHGO50' else 20.0
        return Response({
            'success': True,
            'code': code,
            'discount_amount': discount,
            'message': f"Coupon {code} applied successfully! Saved ₹{discount}."
        }, status=status.HTTP_200_OK)


class CustomerCouponRemoveView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        return Response({'success': True, 'message': 'Coupon removed successfully'}, status=status.HTTP_200_OK)


# ============================================================================
# 8. Notifications APIs
# ============================================================================

class CustomerNotificationsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        customer = get_customer_from_request(request)
        if not customer:
            return Response([], status=status.HTTP_200_OK)

        notifs = Notification.objects.filter(user=customer).order_by('-created_at')[:25]
        if not notifs.exists():
            return Response([
                {'id': '1001', 'title': '20% Off Bike Rides Today! 🚀', 'message': 'Use coupon RAAHGO20 for instant discount.', 'type': 'promotional', 'is_read': False, 'created_at': timezone.now()},
                {'id': '1002', 'title': 'Welcome to RaahGo! 🎉', 'message': 'Your account is verified. Have safe rides with verified captains.', 'type': 'system', 'is_read': True, 'created_at': timezone.now()}
            ], status=status.HTTP_200_OK)

        return Response([{
            'id': str(n.id),
            'title': n.title,
            'message': n.body,
            'type': n.notification_type.lower(),
            'is_read': n.is_read,
            'created_at': n.created_at
        } for n in notifs], status=status.HTTP_200_OK)


class CustomerNotificationReadView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, notif_id):
        customer = get_customer_from_request(request)
        if notif_id == 'read-all':
            if customer:
                Notification.objects.filter(user=customer).update(is_read=True)
            return Response({'message': 'All notifications marked as read'}, status=status.HTTP_200_OK)

        notif = Notification.objects.filter(id=notif_id).first()
        if notif:
            notif.is_read = True
            notif.save()
        return Response({'message': 'Notification marked as read'}, status=status.HTTP_200_OK)


# ============================================================================
# 9. Claims, Safety & Emergency SOS
# ============================================================================

class CustomerClaimsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'coverage': {
                'title': '₹5,00,000 Complimentary Ride Insurance',
                'provider': 'RaahGo Passenger Protection Cover',
                'active': True
            },
            'claims_history': []
        }, status=status.HTTP_200_OK)

    def post(self, request):
        ride_id = request.data.get('ride_id')
        incident_type = request.data.get('incident_type', 'Medical / Accidental')
        description = request.data.get('description', '')

        claim_num = f"CLM_{random.randint(100000, 999999)}"
        return Response({
            'message': 'Claim filed successfully. Our insurance support executive will contact you within 24 hours.',
            'claim_number': claim_num,
            'status': 'Under Review'
        }, status=status.HTTP_201_CREATED)


class CustomerEmergencyContactsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'emergency_contacts': [
                {'id': '1', 'name': 'Police Control Room', 'phone': '112', 'is_sos': True},
                {'id': '2', 'name': 'RaahGo Safety Rapid Response', 'phone': '1800-123-456', 'is_sos': True}
            ]
        }, status=status.HTTP_200_OK)


class CustomerSafetySosView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ride_id = request.data.get('ride_id')
        lat = request.data.get('latitude', 28.4415)
        lng = request.data.get('longitude', 77.0395)

        print(f"\n🚨 [CUSTOMER SOS TRIGGERED] Ride: {ride_id} | GPS: ({lat}, {lng}) 🚨\n")
        return Response({
            'status': 'SOS_ACTIVATED',
            'message': 'Emergency SOS Alert broadcasted. Police (112) & RaahGo Emergency Team notified of your live GPS coordinates.',
            'helpline': '112'
        }, status=status.HTTP_200_OK)


# ============================================================================
# 10. Settings & Support
# ============================================================================

class CustomerSettingsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'push_notifications': True,
            'sms_alerts': True,
            'email_receipts': True,
            'language': 'en',
            'language_display': 'English (India)',
            'dark_mode': False
        }, status=status.HTTP_200_OK)

    def patch(self, request):
        return Response({
            'message': 'Settings updated successfully',
            'settings': request.data
        }, status=status.HTTP_200_OK)


class CustomerSupportTicketsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        return Response({
            'tickets': [
                {'id': 'TKT101', 'subject': 'Fare inquiry for ride #RG882910', 'status': 'Resolved', 'created_at': '2026-08-15'}
            ]
        }, status=status.HTTP_200_OK)

    def post(self, request):
        subject = request.data.get('subject', 'General Inquiry')
        message = request.data.get('message', '')
        ticket_id = f"TKT_{random.randint(10000, 99999)}"

        return Response({
            'message': 'Support ticket created successfully. Our team will respond shortly.',
            'ticket_id': ticket_id,
            'subject': subject,
            'status': 'Open'
        }, status=status.HTTP_201_CREATED)
