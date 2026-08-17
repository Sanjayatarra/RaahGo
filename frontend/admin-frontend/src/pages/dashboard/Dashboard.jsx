import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import {
  Car, Users, UserCheck, DollarSign,
  AlertTriangle, CheckCircle, XCircle, Clock,
} from 'lucide-react';
import StatCard from '../../components/shared/StatCard';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { dashboardAPI } from '../../api/client';

const RIDE_STATUS_COLORS = ['#4ECDC4', '#FF6B35', '#6C63FF', '#FFD93D'];

const TOOLTIP_STYLE = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-light)',
  borderRadius: 8,
  fontSize: 12,
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE, padding: '10px 14px' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: 6 }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.name === 'revenue' ? `₹${p.value?.toLocaleString()}` : p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Dashboard() {
  const [period, setPeriod] = useState('week');

  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useApi(dashboardAPI.stats, []);
  const { data: revenue, loading: revenueLoading } = useApi(dashboardAPI.revenue, [period]);
  const { data: ridesData, loading: ridesLoading } = useApi(dashboardAPI.rides, []);
  const { data: alerts, loading: alertsLoading } = useApi(dashboardAPI.alerts, []);

  // Normalise API shapes — backend returns { today: {...} } per spec
  const today = stats?.today ?? {};
  const revenueChart = revenue?.chart ?? [];
  const rideStatusChart = ridesData?.by_status ?? [];
  const vehicleChart = ridesData?.by_vehicle ?? [];
  const recentRides = ridesData?.recent ?? [];
  const alertsList = alerts?.alerts ?? [];

  if (statsLoading) return <LoadingState />;
  if (statsError) return <ErrorState message={statsError} onRetry={refetchStats} />;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Real-time overview of RaahGo operations"
        breadcrumb={['RaahGo Admin', 'Dashboard']}
      >
        <div className="live-indicator"><span className="live-dot" />LIVE</div>
        <select
          className="form-control"
          style={{ height: 36, fontSize: 12, maxWidth: 130 }}
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
      </PageHeader>

      {/* ── Today Stats ── */}
      <div className="grid-stat mb-24">
        <StatCard label="Total Rides Today" value={(today.rides ?? 0).toLocaleString()} change={8.2} icon={Car} color="purple" />
        <StatCard label="Revenue Today" value={today.revenue ? `₹${(today.revenue / 1000).toFixed(0)}K` : '—'} change={12.5} icon={DollarSign} color="green" />
        <StatCard label="Active Drivers" value={(today.active_drivers ?? 0).toLocaleString()} change={3.1} icon={UserCheck} color="teal" />
        <StatCard label="Active Customers" value={(today.active_customers ?? 0).toLocaleString()} change={15.7} icon={Users} color="orange" />
        <StatCard label="Completed Rides" value={(today.completed_rides ?? 0).toLocaleString()} change={6.4} icon={CheckCircle} color="green" />
        <StatCard label="Cancelled Rides" value={(today.cancelled_rides ?? 0).toLocaleString()} change={-4.2} icon={XCircle} color="pink" />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid-2 mb-24" style={{ gridTemplateColumns: '2fr 1fr' }}>
        {/* Revenue Chart */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Revenue & Rides Trend</h3>
            {revenueLoading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenueChart}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="day" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={60} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="revenue" name="revenue" stroke="#6C63FF" strokeWidth={2} fill="url(#revGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Ride Status Pie */}
        <div className="chart-card">
          <div className="chart-header">
            <h3>Ride Status</h3>
            {ridesLoading && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading…</span>}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={rideStatusChart} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                {rideStatusChart.map((_, i) => (
                  <Cell key={i} fill={RIDE_STATUS_COLORS[i % RIDE_STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(val) => [val, 'Rides']} contentStyle={TOOLTIP_STYLE} />
            </PieChart>
          </ResponsiveContainer>
          <div className="chart-legend" style={{ flexWrap: 'wrap' }}>
            {rideStatusChart.map((d, i) => (
              <div key={d.name} className="legend-item">
                <div className="legend-dot" style={{ background: RIDE_STATUS_COLORS[i % RIDE_STATUS_COLORS.length] }} />
                {d.name} ({d.value})
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Vehicle + Alerts ── */}
      <div className="grid-2 mb-24">
        <div className="chart-card">
          <div className="chart-header"><h3>Rides by Vehicle Type</h3></div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vehicleChart} barSize={28}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="type" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="rides" name="Rides" radius={[4, 4, 0, 0]}>
                {vehicleChart.map((_, i) => (
                  <Cell key={i} fill={['#6C63FF', '#4ECDC4', '#FF6B35', '#FFD93D', '#6BCB77'][i % 5]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* System Alerts */}
        <div className="card">
          <div className="chart-header">
            <h3>System Alerts</h3>
            {alertsList.length > 0 && <span className="badge badge-pending">{alertsList.length} active</span>}
          </div>
          {alertsLoading ? (
            <LoadingState />
          ) : alertsList.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px 0' }}>
              <CheckCircle size={32} color="var(--status-active)" style={{ marginBottom: 8 }} />
              <p>No active alerts</p>
            </div>
          ) : (
            alertsList.map((a, i) => (
              <div key={i} className={`alert alert-${a.type}`} style={{ marginBottom: 8 }}>
                <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 12 }}>
                  <p>{a.message}</p>
                  <span style={{ fontSize: 11, opacity: 0.7, marginTop: 2, display: 'block' }}>{a.time}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Recent Rides ── */}
      <div className="table-container">
        <div className="table-header">
          <h3>Recent Rides</h3>
          <a href="/operations/rides" className="btn btn-secondary btn-sm">View All</a>
        </div>
        {ridesLoading ? <LoadingState /> : (
          <table>
            <thead>
              <tr>
                <th>Ride ID</th><th>Customer</th><th>Driver</th><th>From → To</th>
                <th>Fare</th><th>Status</th><th>Time</th>
              </tr>
            </thead>
            <tbody>
              {recentRides.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No recent rides</td></tr>
              ) : recentRides.map((r) => (
                <tr key={r.id}>
                  <td><strong style={{ color: 'var(--accent-primary)', fontSize: 12 }}>{r.ride_id || r.id}</strong></td>
                  <td><strong>{r.customer}</strong></td>
                  <td style={{ color: !r.driver ? 'var(--text-muted)' : 'inherit' }}>{r.driver || '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.pickup_address} → {r.drop_address}</td>
                  <td><strong>{r.fare ? `₹${r.fare}` : '—'}</strong></td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{r.created_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
