import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { parcelsAPI } from '../../api/client';

const PARCEL_COLS = [
  { key: 'id', label: 'Parcel ID', render: v => <strong style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{v}</strong> },
  { key: 'sender', label: 'Sender', render: v => <strong>{v}</strong> },
  { key: 'receiver', label: 'Receiver' },
  { key: 'driver', label: 'Driver', render: v => v === '—' ? <span style={{ color: 'var(--text-muted)' }}>Unassigned</span> : v },
  { key: 'from', label: 'Pickup', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
  { key: 'to', label: 'Drop', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
  { key: 'weight', label: 'Weight' },
  { key: 'fare', label: 'Fare', render: v => <strong>{v}</strong> },
  { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
  { key: 'date', label: 'Date', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
];

export default function Parcels() {
  const { data: parcels, loading, error, refetch } = useApi(parcelsAPI.list);

  if (loading) return <LoadingState text="Loading parcels..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const parcelsData = Array.isArray(parcels) ? parcels : (parcels?.results || []);

  return (
    <div>
      <PageHeader title="Parcels" subtitle="Manage parcel delivery orders" breadcrumb={['Services', 'Parcels']} />
      <DataTable
        title="All Parcels"
        columns={PARCEL_COLS}
        data={parcelsData}
        searchKeys={['id','sender','receiver','driver']}
        filters={[
          { key: 'status', label: 'Status', options: [
            {value:'active',label:'Active'},{value:'pending',label:'Pending'},
            {value:'completed',label:'Completed'},{value:'cancelled',label:'Cancelled'},
          ]},
        ]}
      />
    </div>
  );
}
