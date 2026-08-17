from django.urls import path
from users.driver_auth_views import (
    DriverSendOTPView,
    DriverVerifyOTPView,
    DriverResendOTPView,
    DriverSignupView,
    DriverVerifySignupOTPView,
    DriverCompleteProfileView,
    DriverGoogleAuthView,
)
from users.token_refresh_views import SingleDeviceTokenRefreshView
from .driver_api_views import (
    DriverRegisterView,
    DriverProfileView,
    DriverOnboardingStatusView,
    DriverDocumentsView,
    DriverDocumentDetailView,
    DriverVehicleView,
    DriverStatusOnlineView,
    DriverStatusOfflineView,
    DriverStatusView,
    DriverLocationView,
    DriverRideRequestsView,
    DriverRideAcceptView,
    DriverRideRejectView,
    DriverCurrentRideView,
    DriverRideArrivedView,
    DriverRideStartView,
    DriverRideCompleteView,
    DriverRideCancelView,
    DriverRideHistoryView,
    DriverEarningsView,
    DriverWalletView,
    DriverWalletTransactionsView,
    DriverWalletAddMoneyView,
    DriverWalletWithdrawView,
    DriverRatingsView,
    DriverRatingSummaryView,
    DriverNotificationsView,
    DriverNotificationActionView,
    DriverSosView,
    DriverEmergencyContactsView,
    DriverSettingsView,
    DriverSupportTicketsView,
)

urlpatterns = [
    # Auth & Token
    path('auth/send-otp/', DriverSendOTPView.as_view(), name='driver-auth-send-otp'),
    path('auth/verify-otp/', DriverVerifyOTPView.as_view(), name='driver-auth-verify-otp'),
    path('auth/resend-otp/', DriverResendOTPView.as_view(), name='driver-auth-resend-otp'),
    path('auth/signup/', DriverSignupView.as_view(), name='driver-auth-signup'),
    path('auth/verify-signup-otp/', DriverVerifySignupOTPView.as_view(), name='driver-auth-verify-signup-otp'),
    path('auth/complete-profile/', DriverCompleteProfileView.as_view(), name='driver-auth-complete-profile'),
    path('auth/token/refresh/', SingleDeviceTokenRefreshView.as_view(), name='driver-auth-token-refresh'),
    path('token/refresh/', SingleDeviceTokenRefreshView.as_view(), name='driver-token-refresh'),

    # Registration & Profile
    path('register/', DriverRegisterView.as_view(), name='driver-register'),
    path('profile/', DriverProfileView.as_view(), name='driver-profile'),
    path('onboarding/status/', DriverOnboardingStatusView.as_view(), name='driver-onboarding-status'),

    # Documents
    path('documents/', DriverDocumentsView.as_view(), name='driver-documents'),
    path('documents/<uuid:document_id>/', DriverDocumentDetailView.as_view(), name='driver-document-detail'),

    # Vehicle
    path('vehicle/', DriverVehicleView.as_view(), name='driver-vehicle'),
    path('vehicle/<uuid:vehicle_id>/', DriverVehicleView.as_view(), name='driver-vehicle-detail'),

    # Online / Offline Status
    path('status/online/', DriverStatusOnlineView.as_view(), name='driver-status-online'),
    path('status/offline/', DriverStatusOfflineView.as_view(), name='driver-status-offline'),
    path('status/', DriverStatusView.as_view(), name='driver-status-current'),

    # Location Tracking
    path('location/', DriverLocationView.as_view(), name='driver-location'),

    # Ride Requests & Current Lifecycle
    path('rides/requests/', DriverRideRequestsView.as_view(), name='driver-ride-requests'),
    path('rides/requests/<uuid:request_id>/', DriverRideRequestsView.as_view(), name='driver-ride-request-detail'),
    path('rides/current/', DriverCurrentRideView.as_view(), name='driver-ride-current'),
    path('rides/<uuid:ride_id>/accept/', DriverRideAcceptView.as_view(), name='driver-ride-accept'),
    path('rides/<uuid:ride_id>/reject/', DriverRideRejectView.as_view(), name='driver-ride-reject'),
    path('rides/<uuid:ride_id>/arrived/', DriverRideArrivedView.as_view(), name='driver-ride-arrived'),
    path('rides/<uuid:ride_id>/start/', DriverRideStartView.as_view(), name='driver-ride-start'),
    path('rides/<uuid:ride_id>/complete/', DriverRideCompleteView.as_view(), name='driver-ride-complete'),
    path('rides/<uuid:ride_id>/cancel/', DriverRideCancelView.as_view(), name='driver-ride-cancel'),
    path('rides/', DriverRideHistoryView.as_view(), name='driver-ride-history'),
    path('rides/<uuid:ride_id>/', DriverRideHistoryView.as_view(), name='driver-ride-detail'),

    # Earnings
    path('earnings/', DriverEarningsView.as_view(), name='driver-earnings'),
    path('earnings/today/', DriverEarningsView.as_view(), {'period': 'today'}, name='driver-earnings-today'),
    path('earnings/week/', DriverEarningsView.as_view(), {'period': 'week'}, name='driver-earnings-week'),
    path('earnings/month/', DriverEarningsView.as_view(), {'period': 'month'}, name='driver-earnings-month'),
    path('earnings/transactions/', DriverEarningsView.as_view(), name='driver-earnings-transactions'),
    path('earnings/<uuid:ride_id>/', DriverEarningsView.as_view(), name='driver-earnings-ride'),

    # Wallet & Payments
    path('wallet/', DriverWalletView.as_view(), name='driver-wallet'),
    path('wallet/transactions/', DriverWalletTransactionsView.as_view(), name='driver-wallet-transactions'),
    path('wallet/add-money/', DriverWalletAddMoneyView.as_view(), name='driver-wallet-add-money'),
    path('wallet/withdraw/', DriverWalletWithdrawView.as_view(), name='driver-wallet-withdraw'),
    path('wallet/withdrawals/', DriverWalletTransactionsView.as_view(), name='driver-wallet-withdrawals'),
    path('rides/<uuid:ride_id>/cash-collected/', DriverRideCompleteView.as_view(), name='driver-ride-cash-collected'),

    # Ratings & Reviews
    path('ratings/', DriverRatingsView.as_view(), name='driver-ratings'),
    path('reviews/', DriverRatingsView.as_view(), name='driver-reviews'),
    path('rating-summary/', DriverRatingSummaryView.as_view(), name='driver-rating-summary'),

    # Notifications
    path('notifications/', DriverNotificationsView.as_view(), name='driver-notifications'),
    path('notifications/read-all/', DriverNotificationActionView.as_view(), {'notif_id': 'read-all'}, name='driver-notif-read-all'),
    path('notifications/<str:notif_id>/read/', DriverNotificationActionView.as_view(), name='driver-notif-read'),
    path('notifications/<str:notif_id>/', DriverNotificationActionView.as_view(), name='driver-notif-delete'),

    # Emergency / SOS
    path('rides/<uuid:ride_id>/sos/', DriverSosView.as_view(), name='driver-ride-sos'),
    path('emergency-contacts/', DriverEmergencyContactsView.as_view(), name='driver-emergency-contacts'),
    path('emergency-contacts/<uuid:id>/', DriverEmergencyContactsView.as_view(), name='driver-emergency-contact-detail'),

    # Settings & Support
    path('settings/', DriverSettingsView.as_view(), name='driver-settings'),
    path('support/tickets/', DriverSupportTicketsView.as_view(), name='driver-support-tickets'),
    path('support/tickets/<str:ticket_id>/', DriverSupportTicketsView.as_view(), name='driver-support-ticket-detail'),
    path('support/tickets/<str:ticket_id>/messages/', DriverSupportTicketsView.as_view(), name='driver-support-ticket-messages'),
]
