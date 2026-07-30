from django.contrib import admin
from .models import Driver, DriverDocument, DriverBankAccount, DriverEmergencyContact


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
    list_display = ('user', 'license_number', 'approval_status', 'availability_status', 'rating', 'total_trips')
    search_fields = ('user__username', 'user__phone_number', 'license_number')
    list_filter = ('approval_status', 'availability_status')


@admin.register(DriverDocument)
class DriverDocumentAdmin(admin.ModelAdmin):
    list_display = ('driver', 'document_type', 'document_number', 'verification_status', 'expiry_date')
    search_fields = ('driver__user__username', 'document_number')
    list_filter = ('document_type', 'verification_status')


@admin.register(DriverBankAccount)
class DriverBankAccountAdmin(admin.ModelAdmin):
    list_display = ('driver', 'bank_name', 'account_number', 'ifsc_code', 'is_verified', 'is_primary')
    search_fields = ('driver__user__username', 'bank_name', 'account_number')
    list_filter = ('is_verified', 'is_primary')


@admin.register(DriverEmergencyContact)
class DriverEmergencyContactAdmin(admin.ModelAdmin):
    list_display = ('driver', 'name', 'relationship', 'phone_number')
    search_fields = ('driver__user__username', 'name', 'phone_number')
