import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import {
  Car, Users, UserCheck, DollarSign,
  AlertTriangle, CheckCircle, XCircle, Clock,
  RefreshCw, Navigation, TrendingUp, ArrowRight, ShieldAlert,
  MapPin
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { dashboardAPI } from '../../api/client';

const RIDE_STATUS_COLORS = {
  'Completed': '#10B981',
  'Cancelled': '#FF6B35',
  'Active': '#3B82F6',
  'Searching': '#FFD93D',
};

const TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  fontSize: 12,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color, fontSize: 12, display: 'flex', justifyContent: 'space-between', gap: 12, margin: '3px 0' }}>
          <span>{p.name === 'revenue' ? 'Revenue' : 'Total Rides'}:</span>
          <strong>{p.name === 'revenue' ? `₹${Number(p.value).toLocaleString()}` : `${p.value} rides`}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [period, setPeriod] = useState('today');
  const [selectedCity, setSelectedCity] = useState('All Cities');
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useApi(
    () => dashboardAPI.stats({ period, city: selectedCity }),
    [period, selectedCity]
  );
  const { data: revenue, loading: revenueLoading, refetch: refetchRevenue } = useApi(
    () => dashboardAPI.revenue({ period, city: selectedCity }),
    [period, selectedCity]
  );
  const { data: ridesData, loading: ridesLoading, refetch: refetchRides } = useApi(
    () => dashboardAPI.rides({ city: selectedCity }),
    [selectedCity]
  );
  const { data: alerts, loading: alertsLoading, refetch: refetchAlerts } = useApi(
    () => dashboardAPI.alerts({ city: selectedCity }),
    [selectedCity]
  );

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([
        refetchStats(),
        refetchRevenue(),
        refetchRides(),
        refetchAlerts(),
      ]);
      setLastUpdate(new Date());
    } finally {
      setRefreshing(false);
    }
  }, [refetchStats, refetchRevenue, refetchRides, refetchAlerts]);

  // Normalize API data shapes
  const today = stats?.today ?? {};
  const availableCities = stats?.available_cities ?? [
    { name: 'Delhi', running_trips: 0, online_drivers: 0 },
    { name: 'Gurugram', running_trips: 0, online_drivers: 0 },
    { name: 'Noida', running_trips: 0, online_drivers: 0 },
    { name: 'Ghaziabad', running_trips: 0, online_drivers: 0 },
    { name: 'Faridabad', running_trips: 0, online_drivers: 0 },
  ];
  const revenueChart = revenue?.chart ?? [];
  const rideStatusChart = ridesData?.by_status ?? [];
  const vehicleChart = ridesData?.by_vehicle ?? [];
  const recentRides = ridesData?.recent ?? [];
  const alertsList = alerts?.alerts ?? [];

  const totalRidesInStatus = rideStatusChart.reduce((acc, curr) => acc + (curr.value || 0), 0);

  if (statsLoading && !stats) return <LoadingState />;
  if (statsError) return <ErrorState message={statsError} onRetry={handleRefreshAll} />;

  const periodLabel = period === 'today' ? 'vs yesterday' : (period === 'week' ? 'vs last week' : 'vs last month');
  const cityScopeText = selectedCity === 'All Cities' ? '' : ` (${selectedCity})`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Page Header with City Selector & Manual Refresh ── */}
      <PageHeader
        title="Dashboard"
        subtitle={`Overview of RaahGo fleet, rides, and operations${selectedCity !== 'All Cities' ? ` in ${selectedCity}` : ' across all cities'}`}
        breadcrumb={['RaahGo Admin', 'Dashboard', selectedCity !== 'All Cities' ? selectedCity : 'Overview']}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          
          {/* City Selector Dropdown */}
          <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, pointerEvents: 'none', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}>
              <MapPin size={14} />
            </span>
            <select
              className="form-control"
              aria-label="Select Operational City"
              style={{
                height: 38,
                fontSize: 12,
                fontWeight: 700,
                paddingLeft: 30,
                paddingRight: 28,
                cursor: 'pointer',
                background: 'var(--bg-card)',
                borderColor: selectedCity !== 'All Cities' ? 'var(--accent-primary)' : 'var(--border-color)',
                color: selectedCity !== 'All Cities' ? 'var(--accent-primary)' : 'var(--text-primary)',
                minWidth: 160,
              }}
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
            >
              <option value="All Cities">🌐 All Cities</option>
              {availableCities.map((c) => {
                const cityName = c.name || c;
                const running = c.running_trips ? ` (${c.running_trips} running)` : '';
                return (
                  <option key={cityName} value={cityName}>
                    📍 {cityName}{running}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Time Period Filter */}
          <select
            className="form-control"
            aria-label="Select Time Period"
            style={{ height: 38, fontSize: 12, maxWidth: 120, fontWeight: 700, cursor: 'pointer' }}
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
          {/* On-Demand Refresh Button */}
          <button 
            className="btn btn-secondary btn-sm" 
            onClick={handleRefreshAll}
            disabled={refreshing}
            title="Click to refresh dashboard data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 38, fontWeight: 600, cursor: refreshing ? 'not-allowed' : 'pointer' }}
          >
            <RefreshCw size={13} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </PageHeader>

      {/* ── Metric KPI Stats Row ── */}
      <div className="grid-stat">
        {/* Total Rides */}
        <StatCard 
          label={period === 'today' ? 'Total Rides Today' : (period === 'week' ? 'Total Rides (Week)' : 'Total Rides (Month)')} 
          value={(today.rides ?? 0).toLocaleString()} 
          change={today.rides_change ?? 0} 
          changeLabel={periodLabel}
          icon={Car} 
          color="purple" 
        />

        {/* Revenue */}
        <StatCard 
          label={period === 'today' ? 'Revenue Today' : (period === 'week' ? 'Revenue (Week)' : 'Revenue (Month)')} 
          value={today.revenue != null ? (today.revenue >= 1000 ? `₹${(today.revenue / 1000).toFixed(1)}K` : `₹${Number(today.revenue).toLocaleString()}`) : '₹0'} 
          change={today.revenue_change ?? 0} 
          changeLabel={periodLabel}
          icon={DollarSign} 
          color="green" 
        />

        {/* Active Drivers */}
        <StatCard 
          label="Active Captains" 
          value={(today.online_drivers ?? 0).toLocaleString()} 
          change={today.online_drivers ?? 0} 
          changeLabel={`${today.online_drivers ?? 0} currently online`}
          icon={UserCheck} 
          color="teal" 
        />

        {/* Active Customers
        <StatCard 
          label="Registered Customers" 
          value={(today.active_customers ?? 0).toLocaleString()} 
          change={0} 
          changeLabel="Total active accounts"
          icon={Users} 
          color="orange" 
        /> */}

        {/* Completed Rides */}
        <StatCard 
          label="Completed Rides" 
          value={(today.completed_rides ?? 0).toLocaleString()} 
          change={today.completed_change ?? 0} 
          changeLabel={periodLabel}
          icon={CheckCircle} 
          color="green" 
        />

        {/* Cancelled Rides */}
        <StatCard 
          label="Cancelled Rides" 
          value={(today.cancelled_rides ?? 0).toLocaleString()} 
          change={0} 
          changeLabel="Total cancellations"
          icon={XCircle} 
          color="pink" 
        />
      </div>

      {/* ── Charts Row (Revenue & Rides Trend + Ride Status) ── */}
      <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Revenue & Rides Trend Chart */}
        <div className="chart-card">
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Revenue & Rides Trend</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Daily financial revenue and total booking volume over the last 7 days
              </p>
            </div>
            {revenueLoading && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updating…</span>}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis 
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
                axisLine={false} 
                tickLine={false} 
                width={50} 
                tickFormatter={v => (v >= 1000 ? `₹${(v / 1000).toFixed(0)}K` : `₹${v}`)} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="revenue" stroke="#6C63FF" strokeWidth={2.5} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ride Status Pie / Donut Chart */}
        <div className="chart-card">
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Ride Status Breakdown</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                All-time distribution of ride booking states
              </p>
            </div>
            {ridesLoading && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Updating…</span>}
          </div>
          {totalRidesInStatus === 0 ? (
            <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Clock size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
              <p style={{ fontSize: 12 }}>No rides recorded yet</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={170}>
                <PieChart>
                  <Pie 
                    data={rideStatusChart} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={50} 
                    outerRadius={75} 
                    paddingAngle={3} 
                    dataKey="value"
                  >
                    {rideStatusChart.map((entry, i) => (
                      <Cell key={i} fill={RIDE_STATUS_COLORS[entry.name] || '#6C63FF'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [val, 'Rides']} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="chart-legend" style={{ flexWrap: 'wrap', marginTop: 10 }}>
                {rideStatusChart.map((d) => (
                  <div key={d.name} className="legend-item" style={{ fontSize: 11 }}>
                    <div className="legend-dot" style={{ background: RIDE_STATUS_COLORS[d.name] || '#6C63FF' }} />
                    <span>{d.name}: <strong>{d.value}</strong></span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Vehicle Distribution + Live System Alerts ── */}
      <div className="grid-2">
        {/* Rides by Vehicle Type Bar Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <div>
              <h3>Rides by Vehicle Type</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Booking volume across available vehicle categories
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={vehicleChart} barSize={32} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="type" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="rides" name="Rides" radius={[5, 5, 0, 0]}>
                {vehicleChart.map((_, i) => (
                  <Cell key={i} fill={['#6C63FF', '#4ECDC4', '#FF6B35', '#FFD93D', '#10B981', '#EC4899'][i % 6]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Live System Alerts */}
        <div className="card" style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column' }}>
          <div className="chart-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700 }}>Live Operational Alerts</h3>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Real-time operational alerts requiring supervisor attention
              </p>
            </div>
            {alertsList.length > 0 && (
              <span className="badge badge-warning" style={{ fontSize: 11, fontWeight: 800 }}>
                {alertsList.length} Action{alertsList.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {alertsLoading ? (
            <LoadingState />
          ) : alertsList.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 0', textAlign: 'center', margin: 'auto 0' }}>
              <CheckCircle size={36} color="var(--status-active)" style={{ marginBottom: 8, opacity: 0.8 }} />
              <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>All Platform Systems Operational</p>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>No pending KYC reviews or active emergencies</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', maxHeight: 220 }}>
              {alertsList.map((a, i) => (
                <div 
                  key={i} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'flex-start', 
                    gap: 10, 
                    padding: '10px 12px', 
                    borderRadius: 'var(--radius-sm)',
                    background: a.type === 'warning' ? 'rgba(255, 217, 61, 0.1)' : (a.type === 'danger' ? 'rgba(255, 75, 139, 0.1)' : 'rgba(108, 99, 255, 0.1)'),
                    border: `1px solid ${a.type === 'warning' ? 'rgba(255, 217, 61, 0.25)' : (a.type === 'danger' ? 'rgba(255, 75, 139, 0.25)' : 'rgba(108, 99, 255, 0.25)')}`,
                  }}
                >
                  <AlertTriangle 
                    size={16} 
                    color={a.type === 'warning' ? '#FFD93D' : (a.type === 'danger' ? '#FF4B8B' : '#6C63FF')} 
                    style={{ flexShrink: 0, marginTop: 2 }} 
                  />
                  <div style={{ flex: 1, fontSize: 12 }}>
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.title || 'Platform Notice'}</div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 1 }}>{a.message}</p>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {a.time}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Rides Table ── */}
      <div className="table-container">
        <div className="table-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Live & Recent Rides ({recentRides.length})</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
              Most recent passenger bookings with real-time status and fares
            </p>
          </div>
          <Link to="/operations/rides" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span>View All Rides</span>
            <ArrowRight size={13} />
          </Link>
        </div>
        {ridesLoading ? (
          <LoadingState />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ride ID</th>
                <th>Customer</th>
                <th>Captain</th>
                <th>Vehicle</th>
                <th>Payment Method</th>
                <th>Fare</th>
                <th>Status</th>
                <th>Booking Time</th>
              </tr>
            </thead>
            <tbody>
              {recentRides.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                    No recent rides found in database
                  </td>
                </tr>
              ) : (
                recentRides.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ color: 'var(--accent-primary)', fontSize: 12, letterSpacing: '0.04em' }}>
                        #{r.ride_id || (r.ride_id ? String(r.ride_id).slice(0, 8).toUpperCase() : 'RIDE')}
                      </strong>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {r.customer_name || 'Passenger'}
                      </div>
                      {r.customer_phone && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.customer_phone}</span>}
                    </td>
                    <td>
                      {r.captain_name ? (
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.captain_name}</div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-primary" style={{ fontSize: 11 }}>
                        {r.vehicle_type || 'Vehicle'}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${r.payment_method}`}>
                        <span style={{ color: 'var(--text-primary)' }}>{r.payment_method === 'cash' ? 'Cash' : 'UPI'}</span>
                        {/* <span style={{ color: 'var(--text-muted)', margin: '0 4px' }}>→</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{r.drop_address || 'Drop'}</span> */}
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: '#10B981', fontSize: 12 }}>
                        {r.fare || r.final_fare || r.estimated_fare ? `₹${r.fare || r.final_fare || r.estimated_fare}` : '—'}
                      </strong>
                    </td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>
                        {r.created_at || 'Recently'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
