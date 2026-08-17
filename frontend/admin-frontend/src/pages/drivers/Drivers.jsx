import { useState } from 'react';
import { Ban, CheckCircle, Eye, Download, Star } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import StatCard from '../../components/shared/StatCard';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { driversAPI } from '../../api/client';
import { Users, UserCheck, AlertTriangle, Clock } from 'lucide-react';
import { XCircle } from 'lucide-react';

const DRIVER_COLS = [
  { key: 'id', label: 'ID', render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{v}</span> },
  { key: 'name', label: 'Driver', render: (v, row) => <strong>{v || row.full_name}</strong> },
  { key: 'phone', label: 'Phone', render: (v, row) => v || row.phone_number },
  { key: 'city', label: 'City' },
  { key: 'vehicle_type', label: 'Vehicle', render: v => v ? <span className="badge badge-primary">{v}</span> : '—' },
  { key: 'rating', label: 'Rating', render: v => v ? (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-yellow)' }}>
      <Star size={12} fill="currentColor" /> {Number(v).toFixed(1)}
    </span>
  ) : '—' },
  { key: 'total_rides', label: 'Rides', render: v => v ?? '—' },
  { key: 'online_status', label: 'Online', render: v => <StatusBadge status={v || 'offline'} /> },
  { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
  { key: 'verification_status', label: 'Verified', render: v => <StatusBadge status={v || 'pending'} /> },
  { key: 'actions', label: 'Actions', render: (_, row) => (
    <div style={{ display: 'flex', gap: 5 }}>
      <button className="btn btn-sm btn-ghost"><Eye size={13} /></button>
      {row.status !== 'suspended' && <button className="btn btn-sm btn-danger"><Ban size={13} /></button>}
      {row.status === 'suspended' && <button className="btn btn-sm btn-success"><CheckCircle size={13} /></button>}
    </div>
  )},
];

const CITIES_OPTS = ['Delhi','Mumbai','Bangalore','Pune','Hyderabad','Chennai','Kolkata','Jaipur']
  .map(c => ({ value: c, label: c }));
const VEHICLE_OPTS = ['Bike','Auto','Car','Taxi','Parcel','Tempo']
  .map(v => ({ value: v, label: v }));

export function DriverList() {
  const { data, loading, error, refetch } = useApi(driversAPI.list, []);
  const drivers = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const active    = drivers.filter(d => d.status === 'active').length;
  const pending   = drivers.filter(d => d.verification_status === 'pending').length;
  const suspended = drivers.filter(d => d.status === 'suspended').length;

  return (
    <div>
      <PageHeader title="Drivers" subtitle="Manage all registered drivers" breadcrumb={['Drivers', 'All Drivers']}>
        <button className="btn btn-secondary btn-sm"><Download size={14} /> Export</button>
      </PageHeader>
      <div className="grid-stat mb-24">
        <StatCard label="Total Drivers"     value={drivers.length} icon={Users}         color="purple" />
        <StatCard label="Active Drivers"    value={active}         icon={UserCheck}      color="green"  />
        <StatCard label="Pending Approval"  value={pending}        icon={Clock}          color="yellow" />
        <StatCard label="Suspended"         value={suspended}      icon={AlertTriangle}  color="pink"   />
      </div>
      <DataTable
        title="All Drivers"
        columns={DRIVER_COLS}
        data={drivers}
        searchKeys={['name', 'full_name', 'phone', 'phone_number', 'city']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' }, { value: 'pending', label: 'Pending' },
          ]},
          { key: 'vehicle_type', label: 'Vehicle', options: VEHICLE_OPTS },
          { key: 'city',         label: 'City',    options: CITIES_OPTS  },
          { key: 'online_status', label: 'Online', options: [
            { value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' },
            { value: 'on_ride', label: 'On Ride' },
          ]},
        ]}
      />
    </div>
  );
}

export function PendingApprovals() {
  const { data, loading, error, refetch } = useApi(
    () => driversAPI.list({ verification_status: 'pending' }), []
  );
  const pending = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const PEND_COLS = [
    ...DRIVER_COLS.slice(0, -1),
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-success" onClick={() => driversAPI.approve(row.id)}>
          <CheckCircle size={13} /> Approve
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => driversAPI.reject(row.id, { reason: 'Documents incomplete' })}>
          <XCircle size={13} /> Reject
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Pending Approvals" subtitle={`${pending.length} drivers waiting for approval`} breadcrumb={['Drivers', 'Pending Approval']} />
      <DataTable title="Pending Drivers" columns={PEND_COLS} data={pending} searchKeys={['name', 'full_name', 'phone', 'city']} />
    </div>
  );
}

export function DriverDocuments() {
  const { data, loading, error, refetch } = useApi(
    () => driversAPI.list({ verification_status: 'pending' }), []
  );
  const drivers = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // Flatten: each driver may have multiple documents
  const docs = drivers.flatMap(d =>
    (d.documents ?? []).map(doc => ({
      ...doc,
      driver_id: d.id,
      driver: d.name || d.full_name,
    }))
  );

  const DOC_COLS = [
    { key: 'driver', label: 'Driver', render: v => <strong>{v}</strong> },
    { key: 'driver_id', label: 'Driver ID', render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{v}</span> },
    { key: 'document_type', label: 'Document' },
    { key: 'submitted_at', label: 'Submitted' },
    { key: 'expires_at', label: 'Expires', render: v => v || <span style={{ color: 'var(--text-muted)' }}>N/A</span> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        {row.status === 'pending' && <>
          <button className="btn btn-sm btn-success" onClick={() => driversAPI.approveDoc(row.driver_id, row.id)}>
            <CheckCircle size={13} /> Approve
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => driversAPI.rejectDoc(row.driver_id, row.id, { reason: 'Document invalid' })}>
            <XCircle size={13} /> Reject
          </button>
        </>}
        {row.status !== 'pending' && <button className="btn btn-sm btn-ghost"><Eye size={13} /> View</button>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Driver Documents" subtitle="Verify driver documents" breadcrumb={['Drivers', 'Documents']} />
      <DataTable
        title="Documents"
        columns={DOC_COLS}
        data={docs}
        searchKeys={['driver', 'document_type']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]},
        ]}
      />
    </div>
  );
}

export function DriverEarnings() {
  const { data, loading, error, refetch } = useApi(
    () => import('../../api/client').then(m => m.earningsAPI.list()), []
  );
  const earnings = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const EARN_COLS = [
    { key: 'driver_id', label: 'ID', render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{v}</span> },
    { key: 'driver_name', label: 'Driver', render: v => <strong>{v}</strong> },
    { key: 'vehicle_type', label: 'Vehicle' },
    { key: 'today_earnings', label: 'Today', render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v ?? 0}</strong> },
    { key: 'week_earnings', label: 'This Week', render: v => `₹${v ?? 0}` },
    { key: 'month_earnings', label: 'This Month', render: v => `₹${v ?? 0}` },
    { key: 'commission_paid', label: 'Commission Paid', render: v => `₹${v ?? 0}` },
    { key: 'pending_payout', label: 'Pending Payout', render: v => <span style={{ color: 'var(--accent-yellow)' }}>₹{v ?? 0}</span> },
    { key: 'actions', label: 'Actions', render: () => <button className="btn btn-sm btn-primary">Pay Now</button> },
  ];

  return (
    <div>
      <PageHeader title="Driver Earnings" subtitle="Track and manage driver earnings & payouts" breadcrumb={['Drivers', 'Earnings']} />
      <DataTable title="Driver Earnings" columns={EARN_COLS} data={earnings} searchKeys={['driver_name', 'vehicle_type']} />
    </div>
  );
}

export function DriverRatings() {
  const { data, loading, error, refetch } = useApi(
    () => import('../../api/client').then(m => m.ratingsAPI.list({ type: 'customer_to_driver' })), []
  );
  const ratings = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const RAT_COLS = [
    { key: 'driver_name', label: 'Driver', render: v => <strong>{v}</strong> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'ride_id', label: 'Ride', render: v => <span style={{ color: 'var(--accent-primary)', fontSize: 12 }}>#{v}</span> },
    { key: 'rating', label: 'Rating', render: v => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={12} fill={i < v ? '#FFD93D' : 'none'} color={i < v ? '#FFD93D' : '#4A5568'} />
        ))}
        <span style={{ marginLeft: 4 }}>{v}</span>
      </span>
    )},
    { key: 'review', label: 'Review' },
    { key: 'created_at', label: 'Date', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'actions', label: '', render: (_, row) => (
      <button className="btn btn-sm btn-danger" onClick={() => ratingsAPI.delete(row.id)}>Delete</button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Driver Ratings" subtitle="Customer reviews for drivers" breadcrumb={['Drivers', 'Ratings']} />
      <DataTable
        title="Ratings & Reviews"
        columns={RAT_COLS}
        data={ratings}
        searchKeys={['driver_name', 'customer_name']}
        filters={[
          { key: 'rating', label: 'Rating', options: [1,2,3,4,5].map(r => ({ value: r, label: `${r} Star${r > 1 ? 's' : ''}` })) },
        ]}
      />
    </div>
  );
}
