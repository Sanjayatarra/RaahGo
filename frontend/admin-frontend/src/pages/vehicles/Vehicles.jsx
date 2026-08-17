import { useState } from 'react';
import { CheckCircle, Eye, Trash2, Plus } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { vehiclesAPI } from '../../api/client';
import { XCircle, Edit } from 'lucide-react';

export function VehicleList() {
  const { data, loading, error, refetch } = useApi(vehiclesAPI.list, []);
  const vehicles = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const COLS = [
    { key: 'registration_number', label: 'Plate No.', render: v => <strong style={{ fontFamily: 'monospace' }}>{v}</strong> },
    { key: 'vehicle_type',        label: 'Type',   render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'owner_name',          label: 'Owner' },
    { key: 'year',                label: 'Year' },
    { key: 'color',               label: 'Color' },
    { key: 'city',                label: 'City' },
    { key: 'insurance_status',    label: 'Insurance', render: v => <StatusBadge status={v === 'valid' ? 'active' : 'suspended'} /> },
    { key: 'fitness_status',      label: 'Fitness',   render: v => <StatusBadge status={v === 'valid' ? 'active' : 'suspended'} /> },
    { key: 'status',              label: 'Status',    render: v => <StatusBadge status={v} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-ghost"><Eye size={13} /></button>
        {row.status === 'pending' && <>
          <button className="btn btn-sm btn-success" onClick={() => vehiclesAPI.approve(row.id).then(refetch)}><CheckCircle size={13} /></button>
          <button className="btn btn-sm btn-danger"  onClick={() => vehiclesAPI.reject(row.id, { reason: 'Invalid documents' }).then(refetch)}><XCircle size={13} /></button>
        </>}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Vehicles" subtitle="All registered vehicles" breadcrumb={['Vehicles', 'List']} />
      <DataTable
        title="Vehicles"
        columns={COLS}
        data={vehicles}
        searchKeys={['registration_number', 'owner_name', 'city']}
        filters={[
          { key: 'status',       label: 'Status', options: [
            { value: 'approved', label: 'Approved' },
            { value: 'pending',  label: 'Pending'  },
            { value: 'rejected', label: 'Rejected' },
          ]},
          { key: 'vehicle_type', label: 'Type', options: [
            'Bike','Auto','E-Rickshaw','Car','Taxi','Parcel','Mini Truck','Tempo'
          ].map(v => ({ value: v, label: v })) },
        ]}
      />
    </div>
  );
}

export function VehicleTypes() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', icon: '', base_fare: '', per_km: '', min_fare: '', commission: '' });

  const { data, loading, error, refetch } = useApi(vehiclesAPI.types, []);
  const types = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const handleSave = async () => {
    await vehiclesAPI.createType(form);
    setShowModal(false);
    refetch();
  };

  const handleDelete = async (id) => {
    if (window.confirm('Delete this vehicle type?')) {
      await vehiclesAPI.deleteType(id);
      refetch();
    }
  };

  return (
    <div>
      <PageHeader title="Vehicle Types" subtitle="Manage vehicle categories" breadcrumb={['Vehicles', 'Types']}>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Add Type
        </button>
      </PageHeader>

      <div className="grid-4">
        {types.map((t) => (
          <div key={t.id} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>{t.icon}</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>{t.name}</h3>
            <StatusBadge status={t.status} />
            <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'left' }}>
              <div className="detail-item"><div className="detail-label">Base Fare</div><div className="detail-value">₹{t.base_fare}</div></div>
              <div className="detail-item"><div className="detail-label">Per KM</div><div className="detail-value">₹{t.per_km}</div></div>
              <div className="detail-item"><div className="detail-label">Min Fare</div><div className="detail-value">₹{t.minimum_fare ?? t.min_fare}</div></div>
              <div className="detail-item"><div className="detail-label">Commission</div><div className="detail-value">{t.commission}%</div></div>
            </div>
            {t.vehicle_count != null && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>{t.vehicle_count} vehicles</div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}><Edit size={13} /> Edit</button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title="Add Vehicle Type" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSave}>Save</button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Name</label>
              <input className="form-control" placeholder="e.g. Car" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Icon (emoji)</label>
              <input className="form-control" placeholder="🚗" value={form.icon} onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Base Fare (₹)</label><input className="form-control" type="number" value={form.base_fare} onChange={e => setForm(f=>({...f,base_fare:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Per KM (₹)</label><input className="form-control" type="number" value={form.per_km} onChange={e => setForm(f=>({...f,per_km:e.target.value}))} /></div>
            <div className="form-group"><label className="form-label">Min Fare (₹)</label><input className="form-control" type="number" value={form.min_fare} onChange={e => setForm(f=>({...f,min_fare:e.target.value}))} /></div>
          </div>
          <div className="form-group"><label className="form-label">Commission (%)</label><input className="form-control" type="number" value={form.commission} onChange={e => setForm(f=>({...f,commission:e.target.value}))} /></div>
        </Modal>
      )}
    </div>
  );
}
