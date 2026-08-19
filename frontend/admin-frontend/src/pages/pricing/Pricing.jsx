import { useState } from 'react';
import { Plus, Edit, Trash2, Zap } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { pricingAPI, surgeAPI } from '../../api/client';

const VEHICLE_TYPES = ['Bike','Auto','E-Rickshaw','Car','Taxi','Parcel','Mini Truck','Tempo'];

const PRICING_COLS = [
  { key: 'vehicle_type', label: 'Vehicle', render: v => <span className="badge badge-primary">{v}</span> },
  { key: 'city',         label: 'City' },
  { key: 'base_fare',    label: 'Base Fare',   render: v => <strong>₹{v}</strong> },
  { key: 'per_km',       label: 'Per KM',      render: v => `₹${v}` },
  { key: 'per_minute',   label: 'Per Min',     render: v => `₹${v}` },
  { key: 'minimum_fare', label: 'Min Fare',    render: v => `₹${v}` },
  { key: 'waiting_charge', label: 'Waiting/min', render: v => `₹${v}` },
  { key: 'status',       label: 'Status',      render: v => <StatusBadge status={v} /> },
  { key: 'actions',      label: '',            render: (_, row) => (
    <div style={{ display: 'flex', gap: 5 }}>
      <button className="btn btn-sm btn-ghost"><Edit size={13} /></button>
      <button className="btn btn-sm btn-danger" onClick={() => pricingAPI.delete(row.id)}><Trash2 size={13} /></button>
    </div>
  )},
];

const EMPTY_PRICE_FORM = { vehicle_type: 'Bike', city: '', base_fare: '', per_km: '', per_minute: '', minimum_fare: '', waiting_charge: '' };

export function FareManagement() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_PRICE_FORM);
  const [saving, setSaving] = useState(false);
  const { data, loading, error, refetch } = useApi(pricingAPI.list, []);
  const pricing = Array.isArray(data) ? data : (data?.results ?? []);

  const handleEdit = (row) => {
    setForm({
      id: row.id,
      vehicle_type: row.vehicle_type || 'Bike',
      city: row.city || 'All Cities',
      base_fare: row.base_fare ?? '',
      per_km: row.per_km ?? '',
      per_minute: row.per_minute ?? '',
      minimum_fare: row.minimum_fare ?? '',
      waiting_charge: row.waiting_charge ?? '2.0',
      status: row.status || 'active',
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setForm(EMPTY_PRICE_FORM);
    setShowModal(true);
  };

  const handleDelete = async (row) => {
    if (window.confirm(`Are you sure you want to delete the fare pricing rule for ${row.vehicle_type}?`)) {
      try {
        await pricingAPI.delete(row.id);
        refetch();
      } catch (err) {
        alert(err?.response?.data?.error || 'Failed to delete pricing rule');
      }
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (form.id) {
        await pricingAPI.update(form.id, form);
      } else {
        await pricingAPI.create(form);
      }
      setShowModal(false);
      setForm(EMPTY_PRICE_FORM);
      refetch();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save pricing rule');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'vehicle_type', label: 'Vehicle', render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'city',         label: 'City' },
    { key: 'base_fare',    label: 'Base Fare',   render: v => <strong>₹{v}</strong> },
    { key: 'per_km',       label: 'Per KM',      render: v => `₹${v}` },
    { key: 'per_minute',   label: 'Per Min',     render: v => `₹${v}` },
    { key: 'minimum_fare', label: 'Min Fare',    render: v => `₹${v}` },
    { key: 'waiting_charge', label: 'Waiting/min', render: v => `₹${v}` },
    { key: 'status',       label: 'Status',      render: v => <StatusBadge status={v} /> },
    { key: 'actions',      label: 'Actions',     render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button 
          className="btn btn-sm btn-ghost" 
          title="Edit Fare Pricing"
          onClick={() => handleEdit(row)}
        >
          <Edit size={13} />
        </button>
        <button 
          className="btn btn-sm btn-danger" 
          title="Delete Rule"
          onClick={() => handleDelete(row)}
        >
          <Trash2 size={13} />
        </button>
      </div>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Fare Management" subtitle="Configure base fares and per-distance rates" breadcrumb={['Pricing', 'Fare']}>
        <button className="btn btn-primary" onClick={handleAddNew}><Plus size={15} /> Add Pricing</button>
      </PageHeader>
      <DataTable
        title="Pricing Rules"
        columns={columns}
        data={pricing}
        searchKeys={['vehicle_type', 'city']}
        filters={[
          { key: 'vehicle_type', label: 'Vehicle', options: VEHICLE_TYPES.map(v => ({ value: v, label: v })) },
        ]}
      />
      {showModal && (
        <Modal 
          title={form.id ? `Manage Fare: ${form.vehicle_type}` : "Add Pricing Rule"} 
          onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (form.id ? 'Update Fare' : 'Save Pricing')}
            </button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vehicle Type</label>
              <select 
                className="form-control" 
                value={form.vehicle_type} 
                onChange={e => setForm(f=>({...f, vehicle_type: e.target.value}))}
              >
                {VEHICLE_TYPES.map(v => <option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">City / Region</label>
              <input 
                className="form-control" 
                value={form.city} 
                placeholder="e.g. All Cities or Delhi"
                onChange={e=>setForm(f=>({...f, city: e.target.value}))} 
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Base Fare (₹)</label>
              <input 
                className="form-control" 
                type="number" 
                step="0.5"
                value={form.base_fare} 
                onChange={e=>setForm(f=>({...f, base_fare: e.target.value}))} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Per KM Rate (₹)</label>
              <input 
                className="form-control" 
                type="number" 
                step="0.5"
                value={form.per_km} 
                onChange={e=>setForm(f=>({...f, per_km: e.target.value}))} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Per Minute Rate (₹)</label>
              <input 
                className="form-control" 
                type="number" 
                step="0.1"
                value={form.per_minute} 
                onChange={e=>setForm(f=>({...f, per_minute: e.target.value}))} 
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Minimum Fare (₹)</label>
              <input 
                className="form-control" 
                type="number" 
                step="0.5"
                value={form.minimum_fare} 
                onChange={e=>setForm(f=>({...f, minimum_fare: e.target.value}))} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Waiting Charge / min (₹)</label>
              <input 
                className="form-control" 
                type="number" 
                step="0.5"
                value={form.waiting_charge} 
                onChange={e=>setForm(f=>({...f, waiting_charge: e.target.value}))} 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select 
                className="form-control" 
                value={form.status || 'active'} 
                onChange={e=>setForm(f=>({...f, status: e.target.value}))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const EMPTY_SURGE = { city: '', area: '', vehicle: 'All', multiplier: 1.5, start_time: '', end_time: '', days: 'Mon-Fri' };

export function SurgePricing() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_SURGE);
  const [saving, setSaving] = useState(false);
  const { data, loading, error, refetch } = useApi(surgeAPI.list, []);
  const surge = Array.isArray(data) ? data : (data?.results ?? []);

  const handleEdit = (row) => {
    setForm({
      id: row.id,
      city: row.city || '',
      area: row.area || '',
      vehicle: row.vehicle || 'All',
      multiplier: row.multiplier || 1.5,
      start_time: row.start_time || '',
      end_time: row.end_time || '',
      days: row.days || 'Mon-Fri',
    });
    setShowModal(true);
  };

  const handleAddNew = () => {
    setForm(EMPTY_SURGE);
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (form.id) {
        await surgeAPI.update(form.id, form);
      } else {
        await surgeAPI.create(form);
      }
      setShowModal(false);
      setForm(EMPTY_SURGE);
      refetch();
    } catch (err) {
      alert(err?.response?.data?.error || 'Failed to save surge rule');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    { key: 'city',        label: 'City' },
    { key: 'area',        label: 'Area' },
    { key: 'vehicle',     label: 'Vehicle' },
    { key: 'multiplier',  label: 'Multiplier', render: v => <strong style={{ color: 'var(--accent-orange)' }}>{v}x</strong> },
    { key: 'start_time',  label: 'Start' },
    { key: 'end_time',    label: 'End' },
    { key: 'days',        label: 'Days' },
    { key: 'status',      label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'actions',     label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-ghost" title="Edit Surge" onClick={() => handleEdit(row)}>
          <Edit size={13} />
        </button>
        <button
          className={`btn btn-sm ${row.status === 'active' ? 'btn-warning' : 'btn-success'}`}
          onClick={async () => {
            if (row.status === 'active') {
              await surgeAPI.deactivate(row.id);
            } else {
              await surgeAPI.activate(row.id);
            }
            refetch();
          }}
        >
          {row.status === 'active' ? 'Deactivate' : 'Activate'}
        </button>
        <button 
          className="btn btn-sm btn-danger" 
          title="Delete Surge"
          onClick={async () => {
            if (window.confirm('Delete this surge rule?')) {
              await surgeAPI.delete(row.id);
              refetch();
            }
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Surge Pricing" subtitle="Configure dynamic surge multipliers" breadcrumb={['Pricing', 'Surge']}>
        <button className="btn btn-primary" onClick={handleAddNew}><Zap size={15} /> Add Surge</button>
      </PageHeader>
      <DataTable title="Surge Rules" columns={columns} data={surge} searchKeys={['city', 'area']} />
      {showModal && (
        <Modal 
          title={form.id ? `Manage Surge Rule: ${form.area || form.city}` : "Add Surge Rule"} 
          onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : (form.id ? 'Update Surge' : 'Save Surge')}
            </button>
          </>}
        >
          <div className="form-row">
            <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={e=>setForm(f=>({...f,city:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Area</label><input className="form-control" value={form.area} onChange={e=>setForm(f=>({...f,area:e.target.value}))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Vehicle</label>
              <select className="form-control" value={form.vehicle} onChange={e=>setForm(f=>({...f,vehicle:e.target.value}))}>
                <option>All</option>{VEHICLE_TYPES.map(v=><option key={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Multiplier</label><input className="form-control" type="number" step="0.1" value={form.multiplier} onChange={e=>setForm(f=>({...f,multiplier:e.target.value}))} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Start Time</label><input className="form-control" type="time" value={form.start_time} onChange={e=>setForm(f=>({...f,start_time:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">End Time</label><input className="form-control" type="time" value={form.end_time} onChange={e=>setForm(f=>({...f,end_time:e.target.value}))} /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function CancellationCharges() {
  const { data, loading, error, refetch } = useApi(
    () => import('../../api/client').then(m => m.settingsAPI.get('cancellation_charges')), []
  );
  const charges = Array.isArray(data) ? data : (data?.charges ?? []);

  if (loading) return <LoadingState />;

  const COLS = [
    { key: 'vehicle',           label: 'Vehicle',               render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'before_accept',     label: 'Before Accept',         render: v => `₹${v ?? 0}` },
    { key: 'after_accept_5min', label: 'After Accept (>5min)',  render: v => <strong>₹{v ?? 0}</strong> },
    { key: 'after_pickup',      label: 'After Pickup',          render: v => <strong style={{ color: 'var(--accent-pink)' }}>₹{v ?? 0}</strong> },
    { key: 'actions',           label: '',                      render: () => <button className="btn btn-sm btn-ghost"><Edit size={13} /></button> },
  ];

  return (
    <div>
      <PageHeader title="Cancellation Charges" subtitle="Configure cancellation fee structure" breadcrumb={['Pricing', 'Cancellation']} />
      {charges.length === 0 && !loading ? (
        <div className="card"><div className="empty-state"><p>No cancellation charges configured yet.</p></div></div>
      ) : (
        <DataTable title="Cancellation Fees" columns={COLS} data={charges} />
      )}
    </div>
  );
}
