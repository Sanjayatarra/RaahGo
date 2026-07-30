from django.contrib import admin
from .models import Rating


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    list_display = ('booking', 'reviewer', 'reviewee_driver', 'rating', 'created_at')
    search_fields = ('booking__booking_number', 'reviewer__username', 'reviewee_driver__user__username')
    list_filter = ('rating',)
