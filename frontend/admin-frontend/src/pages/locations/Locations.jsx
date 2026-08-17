import { useState } from 'react';
import { Plus, Edit, Trash2, MapPin } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { locationsAPI } from '../../api/client';

export default function Locations() {
  const [tab, setTab] = useState('cities');
  const [showModal, setShowModal] = useState(false);
  const [cityForm, setCityForm] = useState({ name: '', state: '' });
  const [zoneForm, setZoneForm] = useState({ name: '', city: 'Delhi', type: 'service' });
  const [submitting, setSubmitting] = useState(false);

  const { data: citiesData, loading: loadingCities, error: errorCities, refetch: refetchCities } = useApi(locationsAPI.cities);
  const { data: zonesData, loading: loadingZones, error: errorZones, refetch: refetchZones } = useApi(locationsAPI.zones);

  const cities = Array.isArray(citiesData) ? citiesData : (citiesData?.results || []);
  const zones = Array.isArray(zonesData) ? zonesData : (zonesData?.results || []);

  const handleCreateCity = async () => {
    if (!cityForm.name) return;
    setSubmitting(true);
    try {
      await locationsAPI.createCity(cityForm);
      setShowModal(false);
      setCityForm({ name: '', state: '' });
      refetchCities();
    } catch {
      alert('Failed to add city');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateZone = async () => {
    if (!zoneForm.name) return;
    setSubmitting(true);
    try {
      await locationsAPI.createZone(zoneForm);
      setShowModal(false);
      setZoneForm({ name: '', city: 'Delhi', type: 'service' });
      refetchZones();
    } catch {
      alert('Failed to add zone');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCity = async (id) => {
    if (confirm('Delete this city?')) {
      try {
        await locationsAPI.deleteCity(id);
        refetchCities();
      } catch {
        alert('Failed to delete city');
      }
    }
  };

  const handleDeleteZone = async (id) => {
    if (confirm('Delete this zone?')) {
      try {
        await locationsAPI.deleteZone(id);
        refetchZones();
      } catch {
        alert('Failed to delete zone');
      }
    }
  };

  const CITY_COLS = [
    { key: 'name', label: 'City', render: v => <strong>{v}</strong> },
    { key: 'state', label: 'State' },
    { key: 'drivers', label: 'Drivers', render: v => <strong>{v}</strong> },
    { key: 'customers', label: 'Customers', render: v => (Number(v) || 0).toLocaleString() },
    { key: 'zones', label: 'Zones' },
    { key: 'launched', label: 'Launched', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteCity(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  const ZONE_COLS = [
    { key: 'name', label: 'Zone', render: v => <strong>{v}</strong> },
    { key: 'city', label: 'City', render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'type', label: 'Type', render: v => <span className="badge badge-primary">{(v || '').replace('_',' ')}</span> },
    { key: 'drivers', label: 'Drivers' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-danger" onClick={() => handleDeleteZone(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  if (loadingCities || loadingZones) return <LoadingState text="Loading locations & zones..." />;
  if (errorCities || errorZones) return <ErrorState message={errorCities || errorZones} onRetry={() => { refetchCities(); refetchZones(); }} />;

  return (
    <div>
      <PageHeader title="Cities & Zones" subtitle="Manage service areas and operational zones" breadcrumb={['Locations']}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> {tab === 'cities' ? 'Add City' : 'Add Zone'}
        </button>
      </PageHeader>

      <div className="tabs">
        <button className={`tab${tab==='cities'?' active':''}`} onClick={() => setTab('cities')}>🏙️ Cities ({cities.length})</button>
        <button className={`tab${tab==='zones'?' active':''}`} onClick={() => setTab('zones')}>🗺️ Zones ({zones.length})</button>
      </div>

      {tab === 'cities' && (
        <>
          <div className="grid-4 mb-24">
            {cities.filter(c => c.status === 'active').map(c => (
              <div key={c.id} className="stat-card" style={{ cursor: 'pointer' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <MapPin size={18} color="var(--accent-primary)" />
                  <StatusBadge status={c.status} />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{c.name}</h3>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{c.state}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span>{c.drivers} drivers</span>
                  <span>{(Number(c.customers) || 0).toLocaleString()} users</span>
                </div>
              </div>
            ))}
          </div>
          <DataTable title="All Cities" columns={CITY_COLS} data={cities} searchKeys={['name','state']} />
        </>
      )}

      {tab === 'zones' && (
        <DataTable
          title="All Zones"
          columns={ZONE_COLS}
          data={zones}
          searchKeys={['name','city']}
          filters={[
            { key: 'city', label: 'City', options: cities.map(c=>({value:c.name,label:c.name})) },
            { key: 'type', label: 'Type', options: [{value:'service',label:'Service'},{value:'pickup_drop',label:'Pickup/Drop'},{value:'restricted',label:'Restricted'}] },
          ]}
        />
      )}

      {showModal && (
        <Modal title={tab === 'cities' ? 'Add City' : 'Add Zone'} onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={tab === 'cities' ? handleCreateCity : handleCreateZone} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </>}
        >
          {tab === 'cities' ? (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">City Name</label>
                  <input className="form-control" value={cityForm.name} onChange={e => setCityForm({...cityForm, name: e.target.value})} placeholder="e.g. Gurugram" />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input className="form-control" value={cityForm.state} onChange={e => setCityForm({...cityForm, state: e.target.value})} placeholder="e.g. Haryana" />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Zone Name</label>
                  <input className="form-control" value={zoneForm.name} onChange={e => setZoneForm({...zoneForm, name: e.target.value})} placeholder="e.g. Cyber City" />
                </div>
                <div className="form-group">
                  <label className="form-label">City</label>
                  <select className="form-control" value={zoneForm.city} onChange={e => setZoneForm({...zoneForm, city: e.target.value})}>
                    {cities.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Zone Type</label>
                <select className="form-control" value={zoneForm.type} onChange={e => setZoneForm({...zoneForm, type: e.target.value})}>
                  <option value="service">Service Area</option>
                  <option value="pickup_drop">Pickup/Drop Zone</option>
                  <option value="restricted">Restricted Area</option>
                </select>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}
