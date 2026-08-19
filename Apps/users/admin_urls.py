from django.urls import path
from . import admin_api_views

urlpatterns = [
    # ── 1. Auth ───────────────────────────────────────────────
    path('auth/login/', admin_api_views.AdminLoginView.as_view(), name='admin-api-login'),
    path('auth/logout/', admin_api_views.AdminLogoutView.as_view(), name='admin-api-logout'),
    path('auth/me/', admin_api_views.AdminMeView.as_view(), name='admin-api-me'),

    # ── 2. Dashboard ──────────────────────────────────────────
    path('dashboard/stats/', admin_api_views.AdminDashboardStatsView.as_view(), name='admin-dashboard-stats'),
    path('dashboard/revenue/', admin_api_views.AdminDashboardRevenueView.as_view(), name='admin-dashboard-revenue'),
    path('dashboard/rides/', admin_api_views.AdminDashboardRidesView.as_view(), name='admin-dashboard-rides'),
    path('dashboard/alerts/', admin_api_views.AdminDashboardAlertsView.as_view(), name='admin-dashboard-alerts'),

    # ── 3. Live Operations ────────────────────────────────────
    path('live/drivers/', admin_api_views.AdminLiveDriversView.as_view(), name='admin-live-drivers'),
    path('live/rides/', admin_api_views.AdminLiveRidesView.as_view(), name='admin-live-rides'),

    # ── 4. Customers ──────────────────────────────────────────
    path('customers/', admin_api_views.AdminCustomersListView.as_view(), name='admin-customers-list'),
    path('customers/<uuid:pk>/', admin_api_views.AdminCustomerDetailView.as_view(), name='admin-customer-detail'),
    path('customers/<uuid:pk>/block/', admin_api_views.AdminCustomerBlockView.as_view(), name='admin-customer-block'),
    path('customers/<uuid:pk>/unblock/', admin_api_views.AdminCustomerUnblockView.as_view(), name='admin-customer-unblock'),
    path('customers/<uuid:pk>/wallet/adjust/', admin_api_views.AdminCustomerWalletAdjustView.as_view(), name='admin-customer-wallet-adjust'),
    path('customers/<uuid:pk>/notifications/send/', admin_api_views.AdminCustomerNotificationView.as_view(), name='admin-customer-notification-send'),
    path('customers/<uuid:pk>/devices/<str:device_id>/logout/', admin_api_views.AdminCustomerDeviceLogoutView.as_view(), name='admin-customer-device-logout'),

    # ── 5. Drivers ────────────────────────────────────────────
    path('drivers/', admin_api_views.AdminDriversListView.as_view(), name='admin-drivers-list'),
    path('drivers/<uuid:pk>/', admin_api_views.AdminDriverDetailView.as_view(), name='admin-driver-detail'),
    path('drivers/<uuid:pk>/approve/', admin_api_views.AdminDriverApproveView.as_view(), name='admin-driver-approve'),
    path('drivers/<uuid:pk>/reject/', admin_api_views.AdminDriverRejectView.as_view(), name='admin-driver-reject'),
    path('drivers/<uuid:pk>/block/', admin_api_views.AdminDriverBlockView.as_view(), name='admin-driver-block'),
    path('drivers/<uuid:pk>/unblock/', admin_api_views.AdminDriverUnblockView.as_view(), name='admin-driver-unblock'),
    path('drivers/<uuid:pk>/suspend/', admin_api_views.AdminDriverBlockView.as_view(), name='admin-driver-suspend'),
    path('drivers/<uuid:pk>/unsuspend/', admin_api_views.AdminDriverUnblockView.as_view(), name='admin-driver-unsuspend'),
    path('drivers/<uuid:pk>/force-logout/', admin_api_views.AdminDriverForceLogoutView.as_view(), name='admin-driver-force-logout'),
    path('drivers/<uuid:pk>/wallet/adjust/', admin_api_views.AdminDriverWalletAdjustView.as_view(), name='admin-driver-wallet-adjust'),
    path('drivers/<uuid:pk>/notifications/send/', admin_api_views.AdminDriverNotificationView.as_view(), name='admin-driver-notification-send'),
    path('drivers/<uuid:pk>/devices/<str:device_id>/logout/', admin_api_views.AdminDriverDeviceLogoutView.as_view(), name='admin-driver-device-logout'),
    path('drivers/<uuid:driver_pk>/documents/<uuid:doc_pk>/approve/', admin_api_views.AdminDriverDocApproveView.as_view(), name='admin-driver-doc-approve'),
    path('drivers/<uuid:driver_pk>/documents/<uuid:doc_pk>/reject/', admin_api_views.AdminDriverDocRejectView.as_view(), name='admin-driver-doc-reject'),
    path('drivers/<uuid:driver_pk>/vehicles/<uuid:vehicle_pk>/approve/', admin_api_views.AdminDriverVehicleApproveView.as_view(), name='admin-driver-vehicle-approve'),
    path('drivers/<uuid:driver_pk>/vehicles/<uuid:vehicle_pk>/reject/', admin_api_views.AdminDriverVehicleRejectView.as_view(), name='admin-driver-vehicle-reject'),
    path('drivers/<uuid:driver_pk>/vehicles/<uuid:vehicle_pk>/deactivate/', admin_api_views.AdminDriverVehicleDeactivateView.as_view(), name='admin-driver-vehicle-deactivate'),

    # ── 6. Vehicles ───────────────────────────────────────────
    path('vehicles/', admin_api_views.AdminVehiclesListView.as_view(), name='admin-vehicles-list'),
    path('vehicle-types/', admin_api_views.AdminVehicleTypesView.as_view(), name='admin-vehicle-types'),

    # ── 7. Rides ──────────────────────────────────────────────
    path('rides/', admin_api_views.AdminRidesListView.as_view(), name='admin-rides-list'),
    path('rides/live/', admin_api_views.AdminLiveRidesView.as_view(), name='admin-rides-live'),
    path('rides/scheduled/', admin_api_views.AdminScheduledRidesView.as_view(), name='admin-rides-scheduled'),
    path('rides/completed/', admin_api_views.AdminCompletedRidesView.as_view(), name='admin-rides-completed'),
    path('rides/cancelled/', admin_api_views.AdminCancelledRidesView.as_view(), name='admin-rides-cancelled'),

    # ── 8. Pricing & Surge ────────────────────────────────────
    path('pricing/', admin_api_views.AdminPricingListView.as_view(), name='admin-pricing-list'),
    path('pricing/<uuid:pk>/', admin_api_views.AdminPricingDetailView.as_view(), name='admin-pricing-detail'),
    path('surge/', admin_api_views.AdminSurgeListView.as_view(), name='admin-surge-list'),

    # ── 9. Payments, Payouts, Earnings & Wallets ──────────────
    path('payments/', admin_api_views.AdminPaymentsListView.as_view(), name='admin-payments-list'),
    path('payments/refunds/', admin_api_views.AdminRefundsListView.as_view(), name='admin-refunds-list'),
    path('payouts/', admin_api_views.AdminPayoutsListView.as_view(), name='admin-payouts-list'),
    path('earnings/', admin_api_views.AdminEarningsListView.as_view(), name='admin-earnings-list'),
    path('commission/', admin_api_views.AdminCommissionListView.as_view(), name='admin-commission-list'),
    path('wallets/', admin_api_views.AdminWalletsListView.as_view(), name='admin-wallets-list'),

    # ── 10. Support, Complaints & Emergencies ─────────────────
    path('support/tickets/', admin_api_views.AdminSupportTicketsView.as_view(), name='admin-support-tickets'),
    path('complaints/', admin_api_views.AdminComplaintsView.as_view(), name='admin-complaints'),
    path('emergencies/', admin_api_views.AdminEmergenciesView.as_view(), name='admin-emergencies'),

    # ── 11. Ratings, Coupons, Locations & Services ────────────
    path('ratings/', admin_api_views.AdminRatingsListView.as_view(), name='admin-ratings-list'),
    path('coupons/', admin_api_views.AdminCouponsListView.as_view(), name='admin-coupons-list'),
    path('referrals/', admin_api_views.AdminReferralsListView.as_view(), name='admin-referrals-list'),
    path('parcels/', admin_api_views.AdminParcelsListView.as_view(), name='admin-parcels-list'),
    path('movers/', admin_api_views.AdminMoversListView.as_view(), name='admin-movers-list'),
    path('moving-orders/', admin_api_views.AdminMoversListView.as_view(), name='admin-moving-orders-list'),
    path('audit-logs/', admin_api_views.AdminAuditLogsView.as_view(), name='admin-audit-logs-list'),
    path('cities/', admin_api_views.AdminCitiesView.as_view(), name='admin-cities-list'),
    path('zones/', admin_api_views.AdminZonesView.as_view(), name='admin-zones-list'),
    path('services/', admin_api_views.AdminServicesView.as_view(), name='admin-services-list'),
    path('admin-users/', admin_api_views.AdminAdminUsersListView.as_view(), name='admin-admin-users-list'),
    path('admin-users/<uuid:pk>/', admin_api_views.AdminAdminUsersListView.as_view(), name='admin-admin-users-detail'),
    path('roles/', admin_api_views.AdminRolesListView.as_view(), name='admin-roles-list'),
    path('notifications/', admin_api_views.AdminNotificationsListView.as_view(), name='admin-notifications-list'),
    path('notification-templates/', admin_api_views.AdminNotificationTemplatesView.as_view(), name='admin-notification-templates'),
    path('notifications/send/', admin_api_views.AdminNotificationsSendView.as_view(), name='admin-notifications-send'),
    path('reports/revenue/', admin_api_views.AdminReportsRevenueView.as_view(), name='admin-reports-revenue'),
    path('reports/rides/', admin_api_views.AdminReportsRevenueView.as_view(), name='admin-reports-rides'),
    path('reports/cities/', admin_api_views.AdminReportsCitiesView.as_view(), name='admin-reports-cities'),
    path('reports/cancellations/', admin_api_views.AdminReportsCancellationsView.as_view(), name='admin-reports-cancellations'),
    path('settings/', admin_api_views.AdminSettingsView.as_view(), name='admin-settings'),
    path('settings/<str:key>/', admin_api_views.AdminSettingsView.as_view(), name='admin-settings-key'),
]
