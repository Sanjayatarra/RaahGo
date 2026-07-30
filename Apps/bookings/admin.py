from django.contrib import admin
from .models import Booking, RideDetail, ParcelDetail, MovingDetail, BookingTracking


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('booking_number', 'customer', 'driver', 'service', 'vehicle_type', 'status', 'total_fare', 'payment_status', 'created_at')
    search_fields = ('booking_number', 'customer__username', 'driver__user__username')
    list_filter = ('status', 'payment_status', 'service', 'vehicle_type')


@admin.register(RideDetail)
class RideDetailAdmin(admin.ModelAdmin):
    list_display = ('booking', 'passenger_count')
    search_fields = ('booking__booking_number',)


@admin.register(ParcelDetail)
class ParcelDetailAdmin(admin.ModelAdmin):
    list_display = ('booking', 'receiver_name', 'receiver_phone', 'weight_kg', 'parcel_type')
    search_fields = ('booking__booking_number', 'receiver_name', 'receiver_phone')


@admin.register(MovingDetail)
class MovingDetailAdmin(admin.ModelAdmin):
    list_display = ('booking', 'helpers_count', 'pickup_floor', 'dropoff_floor')
    search_fields = ('booking__booking_number',)


@admin.register(BookingTracking)
class BookingTrackingAdmin(admin.ModelAdmin):
    list_display = ('booking', 'status', 'created_at')
    search_fields = ('booking__booking_number', 'status')
    list_filter = ('status',)
