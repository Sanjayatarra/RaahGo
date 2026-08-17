import { Ban, CheckCircle, Eye, Download } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { customersAPI } from '../../api/client';

const COLS = [
  { key: 'id',     label: 'ID',      render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{v}</span> },
  { key: 'name',   label: 'Name',    render: (v, row) => <strong>{v || row.full_name}</strong> },
  { key: 'phone',  label: 'Phone',   render: (v, row) => v || row.phone_number },
  { key: 'city',   label: 'City' },
  { key: 'total_rides', label: 'Total Rides', render: v => <strong>{v ?? '—'}</strong> },
  { key: 'wallet_balance', label: 'Wallet', render: v => v != null ? `₹${v}` : '—' },
  { key: 'status', label: 'Status',  render: v => <StatusBadge status={v} /> },
  { key: 'date_joined', label: 'Joined', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
  { key: 'actions', label: 'Actions', render: (_, row) => (
    <div style={{ display: 'flex', gap: 6 }}>
      <button className="btn btn-sm btn-ghost"><Eye size={13} /></button>
      <button
        className={`btn btn-sm ${row.status === 'blocked' ? 'btn-success' : 'btn-danger'}`}
        onClick={() => row.status === 'blocked' ? customersAPI.unblock(row.id) : customersAPI.block(row.id)}
      >
        {row.status === 'blocked' ? <CheckCircle size={13} /> : <Ban size={13} />}
      </button>
    </div>
  )},
];

export function CustomerList() {
  const { data, loading, error, refetch } = useApi(customersAPI.list, []);
  const customers = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Customers" subtitle="Manage all app customers" breadcrumb={['Customers', 'All Customers']}>
        <button className="btn btn-secondary btn-sm"><Download size={14} /> Export</button>
      </PageHeader>
      <DataTable
        title="All Customers"
        columns={COLS}
        data={customers}
        searchKeys={['name', 'full_name', 'phone', 'phone_number', 'email', 'city']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'blocked', label: 'Blocked' },
          ]},
        ]}
      />
    </div>
  );
}

export function CustomerWallets() {
  const { data, loading, error, refetch } = useApi(
    () => import('../../api/client').then(m => m.walletsAPI.list()), []
  );
  const wallets = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const WCOLS = [
    { key: 'id',      label: 'ID',       render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{v}</span> },
    { key: 'name',    label: 'Customer', render: (v, row) => <strong>{v || row.user_name || row.full_name}</strong> },
    { key: 'phone',   label: 'Phone' },
    { key: 'balance', label: 'Balance',  render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v ?? 0}</strong> },
    { key: 'total_transactions', label: 'Transactions', render: v => v ?? '—' },
    { key: 'status',  label: 'Status',   render: v => <StatusBadge status={v} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-sm btn-success" onClick={() => {
          const amount = prompt('Credit amount (₹):');
          const reason = prompt('Reason:');
          if (amount && reason) {
            import('../../api/client').then(m => m.walletsAPI.credit(row.id, { amount, reason }));
          }
        }}>Credit</button>
        <button className="btn btn-sm btn-danger" onClick={() => {
          const amount = prompt('Debit amount (₹):');
          const reason = prompt('Reason:');
          if (amount && reason) {
            import('../../api/client').then(m => m.walletsAPI.debit(row.id, { amount, reason }));
          }
        }}>Debit</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Customer Wallets" subtitle="Manage customer wallet balances" breadcrumb={['Customers', 'Wallets']} />
      <DataTable title="Customer Wallets" columns={WCOLS} data={wallets} searchKeys={['name', 'user_name', 'phone']} />
    </div>
  );
}
