from django.contrib import admin
from .models import Payment, Refund


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'booking', 'user', 'amount', 'payment_method', 'status', 'paid_at')
    search_fields = ('transaction_id', 'booking__booking_number', 'user__username')
    list_filter = ('payment_method', 'status')


@admin.register(Refund)
class RefundAdmin(admin.ModelAdmin):
    list_display = ('id', 'payment', 'amount', 'status', 'processed_at')
    search_fields = ('payment__transaction_id', 'payment__booking__booking_number')
    list_filter = ('status',)
