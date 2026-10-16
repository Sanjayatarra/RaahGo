import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { LoadingState, ErrorState } from '../../hooks/useApi';
import { ridesAPI } from '../../api/client';
import { RefreshCw, Download, Eye, X, Phone, User, Car, CheckCircle, Ban } from 'lucide-react';

/**
 * Custom Real-time Data Hook with Polling, Pause/Resume, and Last Update tracking.
 */
function useRealtimeRides(fetchFn, intervalMs = 4000) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [newCount, setNewCount] = useState(0);
  const prevIdsRef = useRef(new Set());

  const fetchRides = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetchFn();
      const list = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
      
      // Track newly added rides for visual pulse
      if (prevIdsRef.current.size > 0) {
        const fresh = list.filter(r => !prevIdsRef.current.has(r.id || r.ride_id));
        if (fresh.length > 0) {
          setNewCount(fresh.length);
          setTimeout(() => setNewCount(0), 4000);
        }
      }
      prevIdsRef.current = new Set(list.map(r => r.id || r.ride_id));

      setData(list);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to fetch realtime rides');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchFn]);

  // Initial load
  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  // Realtime Polling Timer
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => {
      fetchRides();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [fetchRides, autoRefresh, intervalMs]);

  return {
    rides: data,
    loading,
    isRefreshing,
    error,
    lastUpdate,
    autoRefresh,
    setAutoRefresh,
    newCount,
    refetch: () => fetchRides(true)
  };
}

/**
 * Dynamic Filter Generator: Derives ALL filter options directly from actual data records.
 * Zero hardcoded lists!
 */
function useDynamicFilters(rides) {
  return useMemo(() => {
    if (!rides || !rides.length) return [];

    const statuses = new Set();
    const vehicleTypes = new Set();
    const paymentMethods = new Set();

    rides.forEach((r) => {
      if (r.status) statuses.add(String(r.status).trim());
      if (r.vehicle_type && r.vehicle_type !== '—') vehicleTypes.add(String(r.vehicle_type).trim());
      if (r.payment_method) paymentMethods.add(String(r.payment_method).trim());
    });

    const filters = [];

    if (statuses.size > 0) {
      filters.push({
        key: 'status',
        label: 'Status',
        options: Array.from(statuses).sort().map((s) => ({
          value: s,
          label: s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ')
        }))
      });
    }

    if (vehicleTypes.size > 0) {
      filters.push({
        key: 'vehicle_type',
        label: 'Vehicle',
        options: Array.from(vehicleTypes).sort().map((v) => ({
          value: v,
          label: v
        }))
      });
    }

    if (paymentMethods.size > 0) {
      filters.push({
        key: 'payment_method',
        label: 'Payment',
        options: Array.from(paymentMethods).sort().map((p) => ({
          value: p,
          label: p
        }))
      });
    }

    return filters;
  }, [rides]);
}

/**
 * Export filtered rides data to CSV
 */
function exportRidesCsv(rides, filename = 'RaahGo-Rides.csv') {
  if (!rides || !rides.length) {
    alert('No rides data to export.');
    return;
  }

  const headers = ['Ride ID', 'Customer', 'Customer Phone', 'Driver', 'Driver Phone', 'From', 'To', 'Vehicle', 'Fare', 'Distance (km)', 'Payment Method', 'Payment Status', 'Status', 'Created At'];
  const rows = rides.map(r => [
    `"${r.ride_id || r.id || ''}"`,
    `"${(r.customer_name || r.customer || '').replace(/"/g, '""')}"`,
    `"${r.customer_phone || ''}"`,
    `"${(r.driver_name || r.driver || r.captain_name || '').replace(/"/g, '""')}"`,
    `"${r.driver_phone || ''}"`,
    `"${(r.pickup_address || '').replace(/"/g, '""')}"`,
    `"${(r.drop_address || r.dropoff_address || '').replace(/"/g, '""')}"`,
    `"${r.vehicle_type || ''}"`,
    r.fare || 0,
    r.distance || 0,
    `"${r.payment_method || ''}"`,
    `"${r.payment_status || ''}"`,
    `"${r.status || ''}"`,
    `"${r.created_at || ''}"`
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Ride Detail Modal
 */
function RideDetailModal({ ride, onClose, onRefresh }) {
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  if (!ride) return null;

  const handleCancelRide = async () => {
    if (!window.confirm(`Are you sure you want to cancel Ride ${ride.ride_id}?`)) return;
    setActionLoading(true);
    try {
      await ridesAPI.cancel(ride.id, { reason: 'Admin Cancelled' });
      setActionMsg('Ride successfully cancelled.');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || 'Failed to cancel ride');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCompleteRide = async () => {
    if (!window.confirm(`Mark Ride ${ride.ride_id} as completed?`)) return;
    setActionLoading(true);
    try {
      await ridesAPI.complete(ride.id);
      setActionMsg('Ride successfully marked as completed.');
      if (onRefresh) onRefresh();
    } catch (err) {
      alert(err?.response?.data?.error || err?.message || 'Failed to complete ride');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: 16
    }}>
      <div style={{
        background: 'var(--bg-card, #111827)',
        border: '1px solid var(--border-color, rgba(108, 99, 255, 0.2))',
        borderRadius: 16,
        maxWidth: 580,
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        padding: 24,
        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        color: 'var(--text-primary, #F0F4FF)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>🚕</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Ride Details</h3>
              <span style={{ color: 'var(--accent-primary, #6C63FF)', fontSize: 13, fontWeight: 700 }}>
                {ride.ride_id}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: 'none',
              borderRadius: '50%',
              width: 32,
              height: 32,
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={16} />
          </button>
        </div>

        {actionMsg && (
          <div style={{
            background: 'rgba(107, 203, 119, 0.15)',
            border: '1px solid rgba(107, 203, 119, 0.3)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 12,
            color: '#6BCB77',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            <CheckCircle size={14} />
            <span>{actionMsg}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-input, #1a2235)', padding: 12, borderRadius: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Status</span>
            <div style={{ marginTop: 4 }}>
              <StatusBadge status={ride.status} />
            </div>
          </div>

          <div style={{ background: 'var(--bg-input, #1a2235)', padding: 12, borderRadius: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Ride PIN</span>
            <div style={{ fontSize: 14, fontWeight: 800, marginTop: 4, letterSpacing: 2 }}>
              {ride.ride_pin || '—'}
            </div>
          </div>
        </div>

        {/* Route Details */}
        <div style={{ background: 'var(--bg-input, #1a2235)', padding: 14, borderRadius: 12, marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Route Details</span>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#6BCB77', marginTop: 2 }}>🟢</span>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Pickup (From)</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{ride.pickup_address || '—'}</p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ color: '#FF4B8B', marginTop: 2 }}>🔴</span>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Dropoff (To)</span>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{ride.drop_address || ride.dropoff_address || '—'}</p>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 12 }}>
            <span><strong>Distance:</strong> {ride.distance} km</span>
            <span><strong>Vehicle:</strong> {ride.vehicle_type}</span>
          </div>
        </div>

        {/* People */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {/* Customer */}
          <div style={{ background: 'var(--bg-input, #1a2235)', padding: 12, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <User size={12} color="var(--accent-secondary)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Passenger</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{ride.customer_name || ride.customer || '—'}</p>
            {ride.customer_phone && ride.customer_phone !== '—' && (
              <a href={`tel:${ride.customer_phone}`} style={{ fontSize: 12, color: 'var(--accent-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Phone size={11} /> {ride.customer_phone}
              </a>
            )}
          </div>

          {/* Driver */}
          <div style={{ background: 'var(--bg-input, #1a2235)', padding: 12, borderRadius: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <Car size={12} color="var(--accent-primary)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Captain / Driver</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700 }}>{ride.driver_name || ride.driver || ride.captain_name || 'Unassigned'}</p>
            {ride.driver_phone && ride.driver_phone !== '—' && (
              <a href={`tel:${ride.driver_phone}`} style={{ fontSize: 12, color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <Phone size={11} /> {ride.driver_phone}
              </a>
            )}
          </div>
        </div>

        {/* Financial */}
        <div style={{ background: 'var(--bg-input, #1a2235)', padding: 12, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Payment</span>
              <p style={{ margin: '2px 0 0', fontSize: 12, fontWeight: 600 }}>{ride.payment_method || 'COD'} ({ride.payment_status || 'Pending'})</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total Fare</span>
              <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 900, color: '#6BCB77' }}>₹{ride.fare || 0}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          {['searching', 'accepted', 'arrived'].includes(String(ride.status).toLowerCase()) && (
            <button
              onClick={handleCancelRide}
              disabled={actionLoading}
              className="btn btn-danger btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Ban size={14} /> Cancel Ride
            </button>
          )}

          {['in trip', 'in_trip'].includes(String(ride.status).toLowerCase()) && (
            <button
              onClick={handleCompleteRide}
              disabled={actionLoading}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle size={14} /> Complete Ride
            </button>
          )}

          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Common Columns definition with eye icon action for row detail inspection
 */
function createColumns(onViewRide) {
  return [
    {
      key: 'ride_id',
      label: 'Ride ID',
      render: (v, row) => (
        <span
          onClick={() => onViewRide && onViewRide(row)}
          style={{ color: 'var(--accent-primary)', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}
          title="Click to view full ride details"
        >
          {v || `#RD${String(row.id || '').slice(0, 6).toUpperCase()}`}
        </span>
      )
    },
    {
      key: 'customer',
      label: 'Customer',
      render: (v, row) => (
        <div>
          <strong style={{ fontSize: 12 }}>{v || row.customer_name || '—'}</strong>
          {row.customer_phone && row.customer_phone !== '—' && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.customer_phone}</div>
          )}
        </div>
      )
    },
    {
      key: 'driver',
      label: 'Driver',
      render: (v, row) => {
        const dName = v || row.driver_name || row.captain_name;
        if (!dName || dName === '—') {
          return <span style={{ color: 'var(--accent-orange, #FF6B35)', fontSize: 11, fontWeight: 700 }}>Looking for Driver...</span>;
        }
        return (
          <div>
            <span style={{ fontSize: 12, fontWeight: 600 }}>{dName}</span>
            {row.driver_phone && row.driver_phone !== '—' && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.driver_phone}</div>
            )}
          </div>
        );
      }
    },
    {
      key: 'pickup_address',
      label: 'From',
      render: (v) => <span style={{ fontSize: 12, maxWidth: 170, display: 'inline-block' }} className="truncate" title={v}>{v || '—'}</span>
    },
    {
      key: 'drop_address',
      label: 'To',
      render: (v, row) => {
        const drop = v || row.dropoff_address || '—';
        return <span style={{ fontSize: 12, maxWidth: 170, display: 'inline-block' }} className="truncate" title={drop}>{drop}</span>;
      }
    },
    {
      key: 'vehicle_type',
      label: 'Vehicle',
      render: (v) => v ? <span className="badge badge-primary">{v}</span> : '—'
    },
    {
      key: 'fare',
      label: 'Fare',
      render: (v) => <strong>{v !== undefined && v !== null ? `₹${v}` : '—'}</strong>
    },
    {
      key: 'distance',
      label: 'Distance',
      render: (v) => v ? `${v} km` : '—'
    },
    {
      key: 'payment_method',
      label: 'Payment',
      render: (v, row) => (
        <span style={{ fontSize: 11 }}>
          {v || 'COD'}
          {row.payment_status && (
            <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>({row.payment_status})</span>
          )}
        </span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (v) => <StatusBadge status={v} />
    },
    {
      key: 'created_at',
      label: 'Time',
      render: (v) => <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{v}</span>
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <button
          onClick={() => onViewRide && onViewRide(row)}
          className="btn btn-secondary btn-sm"
          style={{ padding: '4px 8px', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 4 }}
          title="Inspect live ride"
        >
          <Eye size={12} /> View
        </button>
      )
    }
  ];
}

/**
 * 1. ALL RIDES (Real-time syncing with dynamic non-hardcoded filters)
 */
export function AllRides() {
  const { rides, loading, isRefreshing, error, lastUpdate, autoRefresh, setAutoRefresh, newCount, refetch } = useRealtimeRides(ridesAPI.list, 6000);
  const [selectedRide, setSelectedRide] = useState(null);
  const dynamicFilters = useDynamicFilters(rides);
  const columns = useMemo(() => createColumns(setSelectedRide), []);

  if (loading && !rides.length) return <LoadingState />;
  if (error && !rides.length) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="All Rides" subtitle="Real-time ride management & tracking" breadcrumb={['Operations', 'All Rides']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Live Indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid var(--border-color)',
            borderRadius: 20,
            padding: '4px 12px',
            fontSize: 11
          }}>
            <span style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: autoRefresh ? '#6BCB77' : '#8B9EC2',
              boxShadow: autoRefresh ? '0 0 8px rgba(107, 203, 119, 0.8)' : 'none'
            }} />
            <span style={{ fontWeight: 700, color: autoRefresh ? '#6BCB77' : 'var(--text-muted)' }}>
              {autoRefresh ? 'REALTIME ON' : 'PAUSED'}
            </span>
            {lastUpdate && (
              <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>
                · {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>

          {/* Toggle Auto Refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11 }}
            title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
          >
            {autoRefresh ? 'Pause Sync' : 'Resume Sync'}
          </button>

          {/* Manual Refresh Button */}
          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Refresh now"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Real CSV Export */}
          <button
            onClick={() => exportRidesCsv(rides, 'RaahGo-All-Rides')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </PageHeader>

      {newCount > 0 && (
        <div style={{
          background: 'rgba(108, 99, 255, 0.15)',
          border: '1px solid rgba(108, 99, 255, 0.3)',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 12,
          fontSize: 12,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span>🔔</span>
          <strong>{newCount} new ride(s) synchronized live from backend.</strong>
        </div>
      )}

      <DataTable
        title="All Rides"
        columns={columns}
        data={rides}
        searchKeys={['customer', 'driver', 'ride_id', 'customer_name', 'driver_name', 'pickup_address', 'drop_address', 'dropoff_address']}
        filters={dynamicFilters}
        onRowClick={(row) => setSelectedRide(row)}
      />

      <RideDetailModal
        ride={selectedRide}
        onClose={() => setSelectedRide(null)}
        onRefresh={refetch}
      />
    </div>
  );
}

/**
 * 2. LIVE RIDES (Active rides polling every 3 seconds with dynamic filters)
 */
export function LiveRides() {
  const { rides, loading, isRefreshing, error, lastUpdate, autoRefresh, setAutoRefresh, newCount, refetch } = useRealtimeRides(ridesAPI.live, 3000);
  const [selectedRide, setSelectedRide] = useState(null);
  const dynamicFilters = useDynamicFilters(rides);
  const columns = useMemo(() => createColumns(setSelectedRide), []);

  if (loading && !rides.length) return <LoadingState />;
  if (error && !rides.length) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Live Rides" subtitle="Currently active in-trip and requested rides" breadcrumb={['Operations', 'Live Rides']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Pulsing Live Badge */}
          <div className="live-indicator" style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800 }}>
            <span className="live-dot" />
            <span>LIVE ({rides.length})</span>
          </div>

          {lastUpdate && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Sync: {lastUpdate.toLocaleTimeString()}
            </span>
          )}

          {/* Toggle Auto Refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11 }}
          >
            {autoRefresh ? 'Pause Live' : 'Resume Live'}
          </button>

          {/* Manual Refresh */}
          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            title="Refresh active rides"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          {/* Export CSV */}
          <button
            onClick={() => exportRidesCsv(rides, 'RaahGo-Live-Rides')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </PageHeader>

      {newCount > 0 && (
        <div style={{
          background: 'rgba(107, 203, 119, 0.15)',
          border: '1px solid rgba(107, 203, 119, 0.3)',
          borderRadius: 8,
          padding: '8px 14px',
          marginBottom: 12,
          fontSize: 12,
          color: '#6BCB77',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span>⚡</span>
          <strong>Live Alert: {newCount} active ride update(s) detected.</strong>
        </div>
      )}

      <DataTable
        title={`Active Rides (${rides.length})`}
        columns={columns}
        data={rides}
        searchKeys={['customer', 'driver', 'ride_id', 'customer_name', 'driver_name', 'pickup_address', 'drop_address', 'dropoff_address']}
        filters={dynamicFilters}
        onRowClick={(row) => setSelectedRide(row)}
        emptyMessage="No active live rides right now. Rides will appear automatically as customers book."
      />

      <RideDetailModal
        ride={selectedRide}
        onClose={() => setSelectedRide(null)}
        onRefresh={refetch}
      />
    </div>
  );
}

/**
 * 3. SCHEDULED RIDES (Polling every 5 seconds with dynamic filters)
 */
export function ScheduledRides() {
  const { rides, loading, isRefreshing, error, lastUpdate, autoRefresh, setAutoRefresh, refetch } = useRealtimeRides(ridesAPI.scheduled, 5000);
  const [selectedRide, setSelectedRide] = useState(null);
  const dynamicFilters = useDynamicFilters(rides);
  const columns = useMemo(() => createColumns(setSelectedRide), []);

  if (loading && !rides.length) return <LoadingState />;
  if (error && !rides.length) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Scheduled & Pending Rides" subtitle="Upcoming rides and waiting bookings" breadcrumb={['Operations', 'Scheduled Rides']}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {lastUpdate && (
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: 11 }}
          >
            {autoRefresh ? 'Pause' : 'Resume'}
          </button>

          <button
            onClick={refetch}
            disabled={isRefreshing}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => exportRidesCsv(rides, 'RaahGo-Scheduled-Rides')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={13} />
            <span>Export</span>
          </button>
        </div>
      </PageHeader>

      <DataTable
        title={`Scheduled & Pending (${rides.length})`}
        columns={columns}
        data={rides}
        searchKeys={['customer', 'driver', 'ride_id', 'customer_name', 'driver_name', 'pickup_address', 'drop_address', 'dropoff_address']}
        filters={dynamicFilters}
        onRowClick={(row) => setSelectedRide(row)}
        emptyMessage="No scheduled or pending rides waiting."
      />

      <RideDetailModal
        ride={selectedRide}
        onClose={() => setSelectedRide(null)}
        onRefresh={refetch}
      />
    </div>
  );
}

export default AllRides;

