from django.contrib import admin
from .models import VehicleType, Vehicle


@admin.register(VehicleType)
class VehicleTypeAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity_passengers', 'capacity_weight_kg', 'base_fare', 'per_km_rate', 'is_active')
    search_fields = ('name',)
    list_filter = ('is_active',)


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ('registration_number', 'driver', 'vehicle_type', 'make', 'model', 'year', 'is_approved', 'is_active')
    search_fields = ('registration_number', 'driver__user__username', 'make', 'model')
    list_filter = ('vehicle_type', 'is_approved', 'is_active')
