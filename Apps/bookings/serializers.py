from rest_framework import serializers
from users.models import User
from services.models import Service
from vehicles.models import VehicleType
from .models import Booking, RideDetail, ParcelDetail, MovingDetail, BookingTracking


class RideDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = RideDetail
        fields = '__all__'


class ParcelDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = ParcelDetail
        fields = '__all__'


class MovingDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = MovingDetail
        fields = '__all__'


class BookingTrackingSerializer(serializers.ModelSerializer):
    class Meta:
        model = BookingTracking
        fields = '__all__'


class BookingSerializer(serializers.ModelSerializer):
    customer = serializers.PrimaryKeyRelatedField(queryset=User.objects.all(), required=False, allow_null=True)
    service = serializers.PrimaryKeyRelatedField(queryset=Service.objects.all(), required=False, allow_null=True)
    vehicle_type = serializers.PrimaryKeyRelatedField(queryset=VehicleType.objects.all(), required=False, allow_null=True)

    pickup_latitude = serializers.DecimalField(max_digits=12, decimal_places=7, required=False, allow_null=True)
    pickup_longitude = serializers.DecimalField(max_digits=12, decimal_places=7, required=False, allow_null=True)
    dropoff_latitude = serializers.DecimalField(max_digits=12, decimal_places=7, required=False, allow_null=True)
    dropoff_longitude = serializers.DecimalField(max_digits=12, decimal_places=7, required=False, allow_null=True)
    distance_km = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    base_fare = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)
    total_fare = serializers.DecimalField(max_digits=10, decimal_places=2, required=False, allow_null=True)

    ride_detail = RideDetailSerializer(read_only=True)
    parcel_detail = ParcelDetailSerializer(read_only=True)
    moving_detail = MovingDetailSerializer(read_only=True)
    tracking_history = BookingTrackingSerializer(many=True, read_only=True)
    driver_details = serializers.SerializerMethodField()
    customer_details = serializers.SerializerMethodField()
    vehicle_type_name = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ('booking_number', 'created_at', 'updated_at')

    def get_vehicle_type_name(self, obj):
        if obj.vehicle_type:
            return obj.vehicle_type.name
        return "City Ride"

    def get_customer_details(self, obj):
        if not obj.customer:
            return None
        return {
            'name': f"{obj.customer.first_name or ''} {obj.customer.last_name or ''}".strip() or obj.customer.username or 'Customer',
            'phone': obj.customer.phone_number or '',
            'email': obj.customer.email or ''
        }

    def get_driver_details(self, obj):
        if not obj.driver:
            return None
        driver_user = obj.driver.user
        vehicle = obj.driver.vehicles.first() if hasattr(obj.driver, 'vehicles') and obj.driver.vehicles.exists() else None
        
        return {
            'captain_name': f"{driver_user.first_name or ''} {driver_user.last_name or ''}".strip() or driver_user.username or 'Captain Partner',
            'captain_phone': driver_user.phone_number or '+91 98765 43210',
            'rating': str(obj.driver.rating) if hasattr(obj.driver, 'rating') else '4.95',
            'vehicle_name': f"{vehicle.make} {vehicle.model}" if vehicle else 'Maruti Swift Dzire',
            'vehicle_number': vehicle.registration_number if vehicle else 'DL 01 AB 1234',
            'vehicle_type': vehicle.vehicle_type.name if (vehicle and vehicle.vehicle_type) else 'Sedan',
            'latitude': str(obj.driver.current_latitude) if getattr(obj.driver, 'current_latitude', None) else '28.4415',
            'longitude': str(obj.driver.current_longitude) if getattr(obj.driver, 'current_longitude', None) else '77.0395'
        }

