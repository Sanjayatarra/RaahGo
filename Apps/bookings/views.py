import os
import math
import random
from datetime import timedelta
from decimal import Decimal
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone

from .models import Booking, RideDetail, ParcelDetail, MovingDetail, BookingTracking
from .serializers import (
    BookingSerializer,
    RideDetailSerializer,
    ParcelDetailSerializer,
    MovingDetailSerializer,
    BookingTrackingSerializer
)
from vehicles.models import VehicleType

# Auto-cancel a Searching ride after this many minutes with no driver
AUTO_CANCEL_SEARCHING_MINUTES = 15


def calculate_haversine_distance(lat1, lon1, lat2, lon2):
    try:
        R = 6371.0 # Radius of Earth in km
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return R * c
    except Exception:
        return 0.0


class BookingViewSet(viewsets.ModelViewSet):
    serializer_class = BookingSerializer
    permission_classes = [permissions.AllowAny]

    def get_queryset(self):
        user = self.request.user
        qs = Booking.objects.all().order_by('-created_at')

        # 1. Scope by authenticated user identity
        if user and user.is_authenticated:
            if hasattr(user, 'role') and user.role == 'Driver':
                # Driver sees rides assigned to them or active rides
                from django.db.models import Q
                qs = qs.filter(Q(driver__user=user) | Q(status__in=[Booking.BookingStatus.SEARCHING, Booking.BookingStatus.ACCEPTED, Booking.BookingStatus.IN_TRIP]))
            elif hasattr(user, 'role') and user.role == 'Customer':
                # Customer only sees their own bookings
                qs = qs.filter(customer=user)

        # 2. Filter by explicit query parameters
        customer_id = self.request.query_params.get('customer_id') or self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        driver_id = self.request.query_params.get('driver_id') or self.request.query_params.get('driver')
        if driver_id:
            qs = qs.filter(driver_id=driver_id)

        status_param = self.request.query_params.get('status')
        if status_param:
            statuses = [s.strip() for s in status_param.split(',') if s.strip()]
            qs = qs.filter(status__in=statuses)

        # 3. Distance filter if GPS coordinates are provided
        driver_lat = self.request.query_params.get('driver_lat') or self.request.query_params.get('lat')
        driver_lng = self.request.query_params.get('driver_lng') or self.request.query_params.get('lng')
        max_dist_param = self.request.query_params.get('max_distance', 5.0)

        if driver_lat and driver_lng:
            try:
                d_lat = float(driver_lat)
                d_lng = float(driver_lng)
                max_dist = float(max_dist_param)
                filtered_ids = []
                for b in qs:
                    if b.status == Booking.BookingStatus.SEARCHING:
                        if b.pickup_latitude and b.pickup_longitude:
                            dist = calculate_haversine_distance(d_lat, d_lng, b.pickup_latitude, b.pickup_longitude)
                            if dist <= max_dist:
                                filtered_ids.append(b.id)
                        else:
                            filtered_ids.append(b.id)
                    else:
                        filtered_ids.append(b.id)
                qs = qs.filter(id__in=filtered_ids)
            except Exception as e:
                print('Distance query filter notice:', e)

        # 4. Limit to recent records by default to avoid returning stale historical dumps
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                qs = qs[:int(limit)]
            except ValueError:
                pass
        elif not self.request.query_params.get('all') and not self.kwargs.get('pk'):
            qs = qs[:20]

        return qs

    # ── Active ride endpoint ────────────────────────────────────────────────
    @action(detail=False, methods=['get'], url_path='active')
    def active_ride(self, request):
        """
        GET /api/v1/bookings/bookings/active/
        Returns the customer's current non-terminal booking, auto-cancelling
        any Searching ride that has been waiting longer than AUTO_CANCEL_SEARCHING_MINUTES.
        """
        from users.models import User
        user = request.user
        customer = None

        if user and getattr(user, 'is_authenticated', False) and isinstance(user, User):
            customer = user
        else:
            customer_id = request.query_params.get('customer_id')
            if customer_id:
                customer = User.objects.filter(id=customer_id, role=User.RoleChoices.CUSTOMER).first()

        if not customer:
            return Response(None, status=status.HTTP_200_OK)

        active = Booking.objects.filter(
            customer=customer,
            status__in=[
                Booking.BookingStatus.SEARCHING,
                Booking.BookingStatus.ACCEPTED,
                Booking.BookingStatus.ARRIVED,
                Booking.BookingStatus.IN_TRIP,
            ]
        ).order_by('-created_at').first()

        if not active:
            return Response(None, status=status.HTTP_200_OK)

        # Auto-cancel if Searching for longer than AUTO_CANCEL_SEARCHING_MINUTES
        if active.status == Booking.BookingStatus.SEARCHING:
            cutoff = timezone.now() - timedelta(minutes=AUTO_CANCEL_SEARCHING_MINUTES)
            if active.created_at <= cutoff:
                active.status = Booking.BookingStatus.CANCELLED
                active.save()
                BookingTracking.objects.create(
                    booking=active,
                    status=Booking.BookingStatus.CANCELLED,
                    remarks=f'Auto-cancelled: no driver found within {AUTO_CANCEL_SEARCHING_MINUTES} minutes.'
                )
                return Response(
                    {'auto_cancelled': True, 'booking': BookingSerializer(active).data},
                    status=status.HTTP_200_OK
                )

        return Response(BookingSerializer(active).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def searching_nearby(self, request):
        driver_id = request.query_params.get('driver_id')
        driver_lat = request.query_params.get('driver_lat') or request.query_params.get('lat')
        driver_lng = request.query_params.get('driver_lng') or request.query_params.get('lng')
        max_dist_param = request.query_params.get('max_distance', 5.0)

        # 1. Determine Driver's Registered Vehicle Type
        driver_v_name = None
        if driver_id:
            from drivers.models import Driver
            driver_obj = Driver.objects.filter(id=driver_id).first()
            if driver_obj and driver_obj.vehicles.exists():
                driver_v_name = driver_obj.vehicles.first().vehicle_type.name

        # Strictly filter Searching status in Django Backend DB
        qs = Booking.objects.filter(status=Booking.BookingStatus.SEARCHING).order_by('-created_at')

        nearby_list = []
        try:
            max_dist = float(max_dist_param)
            d_lat = float(driver_lat) if driver_lat else None
            d_lng = float(driver_lng) if driver_lng else None

            for b in qs:
                # Vehicle Type Matching Check (e.g. Bike vs Bike, Auto vs Auto, Sedan vs Sedan, SUV vs SUV)
                if driver_v_name and b.vehicle_type:
                    if driver_v_name.strip().lower() != b.vehicle_type.name.strip().lower():
                        continue # Skip ride request if vehicle type does not match driver's registered vehicle!

                # Proximity 5 km Check
                if d_lat and d_lng:
                    if b.pickup_latitude and b.pickup_longitude:
                        dist = calculate_haversine_distance(d_lat, d_lng, b.pickup_latitude, b.pickup_longitude)
                        if dist <= max_dist:
                            nearby_list.append(b)
                    else:
                        nearby_list.append(b)
                else:
                    nearby_list.append(b)
        except Exception as e:
            print('searching_nearby error:', e)
            nearby_list = list(qs)

        serializer = self.get_serializer(nearby_list, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def perform_create(self, serializer):
        from users.models import User
        from services.models import Service
        from vehicles.models import VehicleType
        from drivers.models import Driver

        # ── Auto-cancel stale Searching rides before allowing a new booking ──
        user = self.request.user
        if user and getattr(user, 'is_authenticated', False) and isinstance(user, User):
            cutoff = timezone.now() - timedelta(minutes=AUTO_CANCEL_SEARCHING_MINUTES)
            stale = Booking.objects.filter(
                customer=user,
                status=Booking.BookingStatus.SEARCHING,
                created_at__lte=cutoff
            )
            for b in stale:
                b.status = Booking.BookingStatus.CANCELLED
                b.save()
                BookingTracking.objects.create(
                    booking=b,
                    status=Booking.BookingStatus.CANCELLED,
                    remarks=f'Auto-cancelled: no driver found within {AUTO_CANCEL_SEARCHING_MINUTES} minutes.'
                )
        # ─────────────────────────────────────────────────────────────────────

        # 1. Parse Selected Ride Vehicle Type (Bike, Auto, Sedan, SUV)
        selected_ride_param = self.request.data.get('selected_ride') or self.request.data.get('ride_type') or self.request.data.get('vehicle_type_name') or 'sedan'
        v_name_map = {
            'bike': 'Bike',
            'auto': 'Auto',
            'e-rickshaw': 'E-Rickshaw',
            'car': 'Car',
            'taxi': 'Taxi',
            'sedan': 'Sedan',
            'suv': 'SUV'
        }
        target_v_name = v_name_map.get(str(selected_ride_param).lower(), str(selected_ride_param).capitalize())

        vehicle_type, _ = VehicleType.objects.get_or_create(
            name=target_v_name,
            defaults={
                "base_fare": Decimal('50.00'),
                "per_km_rate": Decimal('12.00'),
                "per_minute_rate": Decimal('2.00')
            }
        )

        # 2. 4-Stage Matching Pipeline: VehicleType -> Driver Vehicle -> Online Status -> 5 km Proximity
        pickup_lat = self.request.data.get('pickup_latitude')
        pickup_lng = self.request.data.get('pickup_longitude')

        # Filter Captains with matching vehicle type & Online status
        matched_online_drivers = Driver.objects.filter(
            vehicles__vehicle_type=vehicle_type,
            availability_status=Driver.AvailabilityStatus.ONLINE
        ).distinct()

        eligible_notification_captains = []

        if pickup_lat and pickup_lng:
            for drv in matched_online_drivers:
                if drv.current_latitude and drv.current_longitude:
                    d_km = calculate_haversine_distance(pickup_lat, pickup_lng, drv.current_latitude, drv.current_longitude)
                    if d_km <= 5.0:
                        eligible_notification_captains.append((drv, d_km))

            print(f"\n==========================================")
            print(f"🚖 [4-STAGE MATCHING PIPELINE CHECK]")
            print(f"Requested Vehicle Type: {vehicle_type.name}")
            print(f"Total Captains Registered with {vehicle_type.name}: {Driver.objects.filter(vehicles__vehicle_type=vehicle_type).distinct().count()}")
            print(f"Matched Captains Currently ONLINE: {matched_online_drivers.count()}")
            print(f"Eligible Captains Notified (Matched Vehicle + ONLINE + <= 5 km): {len(eligible_notification_captains)}")
            print(f"==========================================\n")

        # Default Customer
        customer = None
        if self.request.user and getattr(self.request.user, 'is_authenticated', False) and isinstance(self.request.user, User):
            customer = self.request.user
        else:
            customer = User.objects.filter(role=User.RoleChoices.CUSTOMER).first()
            if not customer:
                customer = User.objects.create(
                    username=f"customer_{random.randint(1000, 9999)}",
                    role=User.RoleChoices.CUSTOMER,
                    first_name="Rider",
                    is_verified=True
                )

        # Default Service
        service, _ = Service.objects.get_or_create(
            name="City Ride",
            defaults={"description": "Standard Point to Point City Cab"}
        )

        booking_num = f"RG{random.randint(10000000, 99999999)}"

        kwargs = {
            'booking_number': booking_num,
        }
        if not serializer.validated_data.get('customer'):
            kwargs['customer'] = customer
        if not serializer.validated_data.get('service'):
            kwargs['service'] = service
        if not serializer.validated_data.get('vehicle_type'):
            kwargs['vehicle_type'] = vehicle_type

        booking = serializer.save(**kwargs)

        # Create RideDetail with notes_for_driver if provided
        notes = self.request.data.get('notes_for_driver') or self.request.data.get('notes')
        RideDetail.objects.create(
            booking=booking,
            notes_for_driver=notes or "",
            passenger_count=1
        )
        
        # Log initial status tracking
        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks="Booking created, searching for driver."
        )

    @action(detail=False, methods=['post'])
    def calculate_fare(self, request):
        vehicle_type_id = request.data.get('vehicle_type_id')
        distance_km = Decimal(str(request.data.get('distance_km', '0.0')))
        duration_mins = Decimal(str(request.data.get('estimated_duration_mins', '0')))

        try:
            vehicle_type = VehicleType.objects.get(id=vehicle_type_id)
        except VehicleType.DoesNotExist:
            return Response({'error': 'Vehicle type not found'}, status=status.HTTP_404_NOT_FOUND)

        base_fare = vehicle_type.base_fare + (distance_km * vehicle_type.per_km_rate) + (duration_mins * vehicle_type.per_minute_rate)
        tax_amount = base_fare * Decimal('0.05')  # 5% tax
        total_fare = base_fare + tax_amount

        return Response({
            'base_fare': round(base_fare, 2),
            'tax_amount': round(tax_amount, 2),
            'total_fare': round(total_fare, 2)
        }, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def accept(self, request, pk=None):
        booking = self.get_object()
        driver_id = request.data.get('driver_id')
        
        from drivers.models import Driver
        driver = None
        if driver_id:
            driver = Driver.objects.filter(id=driver_id).first()
        if not driver:
            driver = Driver.objects.first()

        if driver:
            booking.driver = driver

        booking.status = Booking.BookingStatus.ACCEPTED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks=f"Accepted by driver {driver.user.first_name if (driver and driver.user) else ''}"
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def start_trip(self, request, pk=None):
        booking = self.get_object()
        entered_pin = str(request.data.get('pin', '')).strip()
        expected_pin = str(booking.ride_pin or '4829').strip()

        if entered_pin != expected_pin:
            return Response({
                'error': f'Incorrect PIN "{entered_pin}". Please ask customer for correct 4-digit PIN.'
            }, status=status.HTTP_400_BAD_REQUEST)

        booking.status = Booking.BookingStatus.IN_TRIP
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks=f"Trip started - Customer PIN {entered_pin} verified successfully"
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        booking = self.get_object()
        booking.status = Booking.BookingStatus.COMPLETED
        booking.payment_status = Booking.PaymentStatus.PAID
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks="Trip completed successfully"
        )
        return Response({'status': 'Trip completed'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        booking = self.get_object()
        reason = request.data.get('reason', 'Cancelled by user')
        booking.status = Booking.BookingStatus.CANCELLED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks=f"Cancelled: {reason}"
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def decline(self, request, pk=None):
        booking = self.get_object()
        reason = request.data.get('reason', 'Declined by driver')
        booking.status = Booking.BookingStatus.CANCELLED
        booking.save()

        BookingTracking.objects.create(
            booking=booking,
            status=booking.status,
            remarks=f"Declined by driver: {reason}"
        )
        return Response(BookingSerializer(booking).data, status=status.HTTP_200_OK)


class RideDetailViewSet(viewsets.ModelViewSet):
    queryset = RideDetail.objects.all()
    serializer_class = RideDetailSerializer


class ParcelDetailViewSet(viewsets.ModelViewSet):
    queryset = ParcelDetail.objects.all()
    serializer_class = ParcelDetailSerializer


class MovingDetailViewSet(viewsets.ModelViewSet):
    queryset = MovingDetail.objects.all()
    serializer_class = MovingDetailSerializer


class BookingTrackingViewSet(viewsets.ModelViewSet):
    queryset = BookingTracking.objects.all()
    serializer_class = BookingTrackingSerializer


from rest_framework.views import APIView
import urllib.request
import urllib.parse
import json

class LocationSuggestionView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        lat = request.query_params.get('lat')
        lon = request.query_params.get('lon')
        
        if not query:
            return Response({'suggestions': []}, status=status.HTTP_200_OK)
        
        # OpenStreetMap Photon API for fetching real locations (Higher rate limits)
        url = f"https://photon.komoot.io/api/?q={urllib.parse.quote(query)}&limit=6"
        if lat and lon:
            url += f"&lat={lat}&lon={lon}"
            
        req = urllib.request.Request(url, headers={'User-Agent': 'RaahGoApp/1.0'})
        
        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                
                # Simplify response structure for frontend
                suggestions = []
                for item in data.get('features', []):
                    props = item.get('properties', {})
                    
                    # Extract name/address parts
                    name = props.get('name') or props.get('street') or props.get('district') or ''
                    city = props.get('city') or props.get('state') or props.get('county') or ''
                    
                    parts = [name, city, props.get('country', '')]
                    # Filter out empty strings and duplicates while preserving order
                    seen = set()
                    filtered_parts = [p for p in parts if p and not (p in seen or seen.add(p))]
                    display_name = ', '.join(filtered_parts)
                    
                    coords = item.get('geometry', {}).get('coordinates', [])
                    
                    if len(coords) == 2:
                        dist_km = 0.0
                        if lat and lon:
                            try:
                                dist_km = calculate_haversine_distance(float(lat), float(lon), coords[1], coords[0])
                            except Exception:
                                pass
                                
                        # max_radius km restriction
                        radius_str = os.getenv('LOCATION_SUGGESTION_RADIUS_KM', '50')
                        try:
                            max_radius = float(radius_str)
                        except ValueError:
                            max_radius = 50.0

                        if lat and lon and dist_km > max_radius:
                            continue

                        suggestions.append({
                            'display_name': display_name,
                            'lat': coords[1], # Photon returns [lon, lat]
                            'lon': coords[0],
                            'type': props.get('osm_value', 'location'),
                            'distanceKm': dist_km
                        })
                return Response({'suggestions': suggestions}, status=status.HTTP_200_OK)
        except Exception as e:
            print('Location autocomplete error:', e)
            return Response({'suggestions': []}, status=status.HTTP_200_OK)
