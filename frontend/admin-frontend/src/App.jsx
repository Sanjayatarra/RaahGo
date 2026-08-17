import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Layout from './components/layout/Layout';

// Auth
import Login from './pages/auth/Login';

// Pages
import Dashboard from './pages/dashboard/Dashboard';
import LiveMap from './pages/operations/LiveMap';
import { AllRides, LiveRides, ScheduledRides } from './pages/operations/Rides';
import { CustomerList, CustomerWallets } from './pages/customers/Customers';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import { DriverList, PendingApprovals, DriverDocuments, DriverEarnings, DriverRatings } from './pages/drivers/Drivers';
import DriverDetailPage from './pages/drivers/DriverDetailPage';
import { VehicleList, VehicleTypes } from './pages/vehicles/Vehicles';
import Services from './pages/services/Services';
import { FareManagement, SurgePricing, CancellationCharges } from './pages/pricing/Pricing';
import { Transactions, Refunds, DriverPayouts, Commission } from './pages/payments/Payments';
import { Coupons, Referrals } from './pages/offers/Offers';
import { Tickets, Complaints, SOS } from './pages/support/Support';
import Notifications from './pages/notifications/Notifications';
import Locations from './pages/locations/Locations';
import Parcels from './pages/parcels/Parcels';
import Movers from './pages/movers/Movers';
import Reports from './pages/reports/Reports';
import { AdminUsers, Roles } from './pages/admin/AdminManagement';
import AuditLogs from './pages/audit/AuditLogs';
import Ratings from './pages/ratings/Ratings';
import Settings from './pages/settings/Settings';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard */}
        <Route index element={<Dashboard />} />

        {/* Operations */}
        <Route path="operations/live-map" element={<LiveMap />} />
        <Route path="operations/live-rides" element={<LiveRides />} />
        <Route path="operations/rides" element={<AllRides />} />
        <Route path="operations/scheduled" element={<ScheduledRides />} />

        {/* Customers */}
        <Route path="customers" element={<CustomerList />} />
        <Route path="customers/:id" element={<CustomerDetailPage />} />
        <Route path="customers/wallets" element={<CustomerWallets />} />
        <Route path="customers/complaints" element={<Complaints />} />

        {/* Drivers */}
        <Route path="drivers" element={<DriverList />} />
        <Route path="drivers/:id" element={<DriverDetailPage />} />
        <Route path="drivers/pending" element={<PendingApprovals />} />
        <Route path="drivers/documents" element={<DriverDocuments />} />
        <Route path="drivers/vehicles" element={<VehicleList />} />
        <Route path="drivers/earnings" element={<DriverEarnings />} />
        <Route path="drivers/ratings" element={<DriverRatings />} />

        {/* Vehicles */}
        <Route path="vehicles" element={<VehicleList />} />
        <Route path="vehicles/types" element={<VehicleTypes />} />

        {/* Services */}
        <Route path="services" element={<Services />} />
        <Route path="parcels" element={<Parcels />} />
        <Route path="movers" element={<Movers />} />

        {/* Pricing */}
        <Route path="pricing/fare" element={<FareManagement />} />
        <Route path="pricing/surge" element={<SurgePricing />} />
        <Route path="pricing/cancellation" element={<CancellationCharges />} />

        {/* Payments */}
        <Route path="payments" element={<Transactions />} />
        <Route path="payments/refunds" element={<Refunds />} />
        <Route path="payments/payouts" element={<DriverPayouts />} />
        <Route path="payments/commission" element={<Commission />} />

        {/* Offers */}
        <Route path="offers/coupons" element={<Coupons />} />
        <Route path="offers/referrals" element={<Referrals />} />

        {/* Support */}
        <Route path="support/tickets" element={<Tickets />} />
        <Route path="support/complaints" element={<Complaints />} />
        <Route path="support/sos" element={<SOS />} />

        {/* Other */}
        <Route path="notifications" element={<Notifications />} />
        <Route path="ratings" element={<Ratings />} />
        <Route path="locations" element={<Locations />} />
        <Route path="reports" element={<Reports />} />

        {/* Admin Management */}
        <Route path="admin/users" element={<AdminUsers />} />
        <Route path="admin/roles" element={<Roles />} />

        {/* Audit & Settings */}
        <Route path="audit" element={<AuditLogs />} />
        <Route path="settings" element={<Settings />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
