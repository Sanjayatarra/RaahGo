import { useState } from 'react';
import { Plus, Edit, Trash2, Power } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { couponsAPI, referralsAPI } from '../../api/client';

const COUPON_COLS = [
  { key: 'code', label: 'Code', render: v => <strong style={{ fontFamily: 'monospace', color: 'var(--accent-primary)', fontSize: 14 }}>{v}</strong> },
  { key: 'discount_type', label: 'Type', render: v => <span className="badge badge-primary">{v}</span> },
  { key: 'discount', label: 'Discount', render: (v, row) => <strong>{row.discount_type === 'percentage' ? `${v}%` : `₹${v}`}</strong> },
  { key: 'max_discount', label: 'Max Off', render: v => `₹${v}` },
  { key: 'min_fare', label: 'Min Fare', render: v => `₹${v}` },
  { key: 'used', label: 'Used', render: (v, row) => `${v}/${row.usage_limit || 1000}` },
  { key: 'expires', label: 'Expires', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
  { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
  { key: 'actions', label: '', render: (_, row) => (
    <div style={{ display: 'flex', gap: 5 }}>
      <button className="btn btn-sm btn-ghost"><Edit size={13} /></button>
      <button className={`btn btn-sm ${row.status === 'active' ? 'btn-warning' : 'btn-success'}`}>
        {row.status === 'active' ? 'Deactivate' : 'Activate'}
      </button>
      <button className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
    </div>
  )},
];

export function Coupons() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', discount_type: 'percentage', discount: 20, max_discount: 100, min_fare: 100, usage_limit: 1000 });
  const [submitting, setSubmitting] = useState(false);

  const { data: coupons, loading, error, refetch } = useApi(couponsAPI.list);

  const handleCreate = async () => {
    if (!form.code) return;
    setSubmitting(true);
    try {
      await couponsAPI.create(form);
      setShowModal(false);
      refetch();
    } catch {
      alert('Failed to create coupon');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState text="Loading coupons..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const couponsData = Array.isArray(coupons) ? coupons : (coupons?.results || []);

  return (
    <div>
      <PageHeader title="Coupons & Promo Codes" subtitle="Manage discount coupons" breadcrumb={['Offers', 'Coupons']}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> Create Coupon</button>
      </PageHeader>
      <DataTable
        title="All Coupons"
        columns={COUPON_COLS}
        data={couponsData}
        searchKeys={['code']}
        filters={[
          { key: 'status', label: 'Status', options: [{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}] },
          { key: 'discount_type', label: 'Type', options: [{value:'percentage',label:'Percentage'},{value:'flat',label:'Flat'}] },
        ]}
      />
      {showModal && (
        <Modal title="Create Coupon" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create'}
            </button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Coupon Code</label>
              <input className="form-control" placeholder="RAAHGO50" style={{ textTransform: 'uppercase' }} value={form.code} onChange={e => setForm({...form, code: e.target.value.toUpperCase()})} />
            </div>
            <div className="form-group">
              <label className="form-label">Discount Type</label>
              <select className="form-control" value={form.discount_type} onChange={e => setForm({...form, discount_type: e.target.value})}>
                <option value="percentage">percentage</option>
                <option value="flat">flat</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Discount Value</label>
              <input className="form-control" type="number" value={form.discount} onChange={e => setForm({...form, discount: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Max Discount (₹)</label>
              <input className="form-control" type="number" value={form.max_discount} onChange={e => setForm({...form, max_discount: Number(e.target.value)})} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Min Fare (₹)</label>
              <input className="form-control" type="number" value={form.min_fare} onChange={e => setForm({...form, min_fare: Number(e.target.value)})} />
            </div>
            <div className="form-group">
              <label className="form-label">Usage Limit</label>
              <input className="form-control" type="number" value={form.usage_limit} onChange={e => setForm({...form, usage_limit: Number(e.target.value)})} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Referrals() {
  const { data: referrals, loading, error, refetch } = useApi(referralsAPI.list);

  const REF_COLS = [
    { key: 'referrer', label: 'Referrer', render: v => <strong>{v}</strong> },
    { key: 'referred', label: 'Referred', render: v => <strong>{v}</strong> },
    { key: 'reward_referrer', label: 'Referrer Reward', render: v => <span style={{ color: 'var(--status-active)' }}>{v}</span> },
    { key: 'reward_referred', label: 'Referred Reward', render: v => <span style={{ color: 'var(--accent-primary)' }}>{v}</span> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'date', label: 'Date', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
  ];

  if (loading) return <LoadingState text="Loading referrals..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const refData = Array.isArray(referrals) ? referrals : (referrals?.results || []);

  return (
    <div>
      <PageHeader title="Referral Program" subtitle="Track customer referrals and rewards" breadcrumb={['Offers', 'Referrals']}>
        <button className="btn btn-secondary">Configure Program</button>
      </PageHeader>
      <div className="card mb-24">
        <h3 style={{ marginBottom: 16, fontSize: 15 }}>Referral Configuration</h3>
        <div className="detail-grid">
          <div className="detail-item"><div className="detail-label">Referrer Reward</div><div className="detail-value" style={{ color: 'var(--status-active)' }}>₹50 wallet credit</div></div>
          <div className="detail-item"><div className="detail-label">Referred Reward</div><div className="detail-value" style={{ color: 'var(--accent-primary)' }}>₹100 first ride off</div></div>
          <div className="detail-item"><div className="detail-label">Min Ride for Reward</div><div className="detail-value">₹150</div></div>
          <div className="detail-item"><div className="detail-label">Max per User</div><div className="detail-value">10 referrals</div></div>
          <div className="detail-item"><div className="detail-label">Status</div><div className="detail-value"><StatusBadge status="active" /></div></div>
        </div>
      </div>
      <DataTable title="Referral History" columns={REF_COLS} data={refData} searchKeys={['referrer','referred']} />
    </div>
  );
}
