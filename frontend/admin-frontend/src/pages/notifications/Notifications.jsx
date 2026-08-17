import { useState } from 'react';
import { Send, Plus, Bell, Users, UserCheck } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';
import DataTable from '../../components/shared/DataTable';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { notificationsAPI } from '../../api/client';

export default function Notifications() {
  const [showSendModal, setShowSendModal] = useState(false);
  const [tab, setTab] = useState('send');
  const [audience, setAudience] = useState('all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [channel, setChannel] = useState('Push Notification');
  const [submitting, setSubmitting] = useState(false);

  const { data: templatesData, loading: loadingTemplates, error: errorTemplates, refetch: refetchTemplates } = useApi(notificationsAPI.templates);
  const { data: historyData, loading: loadingHistory, error: errorHistory, refetch: refetchHistory } = useApi(notificationsAPI.list);

  const templates = Array.isArray(templatesData) ? templatesData : (templatesData?.results || []);
  const history = Array.isArray(historyData) ? historyData : (historyData?.results || []);

  const handleSend = async () => {
    if (!title || !message) {
      alert('Please enter title and message');
      return;
    }
    setSubmitting(true);
    try {
      await notificationsAPI.send({ title, message, audience, channel });
      alert('Notification sent successfully!');
      setTitle('');
      setMessage('');
      refetchHistory();
      setTab('history');
    } catch {
      alert('Failed to send notification');
    } finally {
      setSubmitting(false);
    }
  };

  const HIST_COLS = [
    { key: 'title', label: 'Title', render: v => <strong>{v}</strong> },
    { key: 'audience', label: 'Audience', render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'sent_to', label: 'Sent To', render: v => (Number(v) || 0).toLocaleString() },
    { key: 'opened', label: 'Opened', render: (v, row) => (
      <span style={{ color: 'var(--accent-secondary)' }}>{v} ({Math.round(((Number(v)||0)/(Number(row.sent_to)||1))*100)}%)</span>
    )},
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'date', label: 'Date', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
  ];

  if (loadingTemplates || loadingHistory) return <LoadingState text="Loading notifications..." />;
  if (errorTemplates || errorHistory) return <ErrorState message={errorTemplates || errorHistory} onRetry={() => { refetchTemplates(); refetchHistory(); }} />;

  return (
    <div>
      <PageHeader title="Notifications" subtitle="Send push notifications, SMS, and emails" breadcrumb={['Notifications']}>
        <button className="btn btn-primary" onClick={() => setTab('send')}>
          <Send size={15} /> Send Notification
        </button>
      </PageHeader>

      <div className="tabs">
        {['send','templates','history'].map(t => (
          <button key={t} className={`tab${tab===t?' active':''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'send' && (
        <div className="card" style={{ maxWidth: 640 }}>
          <h3 style={{ marginBottom: 20, fontSize: 16 }}>Send Notification</h3>
          <div className="form-group">
            <label className="form-label">Audience</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {['all','customers','drivers'].map(a => (
                <button
                  key={a}
                  type="button"
                  className={`btn btn-sm ${audience === a ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ flex: 1 }}
                  onClick={() => setAudience(a)}
                >
                  {a === 'all' ? '👥 ' : a === 'customers' ? <Users size={13}/> : <UserCheck size={13}/>}
                  {' ' + a.charAt(0).toUpperCase() + a.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notification Title</label>
            <input className="form-control" placeholder="e.g. New Offer 🎁" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Message</label>
            <textarea className="form-control" rows={3} placeholder="Write your notification message..." value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Channel</label>
              <select className="form-control" value={channel} onChange={e => setChannel(e.target.value)}>
                <option value="Push Notification">Push Notification</option>
                <option value="SMS">SMS</option>
                <option value="Email">Email</option>
                <option value="All Channels">All Channels</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={handleSend} disabled={submitting}>
              <Send size={14} /> {submitting ? 'Sending...' : 'Send Now'}
            </button>
          </div>
        </div>
      )}

      {tab === 'templates' && (
        <div className="grid-2">
          {templates.map(t => (
            <div key={t.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                <h3 style={{ fontSize: 14, fontWeight: 600 }}>{t.name}</h3>
                <span className="badge badge-primary">{t.audience}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t.title}</p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, fontFamily: 'monospace' }}>{t.message}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-sm" onClick={() => {
                  setTitle(t.title);
                  setMessage(t.message);
                  setAudience(t.audience);
                  setTab('send');
                }}><Send size={12} /> Use</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <DataTable title="Notification History" columns={HIST_COLS} data={history} />
      )}
    </div>
  );
}
