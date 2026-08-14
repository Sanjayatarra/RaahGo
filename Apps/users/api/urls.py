from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from users.views import (
    UserViewSet,
    UserAddressViewSet,
    OTPVerificationViewSet,
    UserDeviceViewSet
)
from . import authentication, profile, password, admin

urlpatterns = [
    # Authentication
    path('authentication/register/', UserViewSet.as_view({'post': 'signup'}), name='api-auth-register'),
    path('authentication/google-auth/', UserViewSet.as_view({'post': 'google_auth'}), name='api-auth-google'),
    path('authentication/login/', authentication.LoginView.as_view(), name='api-auth-login'),
    path('authentication/logout/', authentication.LogoutView.as_view(), name='api-auth-logout'),
    path('authentication/refresh/', TokenRefreshView.as_view(), name='api-auth-refresh'),
    path('authentication/me/', authentication.MeView.as_view(), name='api-auth-me'),

    # Profile
    path('profile/get/', profile.ProfileGetView.as_view(), name='api-profile-get'),
    path('profile/update/', profile.ProfileUpdateView.as_view(), name='api-profile-update'),
    path('profile/avatar/', profile.ProfileAvatarView.as_view(), name='api-profile-avatar'),

    # Password
    path('password/change/', password.PasswordChangeView.as_view(), name='api-password-change'),
    path('password/forgot/', password.PasswordForgotView.as_view(), name='api-password-forgot'),
    path('password/reset/', password.PasswordResetView.as_view(), name='api-password-reset'),

    # OTP
    path('otp/send/', OTPVerificationViewSet.as_view({'post': 'send_otp'}), name='api-otp-send'),
    path('otp/verify/', OTPVerificationViewSet.as_view({'post': 'verify_otp'}), name='api-otp-verify'),
    path('otp/resend/', OTPVerificationViewSet.as_view({'post': 'send_otp'}), name='api-otp-resend'),

    # Addresses
    path('addresses/list/', UserAddressViewSet.as_view({'get': 'list'}), name='api-addresses-list'),
    path('addresses/create/', UserAddressViewSet.as_view({'post': 'create'}), name='api-addresses-create'),
    path('addresses/update/<int:pk>/', UserAddressViewSet.as_view({'put': 'update', 'patch': 'partial_update'}), name='api-addresses-update'),
    path('addresses/delete/<int:pk>/', UserAddressViewSet.as_view({'delete': 'destroy'}), name='api-addresses-delete'),

    # Devices
    path('devices/register/', UserDeviceViewSet.as_view({'post': 'create'}), name='api-devices-register'),
    path('devices/remove/<int:pk>/', UserDeviceViewSet.as_view({'delete': 'destroy'}), name='api-devices-remove'),

    # Admin
    path('admin/users/', admin.AdminUsersView.as_view(), name='api-admin-users'),
    path('admin/roles/', admin.AdminRolesView.as_view(), name='api-admin-roles'),
    path('admin/permissions/', admin.AdminPermissionsView.as_view(), name='api-admin-permissions'),
    path('admin/activate/<int:pk>/', admin.AdminActivateView.as_view(), name='api-admin-activate'),
    path('admin/deactivate/<int:pk>/', admin.AdminDeactivateView.as_view(), name='api-admin-deactivate'),
    path('admin/delete/<int:pk>/', admin.AdminDeleteView.as_view(), name='api-admin-delete'),
]
