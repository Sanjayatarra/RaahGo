import { useState } from 'react';
import { Plus, Edit, Trash2, Power } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';

const SERVICES = [
  { id: 1, name: 'Bike', icon: '🏍️', description: 'Fast and affordable bike rides', status: 'active', cities: 12, min_fare: 40, commission: 20 },
  { id: 2, name: 'Auto', icon: '🛺', description: 'Traditional auto-rickshaw rides', status: 'active', cities: 10, min_fare: 50, commission: 18 },
  { id: 3, name: 'Car', icon: '🚗', description: 'Comfortable car rides', status: 'active', cities: 8, min_fare: 80, commission: 22 },
  { id: 4, name: 'Taxi', icon: '🚕', description: 'Premium taxi service', status: 'active', cities: 6, min_fare: 100, commission: 22 },
  { id: 5, name: 'Parcel', icon: '📦', description: 'Package delivery service', status: 'active', cities: 9, min_fare: 60, commission: 25 },
  { id: 6, name: 'Movers', icon: '🚛', description: 'Household & office relocation', status: 'active', cities: 5, min_fare: 500, commission: 15 },
  { id: 7, name: 'E-Rickshaw', icon: '⚡', description: 'Eco-friendly electric rides', status: 'inactive', cities: 3, min_fare: 35, commission: 15 },
];

export default function Services() {
  const [services, setServices] = useState(SERVICES);
  const [showModal, setShowModal] = useState(false);

  const toggle = (id) => {
    setServices(prev => prev.map(s => s.id === id ? { ...s, status: s.status === 'active' ? 'inactive' : 'active' } : s));
  };

  return (
    <div>
      <PageHeader title="Services" subtitle="Manage RaahGo service offerings" breadcrumb={['Services']}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> Add Service
        </button>
      </PageHeader>

      <div className="grid-3">
        {services.map((s) => (
          <div key={s.id} className="card" style={{ opacity: s.status === 'inactive' ? 0.7 : 1 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: 36 }}>{s.icon}</div>
              <StatusBadge status={s.status} />
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{s.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>{s.description}</p>

            <div className="detail-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginBottom: 16 }}>
              <div className="detail-item">
                <div className="detail-label">Cities</div>
                <div className="detail-value">{s.cities}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Min Fare</div>
                <div className="detail-value">₹{s.min_fare}</div>
              </div>
              <div className="detail-item">
                <div className="detail-label">Commission</div>
                <div className="detail-value">{s.commission}%</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}><Edit size={13} /> Edit</button>
              <button
                className={`btn btn-sm ${s.status === 'active' ? 'btn-warning' : 'btn-success'}`}
                onClick={() => toggle(s.id)}
              >
                <Power size={13} /> {s.status === 'active' ? 'Disable' : 'Enable'}
              </button>
              <button className="btn btn-sm btn-danger"><Trash2 size={13} /></button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title="Add New Service" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary">Create Service</button>
          </>}
        >
          <div className="form-row">
            <div className="form-group"><label className="form-label">Service Name</label><input className="form-control" placeholder="e.g. Bike" /></div>
            <div className="form-group"><label className="form-label">Icon (emoji)</label><input className="form-control" placeholder="🚗" /></div>
          </div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-control" rows={2} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Min Fare (₹)</label><input className="form-control" type="number" /></div>
            <div className="form-group"><label className="form-label">Commission (%)</label><input className="form-control" type="number" /></div>
          </div>
        </Modal>
      )}
    </div>
  );
}
