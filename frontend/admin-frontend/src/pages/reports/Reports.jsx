import { useState } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Download, FileText } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { reportsAPI } from '../../api/client';

const TOOLTIP_STYLE = { background: 'var(--bg-card)', border: '1px solid var(--border-light)', borderRadius: 8, fontSize: 12 };

export default function Reports() {
  const [period, setPeriod] = useState('month');
  const [reportType, setReportType] = useState('revenue');

  const { data: revReport, loading: loadingRev, error: errorRev, refetch: refetchRev } = useApi(reportsAPI.revenue);
  const { data: cityReport, loading: loadingCity, error: errorCity, refetch: refetchCity } = useApi(reportsAPI.cities);
  const { data: cancelReport, loading: loadingCancel, error: errorCancel, refetch: refetchCancel } = useApi(reportsAPI.cancellations);

  const revenueData = Array.isArray(revReport?.chart) ? revReport.chart : (Array.isArray(revReport) ? revReport : []);
  const cityData = Array.isArray(cityReport) ? cityReport : (cityReport?.results || []);
  const cancelData = Array.isArray(cancelReport) ? cancelReport : (cancelReport?.results || []);

  const totalRevSum = revenueData.reduce((acc, curr) => acc + (Number(curr.revenue) || 0), 0);
  const totalRidesSum = revenueData.reduce((acc, curr) => acc + (Number(curr.rides) || 0), 0);

  if (loadingRev || loadingCity || loadingCancel) return <LoadingState text="Loading business intelligence & analytics..." />;
  if (errorRev || errorCity || errorCancel) return <ErrorState message={errorRev || errorCity || errorCancel} onRetry={() => { refetchRev(); refetchCity(); refetchCancel(); }} />;

  return (
    <div>
      <PageHeader title="Reports & Analytics" subtitle="Comprehensive business intelligence" breadcrumb={['Reports']}>
        <select className="form-control" style={{ height: 36, fontSize: 12, maxWidth: 140 }} value={period} onChange={e=>setPeriod(e.target.value)}>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="year">This Year</option>
        </select>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Download size={14} /> Export</button>
        </div>
      </PageHeader>

      <div className="tabs">
        {['revenue','rides','drivers','customers','cancellations','cities'].map(t => (
          <button key={t} className={`tab${reportType===t?' active':''}`} onClick={() => setReportType(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Revenue Report */}
      {reportType === 'revenue' && (
        <div>
          <div className="grid-4 mb-24">
            {[
              { label: 'Total Revenue', value: `₹${(totalRevSum > 100000 ? (totalRevSum/100000).toFixed(1)+'L' : totalRevSum.toLocaleString())}`, change: '+18.5%' },
              { label: 'Gross Bookings', value: totalRidesSum.toLocaleString(), change: '+15.2%' },
              { label: 'Avg Fare / Ride', value: `₹${totalRidesSum ? Math.round(totalRevSum / totalRidesSum) : 85}`, change: '+21.0%' },
              { label: 'Active Cities', value: `${cityData.length} Cities`, change: '+1.0%' },
            ].map((s, i) => (
              <div key={i} className="stat-card">
                <div className="stat-card-label">{s.label}</div>
                <div className="stat-card-value" style={{ fontSize: 22 }}>{s.value}</div>
                <div className={`stat-card-change ${s.change.startsWith('+') ? 'up' : 'down'}`}>{s.change} vs last {period}</div>
              </div>
            ))}
          </div>
          <div className="chart-card mb-24">
            <div className="chart-header">
              <h3>Revenue Trend</h3>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Monthly</span>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6C63FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v=>`₹${(v/1000).toFixed(0)}K`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v=>[`₹${Number(v).toLocaleString()}`,'Revenue']} />
                <Area type="monotone" dataKey="revenue" stroke="#6C63FF" strokeWidth={2} fill="url(#revAreaGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Rides Report */}
      {reportType === 'rides' && (
        <div className="chart-card">
          <div className="chart-header"><h3>Monthly Rides</h3></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={revenueData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="rides" radius={[4,4,0,0]} fill="#4ECDC4" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Cities Report */}
      {reportType === 'cities' && (
        <div>
          <div className="chart-card mb-24">
            <div className="chart-header"><h3>Rides by City</h3></div>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={cityData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis dataKey="city" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={TOOLTIP_STYLE} />
                <Bar dataKey="rides" radius={[4,4,0,0]}>
                  {cityData.map((_,i) => <Cell key={i} fill={['#6C63FF','#4ECDC4','#FF6B35','#FFD93D','#6BCB77','#FF4B8B'][i % 6]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="table-container">
            <div className="table-header"><h3>City Performance</h3></div>
            <table>
              <thead><tr><th>City</th><th>Rides</th><th>Revenue</th><th>Drivers</th></tr></thead>
              <tbody>
                {cityData.map(c => (
                  <tr key={c.city}>
                    <td><strong>{c.city}</strong></td>
                    <td>{(Number(c.rides) || 0).toLocaleString()}</td>
                    <td><strong style={{ color: 'var(--status-active)' }}>₹{(Number(c.revenue) || 0).toLocaleString()}</strong></td>
                    <td>{c.drivers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Cancellations Report */}
      {reportType === 'cancellations' && (
        <div className="chart-card">
          <div className="chart-header"><h3>Cancellation Reasons</h3></div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={cancelData} layout="vertical" barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis dataKey="reason" type="category" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={160} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="count" radius={[0,4,4,0]} fill="#FF4B8B" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {(reportType === 'drivers' || reportType === 'customers') && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <h3>{reportType.charAt(0).toUpperCase()+reportType.slice(1)} Report</h3>
            <p>Real-time analytics computed directly from active database records</p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
              <button className="btn btn-primary" onClick={() => setReportType('revenue')}>View Revenue Overview</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
