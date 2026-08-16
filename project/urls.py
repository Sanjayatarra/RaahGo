from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/customer/', include('users.customer_urls')),
    path('api/v1/driver/', include('drivers.driver_api_urls')),
    path('api/v1/users/', include('users.urls')),
    path('api/v1/drivers/', include('drivers.urls')),
    path('api/v1/vehicles/', include('vehicles.urls')),
    path('api/v1/services/', include('services.urls')),
    path('api/v1/bookings/', include('bookings.urls')),
    path('api/v1/payments/', include('payments.urls')),
    path('api/v1/tracking/', include('tracking.urls')),
    path('api/v1/notifications/', include('notifications.urls')),
    path('api/v1/reviews/', include('reviews.urls')),
    path('api/v1/wallets/', include('wallets.urls')),
    path('api/v1/coupons/', include('coupons.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
