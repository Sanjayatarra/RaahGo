import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { moversAPI } from '../../api/client';

const MOVER_COLS = [
  { key: 'id', label: 'Order ID', render: v => <strong style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-secondary)' }}>{v}</strong> },
  { key: 'customer', label: 'Customer', render: v => <strong>{v}</strong> },
  { key: 'from', label: 'From', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
  { key: 'to', label: 'To', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
  { key: 'vehicle', label: 'Vehicle', render: v => <span className="badge badge-primary">{v}</span> },
  { key: 'items', label: 'Category' },
  { key: 'driver', label: 'Driver', render: v => v === '—' ? <span style={{ color: 'var(--text-muted)' }}>Unassigned</span> : v },
  { key: 'fare', label: 'Fare', render: v => <strong>{v}</strong> },
  { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
  { key: 'date', label: 'Date', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
];

export default function Movers() {
  const { data: orders, loading, error, refetch } = useApi(moversAPI.orders);

  if (loading) return <LoadingState text="Loading moving orders..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const ordersData = Array.isArray(orders) ? orders : (orders?.results || []);

  return (
    <div>
      <PageHeader title="Movers" subtitle="Manage moving and relocation orders" breadcrumb={['Services', 'Movers']} />
      <DataTable
        title="Moving Orders"
        columns={MOVER_COLS}
        data={ordersData}
        searchKeys={['id','customer','driver']}
        filters={[
          { key: 'status', label: 'Status', options: [
            {value:'active',label:'Active'},{value:'pending',label:'Pending'},
            {value:'completed',label:'Completed'},{value:'cancelled',label:'Cancelled'},
          ]},
          { key: 'vehicle', label: 'Vehicle', options: [{value:'Mini Truck',label:'Mini Truck'},{value:'Tempo',label:'Tempo'},{value:'Large Truck',label:'Large Truck'}] },
        ]}
      />
    </div>
  );
}
