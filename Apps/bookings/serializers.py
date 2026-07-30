from rest_framework import serializers
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
    ride_detail = RideDetailSerializer(read_only=True)
    parcel_detail = ParcelDetailSerializer(read_only=True)
    moving_detail = MovingDetailSerializer(read_only=True)
    tracking_history = BookingTrackingSerializer(many=True, read_only=True)

    class Meta:
        model = Booking
        fields = '__all__'
        read_only_fields = ('booking_number', 'status', 'created_at', 'updated_at')
