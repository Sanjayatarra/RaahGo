from django.contrib import admin
from .models import Coupon


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display = ('code', 'discount_type', 'discount_value', 'min_booking_amount', 'valid_from', 'valid_until', 'usage_limit', 'times_used', 'is_active')
    search_fields = ('code',)
    list_filter = ('discount_type', 'is_active')
