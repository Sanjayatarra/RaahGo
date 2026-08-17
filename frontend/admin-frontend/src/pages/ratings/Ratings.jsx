import { useState } from 'react';
import { Star, Trash2 } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { ratingsAPI } from '../../api/client';

export default function Ratings() {
  const [tab, setTab] = useState('all');
  const { data: ratings, loading, error, refetch } = useApi(ratingsAPI.list);

  const ratingsList = Array.isArray(ratings) ? ratings : (ratings?.results || []);

  const filtered = tab === 'all' ? ratingsList
    : tab === 'low' ? ratingsList.filter(r => (Number(r.rating) || 5) <= 2)
    : tab === 'flagged' ? ratingsList.filter(r => r.flagged)
    : ratingsList.filter(r => r.type === tab);

  const RATING_COLS = [
    { key: 'from', label: 'From', render: (v, row) => (
      <div>
        <strong>{v || row.customer_name || 'Customer'}</strong>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.type === 'driver_to_customer' ? 'Driver' : 'Customer'}</p>
      </div>
    )},
    { key: 'to', label: 'To', render: (v, row) => (
      <div>
        <strong>{v || row.driver_name || 'Driver'}</strong>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row.type === 'driver_to_customer' ? 'Customer' : 'Driver'}</p>
      </div>
    )},
    { key: 'ride_id', label: 'Ride', render: v => <span style={{ color: 'var(--accent-primary)', fontSize: 12 }}>{v}</span> },
    { key: 'rating', label: 'Rating', render: v => {
      const val = Number(v) || 5;
      return (
        <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={13} fill={i < val ? '#FFD93D' : 'none'} color={i < val ? '#FFD93D' : '#4A5568'} />
          ))}
          <span style={{ marginLeft: 4, fontWeight: 700 }}>{val}.0</span>
        </span>
      );
    }},
    { key: 'review', label: 'Review', render: v => <span>{v || 'Good ride'}</span> },
    { key: 'flagged', label: '', render: v => v ? <span className="badge badge-suspended">Flagged</span> : null },
    { key: 'date', label: 'Date', render: (v, row) => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v || row.created_at || '—'}</span> },
    { key: 'actions', label: '', render: (_, row) => (
      <button className="btn btn-sm btn-danger" onClick={async () => {
        if (confirm('Delete this rating?')) {
          try { await ratingsAPI.delete(row.id); refetch(); } catch { alert('Failed to delete'); }
        }
      }}><Trash2 size={13} /></button>
    )},
  ];

  if (loading) return <LoadingState text="Loading ratings and reviews..." />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Ratings & Reviews" subtitle="Manage customer and driver ratings" breadcrumb={['Ratings']} />
      <div className="tabs">
        {[
          { key: 'all', label: `All (${ratingsList.length})` },
          { key: 'customer_to_driver', label: 'Customer Reviews' },
          { key: 'driver_to_customer', label: 'Driver Reviews' },
          { key: 'low', label: `⚠️ Low Rated (${ratingsList.filter(r=>(Number(r.rating)||5)<=2).length})` },
          { key: 'flagged', label: `🚩 Flagged (${ratingsList.filter(r=>r.flagged).length})` },
        ].map(t => (
          <button key={t.key} className={`tab${tab===t.key?' active':''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>
      <DataTable
        title="Reviews"
        columns={RATING_COLS}
        data={filtered}
        searchKeys={['from','to','review','driver_name','customer_name']}
        filters={[
          { key: 'rating', label: 'Rating', options: [1,2,3,4,5].map(r=>({value:r,label:`${r} Stars`})) },
        ]}
      />
    </div>
  );
}
