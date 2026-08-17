import { useState } from 'react';
import { Eye, MessageSquare, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import StatCard from '../../components/shared/StatCard';
import Modal from '../../components/shared/Modal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { supportAPI, complaintsAPI, sosAPI } from '../../api/client';
import { Headphones, Clock, Users } from 'lucide-react';

const PRIORITY_COLORS = {
  critical: 'var(--accent-pink)',
  high:     'var(--accent-orange)',
  medium:   'var(--accent-yellow)',
  low:      'var(--status-active)',
};

export function Tickets() {
  const [selected, setSelected] = useState(null);
  const [reply, setReply] = useState('');
  const { data, loading, error, refetch } = useApi(supportAPI.tickets, []);
  const tickets = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const open    = tickets.filter(t => t.status === 'open').length;
  const resolved = tickets.filter(t => t.status === 'resolved').length;
  const unassigned = tickets.filter(t => !t.agent || t.agent === 'Unassigned').length;

  const COLS = [
    { key: 'ticket_id', label: 'Ticket', render: (v, row) => <strong style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>{v || `#TKT${row.id}`}</strong> },
    { key: 'subject',   label: 'Subject' },
    { key: 'user_name', label: 'User',     render: v => <strong>{v}</strong> },
    { key: 'type',      label: 'Type',     render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'priority',  label: 'Priority', render: v => v ? <span className="badge" style={{ background: `${PRIORITY_COLORS[v]}22`, color: PRIORITY_COLORS[v] }}>{v}</span> : '—' },
    { key: 'agent_name', label: 'Agent',   render: v => v || <span style={{ color: 'var(--text-muted)' }}>Unassigned</span> },
    { key: 'status',    label: 'Status',   render: v => <StatusBadge status={v} /> },
    { key: 'created_at',label: 'Date',     render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'actions',   label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-ghost" onClick={(e) => { e.stopPropagation(); setSelected(row); setReply(''); }}>
          <MessageSquare size={13} /> Reply
        </button>
        {row.status !== 'resolved' && (
          <button className="btn btn-sm btn-success" onClick={() => supportAPI.resolve(row.id).then(refetch)}>
            <CheckCircle size={13} />
          </button>
        )}
      </div>
    )},
  ];

  const handleReply = async () => {
    await supportAPI.reply(selected.id, { message: reply });
    setSelected(null);
    refetch();
  };

  return (
    <div>
      <PageHeader title="Support Tickets" subtitle="Manage customer and driver support tickets" breadcrumb={['Support', 'Tickets']}>
        <span className="badge badge-pending" style={{ fontSize: 12, padding: '6px 12px' }}>{open} Open</span>
      </PageHeader>
      <div className="grid-stat mb-24">
        <StatCard label="Total Tickets" value={tickets.length} icon={Headphones}    color="purple" />
        <StatCard label="Open"          value={open}           icon={Clock}          color="yellow" />
        <StatCard label="Resolved"      value={resolved}       icon={CheckCircle}    color="green"  />
        <StatCard label="Unassigned"    value={unassigned}     icon={Users}          color="pink"   />
      </div>
      <DataTable
        title="Tickets"
        columns={COLS}
        data={tickets}
        searchKeys={['ticket_id','subject','user_name']}
        filters={[
          { key: 'status',   label: 'Status',   options: [{value:'open',label:'Open'},{value:'pending',label:'Pending'},{value:'resolved',label:'Resolved'},{value:'closed',label:'Closed'}] },
          { key: 'priority', label: 'Priority', options: [{value:'critical',label:'Critical'},{value:'high',label:'High'},{value:'medium',label:'Medium'},{value:'low',label:'Low'}] },
          { key: 'type',     label: 'Type',     options: [{value:'customer',label:'Customer'},{value:'driver',label:'Driver'}] },
        ]}
      />
      {selected && (
        <Modal title={`Reply to ${selected.ticket_id || `#TKT${selected.id}`}`} onClose={() => setSelected(null)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setSelected(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleReply}><MessageSquare size={14} /> Send Reply</button>
          </>}
        >
          <div className="detail-grid mb-24">
            <div className="detail-item"><div className="detail-label">User</div><div className="detail-value">{selected.user_name}</div></div>
            <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value"><StatusBadge status={selected.status} /></div></div>
          </div>
          <div className="form-group">
            <label className="form-label">Subject</label>
            <input className="form-control" value={selected.subject} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">Your Reply</label>
            <textarea className="form-control" rows={4} placeholder="Type your reply here..." value={reply} onChange={e => setReply(e.target.value)} />
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Complaints() {
  const { data, loading, error, refetch } = useApi(complaintsAPI.list, []);
  const complaints = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const COMP_COLS = [
    { key: 'complaint_id', label: 'ID',         render: (v, row) => <strong style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--accent-pink)' }}>{v || `#CMP${row.id}`}</strong> },
    { key: 'filed_by',     label: 'Filed By',   render: v => <strong>{v}</strong> },
    { key: 'against',      label: 'Against' },
    { key: 'type',         label: 'Type' },
    { key: 'status',       label: 'Status',     render: v => <StatusBadge status={v} /> },
    { key: 'created_at',   label: 'Date',       render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'actions',      label: '',           render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-ghost"><Eye size={13} /></button>
        {row.status !== 'resolved' && (
          <button className="btn btn-sm btn-success" onClick={() => complaintsAPI.resolve(row.id).then(refetch)}>
            <CheckCircle size={13} /> Resolve
          </button>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Complaints" subtitle="Customer and driver complaints" breadcrumb={['Support', 'Complaints']} />
      <DataTable
        title="All Complaints"
        columns={COMP_COLS}
        data={complaints}
        searchKeys={['filed_by','against','type']}
        filters={[
          { key: 'status', label: 'Status', options: [{value:'open',label:'Open'},{value:'pending',label:'Pending'},{value:'resolved',label:'Resolved'}] },
        ]}
      />
    </div>
  );
}

export function SOS() {
  const { data, loading, error, refetch } = useApi(sosAPI.list, []);
  const emergencies = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const active = emergencies.filter(e => e.status === 'active' || e.status === 'acknowledged');

  return (
    <div>
      <PageHeader title="SOS / Emergency" subtitle="Real-time emergency management" breadcrumb={['Support', 'SOS']}>
        <div className="live-indicator"><span className="live-dot" />LIVE</div>
      </PageHeader>

      {active.map((e) => (
        <div key={e.id} className="card mb-24" style={{
          border: `1px solid ${e.status === 'active' ? 'rgba(255,75,139,0.5)' : 'rgba(255,217,61,0.3)'}`,
          background: e.status === 'active' ? 'rgba(255,75,139,0.05)' : 'rgba(255,217,61,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: e.status === 'active' ? 'rgba(255,75,139,0.2)' : 'rgba(255,217,61,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={20} color={e.status === 'active' ? 'var(--accent-pink)' : 'var(--accent-yellow)'} />
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{e.sos_type || e.type}</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.ride_id ? `#${e.ride_id}` : ''} · {e.created_at}</span>
              </div>
            </div>
            <StatusBadge status={e.status} />
          </div>

          <div className="detail-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
            <div className="detail-item"><div className="detail-label">Customer</div><div className="detail-value">{e.customer_name}</div></div>
            <div className="detail-item"><div className="detail-label">Driver</div><div className="detail-value">{e.driver_name}</div></div>
            <div className="detail-item"><div className="detail-label">Contact</div><div className="detail-value" style={{ color: 'var(--accent-primary)' }}>{e.contact || e.customer_phone}</div></div>
            <div className="detail-item"><div className="detail-label">Current Location</div><div className="detail-value" style={{ color: 'var(--accent-secondary)' }}>{e.location || '—'}</div></div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {e.status === 'active' && (
              <button className="btn btn-warning" onClick={() => sosAPI.acknowledge(e.id).then(refetch)}>
                <AlertTriangle size={14} /> Acknowledge
              </button>
            )}
            {e.status === 'acknowledged' && (
              <button className="btn btn-success" onClick={() => sosAPI.resolve(e.id).then(refetch)}>
                <CheckCircle size={14} /> Mark Resolved
              </button>
            )}
            <button className="btn btn-secondary">View on Map</button>
            <button className="btn btn-danger">Call Police</button>
          </div>
        </div>
      ))}

      <div className="table-container">
        <div className="table-header"><h3>Emergency History</h3></div>
        <table>
          <thead><tr><th>Ride</th><th>Customer</th><th>Driver</th><th>Type</th><th>Time</th><th>Status</th></tr></thead>
          <tbody>
            {emergencies.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No emergency records</td></tr>
            ) : emergencies.map(e => (
              <tr key={e.id}>
                <td><strong style={{ color: 'var(--accent-primary)', fontSize: 12 }}>{e.ride_id ? `#${e.ride_id}` : '—'}</strong></td>
                <td><strong>{e.customer_name}</strong></td>
                <td>{e.driver_name}</td>
                <td>{e.sos_type || e.type}</td>
                <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{e.created_at}</td>
                <td><StatusBadge status={e.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
