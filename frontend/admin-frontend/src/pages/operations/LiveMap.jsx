import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { LoadingState, ErrorState } from '../../hooks/useApi';
import { liveAPI } from '../../api/client';

// Fix default marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const createIcon = (color, emoji) =>
  L.divIcon({
    className: '',
    html: `<div style="width:32px;height:32px;background:${color};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.4);border:2px solid rgba(255,255,255,0.3)">${emoji}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

const icons = {
  online:    createIcon('#6BCB77', '🟢'),
  on_ride:   createIcon('#6C63FF', '🔵'),
  arriving:  createIcon('#FFD93D', '🟡'),
  emergency: createIcon('#FF4B8B', '🔴'),
  offline:   createIcon('#4A5568', '⚪'),
};

const LEGEND = [
  { key: 'online',    emoji: '🟢', label: 'Online',    color: '#6BCB77' },
  { key: 'on_ride',   emoji: '🔵', label: 'On Ride',   color: '#6C63FF' },
  { key: 'arriving',  emoji: '🟡', label: 'Arriving',  color: '#FFD93D' },
  { key: 'emergency', emoji: '🔴', label: 'Emergency', color: '#FF4B8B' },
  { key: 'offline',   emoji: '⚪', label: 'Offline',   color: '#4A5568' },
];

const REFRESH_MS = 10000; // poll every 10 s (replace with WebSocket later)

export default function LiveMap() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await liveAPI.drivers();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      setDrivers(list);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to load live driver data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling
  useEffect(() => {
    fetchDrivers();
    const interval = setInterval(fetchDrivers, REFRESH_MS);
    return () => clearInterval(interval);
  }, [fetchDrivers]);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={fetchDrivers} />;

  const statusCounts = LEGEND.reduce((acc, l) => {
    acc[l.key] = drivers.filter(d => d.status === l.key || d.online_status === l.key).length;
    return acc;
  }, {});

  const visible = filter === 'all'
    ? drivers
    : drivers.filter(d => d.status === filter || d.online_status === filter);

  // Derive map centre from first driver, fallback to Delhi
  const centre = drivers[0]
    ? [Number(drivers[0].lat ?? drivers[0].latitude ?? 28.6139), Number(drivers[0].lng ?? drivers[0].longitude ?? 77.209)]
    : [28.6139, 77.209];

  return (
    <div>
      <PageHeader title="Live Map" subtitle="Real-time driver locations" breadcrumb={['Operations', 'Live Map']}>
        <div className="live-indicator"><span className="live-dot" />LIVE</div>
        {lastUpdate && (
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Updated {lastUpdate.toLocaleTimeString()}
          </span>
        )}
      </PageHeader>

      {/* Status summary */}
      <div className="grid-stat mb-24" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        {LEGEND.map((l) => (
          <div
            key={l.key}
            className="stat-card"
            style={{ cursor: 'pointer', border: filter === l.key ? `1px solid ${l.color}` : undefined }}
            onClick={() => setFilter(filter === l.key ? 'all' : l.key)}
          >
            <div style={{ fontSize: 22, marginBottom: 6 }}>{l.emoji}</div>
            <div className="stat-card-value" style={{ fontSize: 22, color: l.color }}>{statusCounts[l.key] ?? 0}</div>
            <div className="stat-card-label">{l.label}</div>
          </div>
        ))}
      </div>

      {/* Map */}
      <div style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-light)', height: 500 }}>
        <MapContainer center={centre} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer
            attribution=""
            url="/api/v1/services/tiles/{z}/{x}/{y}.png"
          />
          {visible.map((d) => {
            const lat = Number(d.lat ?? d.latitude);
            const lng = Number(d.lng ?? d.longitude);
            if (isNaN(lat) || isNaN(lng)) return null;
            const status = d.online_status ?? d.status ?? 'offline';
            return (
              <Marker key={d.id} position={[lat, lng]} icon={icons[status] || icons.offline}>
                <Popup>
                  <strong>{d.name || d.full_name}</strong><br />
                  <span style={{ fontSize: 12, color: '#666' }}>{d.vehicle_type} · {status}</span><br />
                  <span style={{ fontSize: 11, color: '#999' }}>Driver #{d.id}</span>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="map-legend" style={{ marginTop: 16 }}>
        {LEGEND.map((l) => (
          <div key={l.key} className="map-legend-item">
            <div className="map-dot" style={{ background: l.color }} />
            {l.emoji} {l.label} ({statusCounts[l.key] ?? 0})
          </div>
        ))}
      </div>

      {/* Driver list */}
      <div className="table-container" style={{ marginTop: 24 }}>
        <div className="table-header"><h3>Drivers on Map ({visible.length})</h3></div>
        <table>
          <thead>
            <tr><th>Driver</th><th>Vehicle</th><th>Status</th><th>Coordinates</th></tr>
          </thead>
          <tbody>
            {visible.map((d) => {
              const lat = d.lat ?? d.latitude;
              const lng = d.lng ?? d.longitude;
              return (
                <tr key={d.id}>
                  <td><strong>#{d.id} {d.name || d.full_name}</strong></td>
                  <td>{d.vehicle_type}</td>
                  <td><StatusBadge status={d.online_status ?? d.status} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {lat != null ? Number(lat).toFixed(4) : '—'}, {lng != null ? Number(lng).toFixed(4) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
