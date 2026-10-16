export default function StatusBadge({ status }) {
  const map = {
    active:      'badge badge-active',
    inactive:    'badge badge-inactive',
    pending:     'badge badge-pending',
    searching:   'badge badge-warning',
    accepted:    'badge badge-primary',
    arrived:     'badge badge-warning',
    in_trip:     'badge badge-primary',
    'in trip':   'badge badge-primary',
    suspended:   'badge badge-suspended',
    completed:   'badge badge-completed',
    cancelled:   'badge badge-cancelled',
    online:      'badge badge-online',
    offline:     'badge badge-offline',
    approved:    'badge badge-approved',
    rejected:    'badge badge-rejected',
    blocked:     'badge badge-suspended',
    open:        'badge badge-pending',
    closed:      'badge badge-inactive',
    resolved:    'badge badge-completed',
    on_ride:     'badge badge-primary',
    arriving:    'badge badge-warning',
  };

  const cls = map[status?.toLowerCase()] || 'badge badge-inactive';
  const label = status ? status.replace(/_/g, ' ') : '—';

  return <span className={cls}>{label}</span>;
}
