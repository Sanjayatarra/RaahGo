// Central API client for RaahGo Admin
// All endpoints are defined here. Swap BASE_URL to point to real backend.

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 → redirect to login (except when already on login request)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login/')) {
      localStorage.removeItem('admin_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── AUTH ──────────────────────────────────────────────────
export const authAPI = {
  login: (data) => api.post('/api/admin/auth/login/', data),
  logout: () => api.post('/api/admin/auth/logout/'),
  refresh: (data) => api.post('/api/admin/auth/refresh/', data),
  me: () => api.get('/api/admin/auth/me/'),
  forgotPassword: (data) => api.post('/api/admin/auth/forgot-password/', data),
  resetPassword: (data) => api.post('/api/admin/auth/reset-password/', data),
  changePassword: (data) => api.post('/api/admin/auth/change-password/', data),
  verify2FA: (data) => api.post('/api/admin/auth/2fa/verify/', data),
};

// ── DASHBOARD ────────────────────────────────────────────
export const dashboardAPI = {
  get: () => api.get('/api/admin/dashboard/'),
  stats: () => api.get('/api/admin/dashboard/stats/'),
  revenue: () => api.get('/api/admin/dashboard/revenue/'),
  rides: () => api.get('/api/admin/dashboard/rides/'),
  users: () => api.get('/api/admin/dashboard/users/'),
  drivers: () => api.get('/api/admin/dashboard/drivers/'),
  alerts: () => api.get('/api/admin/dashboard/alerts/'),
};

// ── CUSTOMERS ────────────────────────────────────────────
export const customersAPI = {
  list: (params) => api.get('/api/admin/customers/', { params }),
  get: (id) => api.get(`/api/admin/customers/${id}/`),
  block: (id) => api.post(`/api/admin/customers/${id}/block/`),
  unblock: (id) => api.post(`/api/admin/customers/${id}/unblock/`),
  delete: (id) => api.delete(`/api/admin/customers/${id}/`),
  rides: (id) => api.get(`/api/admin/customers/${id}/rides/`),
  payments: (id) => api.get(`/api/admin/customers/${id}/payments/`),
  wallet: (id) => api.get(`/api/admin/customers/${id}/wallet/`),
  addresses: (id) => api.get(`/api/admin/customers/${id}/addresses/`),
  complaints: (id) => api.get(`/api/admin/customers/${id}/complaints/`),
  devices: (id) => api.get(`/api/admin/customers/${id}/devices/`),
};

// ── DRIVERS ──────────────────────────────────────────────
export const driversAPI = {
  list: (params) => api.get('/api/admin/drivers/', { params }),
  get: (id) => api.get(`/api/admin/drivers/${id}/`),
  approve: (id) => api.post(`/api/admin/drivers/${id}/approve/`),
  reject: (id, data) => api.post(`/api/admin/drivers/${id}/reject/`, data),
  suspend: (id, data) => api.post(`/api/admin/drivers/${id}/suspend/`, data),
  unsuspend: (id) => api.post(`/api/admin/drivers/${id}/unsuspend/`),
  documents: (id) => api.get(`/api/admin/drivers/${id}/documents/`),
  approveDoc: (id, docId) => api.post(`/api/admin/drivers/${id}/documents/${docId}/approve/`),
  rejectDoc: (id, docId, data) => api.post(`/api/admin/drivers/${id}/documents/${docId}/reject/`, data),
  vehicles: (id) => api.get(`/api/admin/drivers/${id}/vehicles/`),
  rides: (id) => api.get(`/api/admin/drivers/${id}/rides/`),
  earnings: (id) => api.get(`/api/admin/drivers/${id}/earnings/`),
  wallet: (id) => api.get(`/api/admin/drivers/${id}/wallet/`),
  ratings: (id) => api.get(`/api/admin/drivers/${id}/ratings/`),
  complaints: (id) => api.get(`/api/admin/drivers/${id}/complaints/`),
  location: (id) => api.get(`/api/admin/drivers/${id}/location/`),
};

// ── DRIVER VERIFICATION ──────────────────────────────────
export const verificationAPI = {
  list: () => api.get('/api/admin/driver-verification/'),
  get: (id) => api.get(`/api/admin/driver-verification/${id}/`),
  approve: (id) => api.post(`/api/admin/driver-verification/${id}/approve/`),
  reject: (id, data) => api.post(`/api/admin/driver-verification/${id}/reject/`, data),
};

// ── VEHICLES ─────────────────────────────────────────────
export const vehiclesAPI = {
  list: (params) => api.get('/api/admin/vehicles/', { params }),
  get: (id) => api.get(`/api/admin/vehicles/${id}/`),
  approve: (id) => api.post(`/api/admin/vehicles/${id}/approve/`),
  reject: (id, data) => api.post(`/api/admin/vehicles/${id}/reject/`, data),
  types: () => api.get('/api/admin/vehicle-types/'),
  createType: (data) => api.post('/api/admin/vehicle-types/', data),
  updateType: (id, data) => api.put(`/api/admin/vehicle-types/${id}/`, data),
  deleteType: (id) => api.delete(`/api/admin/vehicle-types/${id}/`),
};

// ── RIDES ────────────────────────────────────────────────
export const ridesAPI = {
  list: (params) => api.get('/api/admin/rides/', { params }),
  get: (id) => api.get(`/api/admin/rides/${id}/`),
  live: () => api.get('/api/admin/rides/live/'),
  completed: (params) => api.get('/api/admin/rides/completed/', { params }),
  cancelled: (params) => api.get('/api/admin/rides/cancelled/', { params }),
  scheduled: (params) => api.get('/api/admin/rides/scheduled/', { params }),
  tracking: (id) => api.get(`/api/admin/rides/${id}/tracking/`),
  timeline: (id) => api.get(`/api/admin/rides/${id}/timeline/`),
  cancel: (id, data) => api.post(`/api/admin/rides/${id}/cancel/`, data),
  assignDriver: (id, data) => api.post(`/api/admin/rides/${id}/assign-driver/`, data),
  reassignDriver: (id, data) => api.post(`/api/admin/rides/${id}/reassign-driver/`, data),
  complete: (id) => api.post(`/api/admin/rides/${id}/complete/`),
  refund: (id) => api.post(`/api/admin/rides/${id}/refund/`),
};

// ── LIVE OPERATIONS ──────────────────────────────────────
export const liveAPI = {
  drivers: () => api.get('/api/admin/live/drivers/'),
  rides: () => api.get('/api/admin/live/rides/'),
  driverLocation: (id) => api.get(`/api/admin/live/drivers/${id}/location/`),
  rideLocation: (id) => api.get(`/api/admin/live/rides/${id}/location/`),
};

// ── PRICING ──────────────────────────────────────────────
export const pricingAPI = {
  list: () => api.get('/api/admin/pricing/'),
  create: (data) => api.post('/api/admin/pricing/', data),
  get: (id) => api.get(`/api/admin/pricing/${id}/`),
  update: (id, data) => api.put(`/api/admin/pricing/${id}/`, data),
  delete: (id) => api.delete(`/api/admin/pricing/${id}/`),
};

// ── SURGE PRICING ────────────────────────────────────────
export const surgeAPI = {
  list: () => api.get('/api/admin/surge/'),
  create: (data) => api.post('/api/admin/surge/', data),
  update: (id, data) => api.put(`/api/admin/surge/${id}/`, data),
  delete: (id) => api.delete(`/api/admin/surge/${id}/`),
  activate: (id) => api.post(`/api/admin/surge/${id}/activate/`),
  deactivate: (id) => api.post(`/api/admin/surge/${id}/deactivate/`),
};

// ── PAYMENTS ─────────────────────────────────────────────
export const paymentsAPI = {
  list: (params) => api.get('/api/admin/payments/', { params }),
  get: (id) => api.get(`/api/admin/payments/${id}/`),
  failed: () => api.get('/api/admin/payments/failed/'),
  pending: () => api.get('/api/admin/payments/pending/'),
  refunds: () => api.get('/api/admin/payments/refunds/'),
  refund: (id) => api.post(`/api/admin/payments/${id}/refund/`),
  payouts: (params) => api.get('/api/admin/payouts/', { params }),
  payout: (id) => api.get(`/api/admin/payouts/${id}/`),
  processPayout: (id) => api.post(`/api/admin/payouts/${id}/process/`),
};

// ── EARNINGS & COMMISSION ────────────────────────────────
export const earningsAPI = {
  list: () => api.get('/api/admin/earnings/'),
  driver: (id) => api.get(`/api/admin/earnings/driver/${id}/`),
  commission: () => api.get('/api/admin/commission/'),
  updateCommission: (data) => api.put('/api/admin/commission/', data),
};

// ── WALLETS ──────────────────────────────────────────────
export const walletsAPI = {
  list: () => api.get('/api/admin/wallets/'),
  get: (id) => api.get(`/api/admin/wallets/${id}/`),
  transactions: (id) => api.get(`/api/admin/wallets/${id}/transactions/`),
  credit: (id, data) => api.post(`/api/admin/wallets/${id}/credit/`, data),
  debit: (id, data) => api.post(`/api/admin/wallets/${id}/debit/`, data),
};

// ── COUPONS ──────────────────────────────────────────────
export const couponsAPI = {
  list: () => api.get('/api/admin/coupons/'),
  create: (data) => api.post('/api/admin/coupons/', data),
  get: (id) => api.get(`/api/admin/coupons/${id}/`),
  update: (id, data) => api.put(`/api/admin/coupons/${id}/`, data),
  delete: (id) => api.delete(`/api/admin/coupons/${id}/`),
  activate: (id) => api.post(`/api/admin/coupons/${id}/activate/`),
  deactivate: (id) => api.post(`/api/admin/coupons/${id}/deactivate/`),
};

// ── SUPPORT & COMPLAINTS ─────────────────────────────────
export const supportAPI = {
  tickets: (params) => api.get('/api/admin/support/tickets/', { params }),
  ticket: (id) => api.get(`/api/admin/support/tickets/${id}/`),
  reply: (id, data) => api.post(`/api/admin/support/tickets/${id}/reply/`, data),
  replyTicket: (id, data) => api.post(`/api/admin/support/tickets/${id}/reply/`, data),
  assignTicket: (id, data) => api.post(`/api/admin/support/tickets/${id}/assign/`, data),
  closeTicket: (id) => api.post(`/api/admin/support/tickets/${id}/close/`),
  resolve: (id) => api.post(`/api/admin/support/tickets/${id}/resolve/`),
  complaints: (params) => api.get('/api/admin/complaints/', { params }),
  complaint: (id) => api.get(`/api/admin/complaints/${id}/`),
  resolveComplaint: (id) => api.post(`/api/admin/complaints/${id}/resolve/`),
};

export const complaintsAPI = {
  list: (params) => api.get('/api/admin/complaints/', { params }),
  get: (id) => api.get(`/api/admin/complaints/${id}/`),
  resolve: (id) => api.post(`/api/admin/complaints/${id}/resolve/`),
};

// ── EMERGENCIES / SOS ────────────────────────────────────
export const sosAPI = {
  list: () => api.get('/api/admin/emergencies/'),
  get: (id) => api.get(`/api/admin/emergencies/${id}/`),
  acknowledge: (id) => api.post(`/api/admin/emergencies/${id}/acknowledge/`),
  resolve: (id) => api.post(`/api/admin/emergencies/${id}/resolve/`),
  location: (id) => api.get(`/api/admin/emergencies/${id}/location/`),
};

export const emergencyAPI = sosAPI;

// ── RATINGS ──────────────────────────────────────────────
export const ratingsAPI = {
  list: (params) => api.get('/api/admin/ratings/', { params }),
  get: (id) => api.get(`/api/admin/ratings/${id}/`),
  delete: (id) => api.delete(`/api/admin/ratings/${id}/`),
};

// ── NOTIFICATIONS ────────────────────────────────────────
export const notificationsAPI = {
  list: () => api.get('/api/admin/notifications/'),
  send: (data) => api.post('/api/admin/notifications/send/', data),
  templates: () => api.get('/api/admin/notification-templates/'),
  createTemplate: (data) => api.post('/api/admin/notification-templates/', data),
  updateTemplate: (id, data) => api.put(`/api/admin/notification-templates/${id}/`, data),
};

// ── REFERRALS ────────────────────────────────────────────
export const referralsAPI = {
  list: () => api.get('/api/admin/referrals/'),
  get: (id) => api.get(`/api/admin/referrals/${id}/`),
  config: () => api.get('/api/admin/referral-config/'),
  updateConfig: (data) => api.put('/api/admin/referral-config/', data),
};

// ── LOCATIONS ────────────────────────────────────────────
export const locationsAPI = {
  cities: () => api.get('/api/admin/cities/'),
  createCity: (data) => api.post('/api/admin/cities/', data),
  updateCity: (id, data) => api.put(`/api/admin/cities/${id}/`, data),
  deleteCity: (id) => api.delete(`/api/admin/cities/${id}/`),
  zones: () => api.get('/api/admin/zones/'),
  createZone: (data) => api.post('/api/admin/zones/', data),
  updateZone: (id, data) => api.put(`/api/admin/zones/${id}/`, data),
  deleteZone: (id) => api.delete(`/api/admin/zones/${id}/`),
};

// ── SERVICES ─────────────────────────────────────────────
export const servicesAPI = {
  list: () => api.get('/api/admin/services/'),
  create: (data) => api.post('/api/admin/services/', data),
  update: (id, data) => api.put(`/api/admin/services/${id}/`, data),
  delete: (id) => api.delete(`/api/admin/services/${id}/`),
  activate: (id) => api.post(`/api/admin/services/${id}/activate/`),
  deactivate: (id) => api.post(`/api/admin/services/${id}/deactivate/`),
};

// ── PARCELS ──────────────────────────────────────────────
export const parcelsAPI = {
  list: (params) => api.get('/api/admin/parcels/', { params }),
  get: (id) => api.get(`/api/admin/parcels/${id}/`),
  active: () => api.get('/api/admin/parcels/active/'),
  completed: () => api.get('/api/admin/parcels/completed/'),
  cancelled: () => api.get('/api/admin/parcels/cancelled/'),
};

// ── MOVERS ───────────────────────────────────────────────
export const moversAPI = {
  list: () => api.get('/api/admin/movers/'),
  orders: () => api.get('/api/admin/moving-orders/'),
  order: (id) => api.get(`/api/admin/moving-orders/${id}/`),
  pricing: () => api.get('/api/admin/moving-pricing/'),
  createPricing: (data) => api.post('/api/admin/moving-pricing/', data),
  updatePricing: (id, data) => api.put(`/api/admin/moving-pricing/${id}/`, data),
};

// ── ADMIN USERS ──────────────────────────────────────────
export const adminUsersAPI = {
  list: () => api.get('/api/admin/admin-users/'),
  create: (data) => api.post('/api/admin/admin-users/', data),
  get: (id) => api.get(`/api/admin/admin-users/${id}/`),
  update: (id, data) => api.put(`/api/admin/admin-users/${id}/`, data),
  delete: (id) => api.delete(`/api/admin/admin-users/${id}/`),
  roles: () => api.get('/api/admin/roles/'),
  createRole: (data) => api.post('/api/admin/roles/', data),
  updateRole: (id, data) => api.put(`/api/admin/roles/${id}/`, data),
  permissions: () => api.get('/api/admin/permissions/'),
};

// ── REPORTS ──────────────────────────────────────────────
export const reportsAPI = {
  rides: (params) => api.get('/api/admin/reports/rides/', { params }),
  revenue: (params) => api.get('/api/admin/reports/revenue/', { params }),
  drivers: (params) => api.get('/api/admin/reports/drivers/', { params }),
  customers: (params) => api.get('/api/admin/reports/customers/', { params }),
  payments: (params) => api.get('/api/admin/reports/payments/', { params }),
  cancellations: (params) => api.get('/api/admin/reports/cancellations/', { params }),
  commission: (params) => api.get('/api/admin/reports/commission/', { params }),
  cities: (params) => api.get('/api/admin/reports/cities/', { params }),
  exportRides: () => api.get('/api/admin/reports/rides/export/', { responseType: 'blob' }),
  exportRevenue: () => api.get('/api/admin/reports/revenue/export/', { responseType: 'blob' }),
};

// ── SETTINGS ─────────────────────────────────────────────
export const settingsAPI = {
  list: () => api.get('/api/admin/settings/'),
  get: (key) => api.get(`/api/admin/settings/${key}/`),
  update: (key, data) => api.put(`/api/admin/settings/${key}/`, data),
};

// ── AUDIT LOGS ───────────────────────────────────────────
export const auditAPI = {
  list: (params) => api.get('/api/admin/audit-logs/', { params }),
  get: (id) => api.get(`/api/admin/audit-logs/${id}/`),
};

export default api;
