from django.contrib import admin
from .models import User, UserAddress, OTPVerification, UserDevice


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'email', 'phone_number', 'role', 'is_active', 'created_at')
    search_fields = ('username', 'email', 'phone_number')
    list_filter = ('role', 'is_active', 'is_verified')


@admin.register(UserAddress)
class UserAddressAdmin(admin.ModelAdmin):
    list_display = ('user', 'title', 'city', 'state', 'is_default')
    search_fields = ('user__username', 'city', 'postal_code')
    list_filter = ('title', 'is_default')


@admin.register(OTPVerification)
class OTPVerificationAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'email', 'purpose', 'is_verified', 'expires_at', 'created_at')
    search_fields = ('phone_number', 'email', 'otp')
    list_filter = ('purpose', 'is_verified')


@admin.register(UserDevice)
class UserDeviceAdmin(admin.ModelAdmin):
    list_display = ('user', 'device_type', 'device_name', 'app_version', 'is_active', 'last_active')
    search_fields = ('user__username', 'device_name')
    list_filter = ('device_type', 'is_active')
