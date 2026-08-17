import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import { Eye } from 'lucide-react';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { auditAPI } from '../../api/client';

const ACTION_COLORS = {
  'Suspended Driver': 'var(--accent-pink)',
  'Approved Driver': 'var(--status-active)',
  'Rejected Document': 'var(--accent-orange)',
  'Blocked Customer': 'var(--accent-pink)',
  'Processed Refund': 'var(--accent-yellow)',
  'Updated Pricing': 'var(--accent-primary)',
  'Created Coupon': 'var(--accent-secondary)',
  'Sent Notification': 'var(--accent-primary)',
  'Updated Settings': 'var(--text-secondary)',
  'Admin Login': 'var(--accent-primary)',
};

const LOG_COLS = [
  { key: 'id', label: '#', render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{v}</span> },
  { key: 'admin', label: 'Admin', render: (v, row) => (
    <div>
      <strong>{v}</strong>
      <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.role}</p>
    </div>
  )},
  { key: 'action', label: 'Action', render: v => (
    <span style={{ color: ACTION_COLORS[v] || 'var(--text-primary)', fontWeight: 600, fontSize: 12 }}>{v}</span>
  )},
  { key: 'target', label: 'Target', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
  { key: 'reason', label: 'Reason', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)', maxWidth: 200, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span> },
  { key: 'ip', label: 'IP', render: v => <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{v}</span> },
  { key: 'time', label: 'Time', render: v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
  { key: 'actions', label: '', render: () => <button className="btn btn-sm btn-ghost"><Eye size={13} /></button> },
];

export default function AuditLogs() {
  const { data: logs, loading, error, refetch } = useApi(auditAPI.list);

  if (loading) return <LoadingState text="Loading audit activity..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const auditData = Array.isArray(logs) ? logs : (logs?.results || []);

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        subtitle="Complete trail of all admin actions"
        breadcrumb={['Audit Logs']}
      >
        <div className="alert alert-info" style={{ margin: 0, padding: '6px 14px' }}>
          Every sensitive action is recorded automatically
        </div>
      </PageHeader>
      <DataTable
        title="Activity Log"
        columns={LOG_COLS}
        data={auditData}
        searchKeys={['admin','action','target']}
        filters={[
          { key: 'role', label: 'Admin Role', options: [
            { value: 'Super Admin', label: 'Super Admin' },
            { value: 'Operations Admin', label: 'Operations Admin' },
            { value: 'Support Admin', label: 'Support Admin' },
            { value: 'Finance Admin', label: 'Finance Admin' },
          ]},
          { key: 'action', label: 'Action', options: Object.keys(ACTION_COLORS).map(k=>({value:k,label:k})) },
        ]}
      />
    </div>
  );
}
