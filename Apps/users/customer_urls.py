from django.urls import path
from .token_refresh_views import SingleDeviceTokenRefreshView
from .customer_views import (
    CustomerSendOTPView,
    CustomerVerifyOTPView,
    CustomerSignupView,
    CustomerVerifySignupOTPView,
    CustomerCompleteProfileView,
    CustomerGoogleAuthView,
)

from .customer_api_views import (
    # Profile & Image
    CustomerProfileView,
    CustomerProfileImageView,

    # Addresses
    CustomerAddressesView,
    CustomerAddressDetailView,
    CustomerAddressSetDefaultView,

    # Location
    CustomerLocationReverseGeocodeView,
    CustomerLocationSearchView,
    CustomerLocationSuggestionsView,

    # Rides & Vehicle Types
    CustomerRideFareEstimateView,
    CustomerVehicleTypesView,
    CustomerRidesView,
    CustomerActiveRideView,
    CustomerRideDetailView,
    CustomerRideDriverView,
    CustomerRideLocationView,
    CustomerRideStatusView,
    CustomerRideCancelReasonsView,
    CustomerRideCancelView,
    CustomerRideInvoiceView,
    CustomerRideRatingView,

    # Payments & Wallet
    CustomerPaymentMethodsView,
    CustomerPaymentCreateOrderView,
    CustomerPaymentVerifyView,
    CustomerWalletView,
    CustomerWalletTransactionsView,
    CustomerWalletAddMoneyView,

    # Coins
    CustomerCoinsView,
    CustomerCoinsBalanceView,
    CustomerCoinsTransactionsView,
    CustomerCoinsRewardsView,
    CustomerCoinsOffersView,
    CustomerCoinsRedeemView,

    # Coupons
    CustomerCouponsView,
    CustomerCouponApplyView,
    CustomerCouponRemoveView,

    # Notifications
    CustomerNotificationsView,
    CustomerNotificationReadView,

    # Claims, Safety & SOS
    CustomerClaimsView,
    CustomerEmergencyContactsView,
    CustomerSafetySosView,

    # Settings & Support
    CustomerSettingsView,
    CustomerSupportTicketsView,
)

urlpatterns = [
    # ── 1. Authentication & Tokens ──────────────────────────────────────────
    path('auth/send-otp/', CustomerSendOTPView.as_view(), name='customer-auth-send-otp'),
    path('auth/verify-otp/', CustomerVerifyOTPView.as_view(), name='customer-auth-verify-otp'),
    path('auth/signup/', CustomerSignupView.as_view(), name='customer-auth-signup'),
    path('auth/verify-signup-otp/', CustomerVerifySignupOTPView.as_view(), name='customer-auth-verify-signup-otp'),
    path('auth/complete-profile/', CustomerCompleteProfileView.as_view(), name='customer-auth-complete-profile'),
    path('auth/google-auth/', CustomerGoogleAuthView.as_view(), name='customer-auth-google-auth'),
    path('auth/token/refresh/', SingleDeviceTokenRefreshView.as_view(), name='customer-auth-token-refresh'),

    # Backward compatible un-prefixed auth aliases
    path('send-otp/', CustomerSendOTPView.as_view(), name='customer-send-otp-alias'),
    path('verify-otp/', CustomerVerifyOTPView.as_view(), name='customer-verify-otp-alias'),
    path('signup/', CustomerSignupView.as_view(), name='customer-signup-alias'),
    path('verify-signup-otp/', CustomerVerifySignupOTPView.as_view(), name='customer-verify-signup-otp-alias'),
    path('complete-profile/', CustomerCompleteProfileView.as_view(), name='customer-complete-profile-alias'),
    path('google-auth/', CustomerGoogleAuthView.as_view(), name='customer-google-auth-alias'),
    path('token/refresh/', SingleDeviceTokenRefreshView.as_view(), name='customer-token-refresh-alias'),

    # ── 2. Profile & Image ──────────────────────────────────────────────────
    path('profile/', CustomerProfileView.as_view(), name='customer-profile'),
    path('profile/image/', CustomerProfileImageView.as_view(), name='customer-profile-image'),

    # ── 3. Address Management ──────────────────────────────────────────────
    path('addresses/', CustomerAddressesView.as_view(), name='customer-addresses'),
    path('addresses/<str:address_id>/', CustomerAddressDetailView.as_view(), name='customer-address-detail'),
    path('addresses/<str:address_id>/set-default/', CustomerAddressSetDefaultView.as_view(), name='customer-address-set-default'),

    # ── 4. Location Services ────────────────────────────────────────────────
    path('location/reverse-geocode/', CustomerLocationReverseGeocodeView.as_view(), name='customer-location-reverse-geocode'),
    path('location/search/', CustomerLocationSearchView.as_view(), name='customer-location-search'),
    path('location/suggestions/', CustomerLocationSuggestionsView.as_view(), name='customer-location-suggestions'),

    # ── 5. Ride Journey & Fare Estimation ───────────────────────────────────
    path('rides/fare-estimate/', CustomerRideFareEstimateView.as_view(), name='customer-ride-fare-estimate'),
    path('rides/vehicle-types/', CustomerVehicleTypesView.as_view(), name='customer-ride-vehicle-types'),
    path('rides/', CustomerRidesView.as_view(), name='customer-rides'),
    path('rides/current/', CustomerActiveRideView.as_view(), name='customer-ride-current'),
    path('rides/<str:ride_id>/', CustomerRideDetailView.as_view(), name='customer-ride-detail'),
    path('rides/<str:ride_id>/driver/', CustomerRideDriverView.as_view(), name='customer-ride-driver'),
    path('rides/<str:ride_id>/location/', CustomerRideLocationView.as_view(), name='customer-ride-location'),
    path('rides/<str:ride_id>/status/', CustomerRideStatusView.as_view(), name='customer-ride-status'),
    path('rides/<str:ride_id>/cancel-reasons/', CustomerRideCancelReasonsView.as_view(), name='customer-ride-cancel-reasons'),
    path('rides/<str:ride_id>/cancel/', CustomerRideCancelView.as_view(), name='customer-ride-cancel'),
    path('rides/<str:ride_id>/invoice/', CustomerRideInvoiceView.as_view(), name='customer-ride-invoice'),
    path('rides/<str:ride_id>/rating/', CustomerRideRatingView.as_view(), name='customer-ride-rating'),

    # ── 6. Payments & Wallet ────────────────────────────────────────────────
    path('payment/methods/', CustomerPaymentMethodsView.as_view(), name='customer-payment-methods'),
    path('payment/create-order/', CustomerPaymentCreateOrderView.as_view(), name='customer-payment-create-order'),
    path('payment/verify/', CustomerPaymentVerifyView.as_view(), name='customer-payment-verify'),
    path('wallet/', CustomerWalletView.as_view(), name='customer-wallet'),
    path('wallet/transactions/', CustomerWalletTransactionsView.as_view(), name='customer-wallet-transactions'),
    path('wallet/add-money/', CustomerWalletAddMoneyView.as_view(), name='customer-wallet-add-money'),

    # ── 7. RaahGo Coins ─────────────────────────────────────────────────────
    path('coins/', CustomerCoinsView.as_view(), name='customer-coins'),
    path('coins/balance/', CustomerCoinsBalanceView.as_view(), name='customer-coins-balance'),
    path('coins/transactions/', CustomerCoinsTransactionsView.as_view(), name='customer-coins-transactions'),
    path('coins/rewards/', CustomerCoinsRewardsView.as_view(), name='customer-coins-rewards'),
    path('coins/offers/', CustomerCoinsOffersView.as_view(), name='customer-coins-offers'),
    path('coins/redeem/', CustomerCoinsRedeemView.as_view(), name='customer-coins-redeem'),

    # ── 8. Coupons ──────────────────────────────────────────────────────────
    path('coupons/', CustomerCouponsView.as_view(), name='customer-coupons'),
    path('coupons/apply/', CustomerCouponApplyView.as_view(), name='customer-coupon-apply'),
    path('coupons/remove/', CustomerCouponRemoveView.as_view(), name='customer-coupon-remove'),

    # ── 9. Notifications ────────────────────────────────────────────────────
    path('notifications/', CustomerNotificationsView.as_view(), name='customer-notifications'),
    path('notifications/<str:notif_id>/read/', CustomerNotificationReadView.as_view(), name='customer-notification-read'),

    # ── 10. Claims, Safety & SOS ────────────────────────────────────────────
    path('claims/', CustomerClaimsView.as_view(), name='customer-claims'),
    path('emergency-contacts/', CustomerEmergencyContactsView.as_view(), name='customer-emergency-contacts'),
    path('safety/sos/', CustomerSafetySosView.as_view(), name='customer-safety-sos'),

    # ── 11. Settings & Support ──────────────────────────────────────────────
    path('settings/', CustomerSettingsView.as_view(), name='customer-settings'),
    path('support/tickets/', CustomerSupportTicketsView.as_view(), name='customer-support-tickets'),
]
