import { useState } from 'react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { ridesAPI } from '../../api/client';

const COLS = [
  { key: 'ride_id', label: 'Ride ID', render: (v, row) => <strong style={{ color: 'var(--accent-primary)', fontSize: 12 }}>{v || `#RD${row.id}`}</strong> },
  { key: 'customer', label: 'Customer', render: (v, row) => <strong>{v || row.customer_name}</strong> },
  { key: 'driver', label: 'Driver', render: (v, row) => v || row.driver_name || <span style={{ color: 'var(--text-muted)' }}>—</span> },
  { key: 'pickup_address', label: 'From', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
  { key: 'drop_address', label: 'To', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
  { key: 'vehicle_type', label: 'Vehicle', render: v => v ? <span className="badge badge-primary">{v}</span> : '—' },
  { key: 'fare', label: 'Fare', render: v => <strong>{v ? `₹${v}` : '—'}</strong> },
  { key: 'distance', label: 'Distance', render: v => v ? `${v} km` : '—' },
  { key: 'payment_method', label: 'Payment' },
  { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
  { key: 'created_at', label: 'Time', render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{v}</span> },
];

const STATUS_FILTERS = [
  { key: 'status', label: 'Status', options: [
    { value: 'completed', label: 'Completed' },
    { value: 'active', label: 'Active' },
    { value: 'cancelled', label: 'Cancelled' },
  ]},
  { key: 'vehicle_type', label: 'Vehicle', options: [
    { value: 'Bike', label: 'Bike' },
    { value: 'Auto', label: 'Auto' },
    { value: 'Car', label: 'Car' },
    { value: 'Taxi', label: 'Taxi' },
  ]},
  { key: 'payment_method', label: 'Payment', options: [
    { value: 'cash', label: 'Cash' },
    { value: 'wallet', label: 'Wallet' },
    { value: 'upi', label: 'UPI' },
  ]},
];

export function AllRides() {
  const { data, loading, error, refetch } = useApi(ridesAPI.list, []);
  const rides = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="All Rides" subtitle="Complete ride history" breadcrumb={['Operations', 'All Rides']}>
        <button className="btn btn-secondary btn-sm">Export CSV</button>
      </PageHeader>
      <DataTable
        title="All Rides"
        columns={COLS}
        data={rides}
        searchKeys={['customer', 'driver', 'ride_id', 'customer_name', 'driver_name']}
        filters={STATUS_FILTERS}
      />
    </div>
  );
}

export function LiveRides() {
  const { data, loading, error, refetch } = useApi(ridesAPI.live, []);
  const rides = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Live Rides" subtitle="Currently active rides" breadcrumb={['Operations', 'Live Rides']}>
        <div className="live-indicator"><span className="live-dot" />LIVE</div>
      </PageHeader>
      <DataTable title={`Active Rides (${rides.length})`} columns={COLS} data={rides} searchKeys={['customer', 'driver', 'ride_id', 'customer_name', 'driver_name']} />
    </div>
  );
}

export function ScheduledRides() {
  const { data, loading, error, refetch } = useApi(ridesAPI.scheduled, []);
  const rides = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Scheduled Rides" subtitle="Upcoming scheduled rides" breadcrumb={['Operations', 'Scheduled Rides']} />
      <DataTable title={`Scheduled (${rides.length})`} columns={COLS} data={rides} searchKeys={['customer', 'driver', 'ride_id', 'customer_name', 'driver_name']} />
    </div>
  );
}
