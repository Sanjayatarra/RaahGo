import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Ban, CheckCircle, Eye, Download, Star, Users, UserCheck, AlertTriangle, Clock, XCircle, Phone, Mail, MapPin, Car, Shield, FileText } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import StatCard from '../../components/shared/StatCard';
import AlertModal from '../../components/shared/AlertModal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { driversAPI } from '../../api/client';

const CITIES_OPTS = ['Delhi','Mumbai','Bangalore','Pune','Hyderabad','Chennai','Kolkata','Jaipur']
  .map(c => ({ value: c, label: c }));
const VEHICLE_OPTS = ['Bike','Auto','Car','Taxi','Parcel','Tempo']
  .map(v => ({ value: v, label: v }));

export function DriverList() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(driversAPI.list, []);
  const drivers = Array.isArray(data) ? data : (data?.results ?? []);
  const [actionLoading, setActionLoading] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: 'Notice',
    message: '',
    type: 'info',
    confirmText: 'OK',
    cancelText: null,
    onConfirm: null,
  });

  const showAlert = (message, title = 'Notice', type = 'info', confirmText = 'OK', cancelText = null, onConfirm = null) => {
    setAlertModal({ isOpen: true, title, message, type, confirmText, cancelText, onConfirm });
  };

  const handleBlockDriver = (driverId) => {
    showAlert(
      'Are you sure you want to block and suspend this driver from receiving rides?',
      'Block Driver Confirmation',
      'error',
      'Yes, Block Driver',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.block(driverId);
          refetch();
          showAlert('Driver has been successfully blocked.', 'Driver Blocked', 'error');
        } catch {
          showAlert('Failed to block driver. Please try again.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleUnblockDriver = (driverId) => {
    showAlert(
      'Are you sure you want to unblock and activate this driver?',
      'Unblock Driver Confirmation',
      'info',
      'Yes, Unblock Driver',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.unblock(driverId);
          refetch();
          showAlert('Driver has been reactivated successfully.', 'Driver Unblocked', 'success');
        } catch {
          showAlert('Failed to unblock driver.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const DRIVER_COLS = [
    { key: 'id', label: 'ID', render: (v, row) => (
      <Link to={`/drivers/${row.id}`} style={{ color: 'var(--accent-primary)', fontSize: 12, fontWeight: 700 }}>
        #{typeof v === 'string' && v.length > 8 ? v.substring(0, 8) : v}
      </Link>
    )},
    { key: 'name', label: 'Driver', render: (v, row) => (
      <Link to={`/drivers/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <strong>{v || row.full_name || row.username}</strong>
        <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{row.username || 'driver'}</p>
      </Link>
    )},
    { key: 'phone', label: 'Phone', render: (v, row) => v || row.phone_number },
    { key: 'city', label: 'City' },
    { key: 'vehicle_type', label: 'Vehicle', render: v => v ? <span className="badge badge-primary">{v}</span> : '—' },
    { key: 'rating', label: 'Rating', render: v => v ? (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--accent-yellow)', fontWeight: 700 }}>
        <Star size={12} fill="currentColor" /> {Number(v).toFixed(1)}
      </span>
    ) : '—' },
    { key: 'total_rides', label: 'Rides', render: v => <strong>{v ?? 0}</strong> },
    { key: 'online_status', label: 'Online', render: v => <StatusBadge status={v || 'offline'} /> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'verification_status', label: 'Verified', render: v => <StatusBadge status={v || 'pending'} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          className="btn btn-sm btn-ghost"
          title="Open Captain Page"
          onClick={() => navigate(`/drivers/${row.id}`)}
        >
          <Eye size={13} />
        </button>
        {row.status !== 'suspended' && (
          <button className="btn btn-sm btn-danger" title="Block Captain" onClick={() => handleBlockDriver(row.id)}>
            <Ban size={13} />
          </button>
        )}
        {row.status === 'suspended' && (
          <button className="btn btn-sm btn-success" title="Unblock Captain" onClick={() => handleUnblockDriver(row.id)}>
            <CheckCircle size={13} />
          </button>
        )}
      </div>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const active    = drivers.filter(d => d.status === 'active').length;
  const pending   = drivers.filter(d => d.verification_status === 'pending').length;
  const suspended = drivers.filter(d => d.status === 'suspended').length;

  return (
    <div>
      <PageHeader title="Captain" subtitle="Manage all registered Captain" breadcrumb={['Captain', 'All Captain']}>
        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Download size={14} /> Export</button>
      </PageHeader>
      <div className="grid-stat mb-24">
        <StatCard label="Total Captain"     value={drivers.length} icon={Users}         color="purple" />
        <StatCard label="Active Captain"    value={active}         icon={UserCheck}      color="green"  />
        <StatCard label="Pending Approval"  value={pending}        icon={Clock}          color="yellow" />
        <StatCard label="Suspended / Blocked" value={suspended}      icon={AlertTriangle}  color="pink"   />
      </div>
      <DataTable
        title="All Captain"
        columns={DRIVER_COLS}
        data={drivers}
        searchKeys={['name', 'full_name', 'phone', 'phone_number', 'city', 'username']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' }, { value: 'pending', label: 'Pending' },
          ]},
          { key: 'vehicle_type', label: 'Vehicle', options: VEHICLE_OPTS },
          { key: 'city',         label: 'City',    options: CITIES_OPTS  },
          { key: 'online_status', label: 'Online', options: [
            { value: 'online', label: 'Online' }, { value: 'offline', label: 'Offline' },
            { value: 'on_ride', label: 'On Ride' },
          ]},
        ]}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        confirmText={alertModal.confirmText}
        cancelText={alertModal.cancelText}
        onConfirm={alertModal.onConfirm}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}

export function PendingApprovals() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(
    () => driversAPI.list({ verification_status: 'pending' }), []
  );
  const pending = Array.isArray(data) ? data : (data?.results ?? []);

  const handleApprove = async (id) => {
    try {
      await driversAPI.approve(id);
      refetch();
    } catch {
      alert('Failed to approve driver');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection:');
    if (reason) {
      try {
        await driversAPI.reject(id, { reason });
        refetch();
      } catch {
        alert('Failed to reject driver');
      }
    }
  };

  const PEND_COLS = [
    { key: 'id', label: 'ID', render: (v, row) => (
      <Link to={`/drivers/${row.id}?tab=pending`} style={{ color: 'var(--accent-primary)', fontSize: 12, fontWeight: 700 }}>
        #{typeof v === 'string' && v.length > 8 ? v.substring(0, 8) : v}
      </Link>
    )},
    { key: 'name', label: 'Driver', render: (v, row) => (
      <Link to={`/drivers/${row.id}?tab=pending`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <strong>{v || row.full_name}</strong>
      </Link>
    )},
    { key: 'phone', label: 'Phone', render: (v, row) => v || row.phone_number },
    { key: 'city', label: 'City' },
    { key: 'vehicle_type', label: 'Vehicle', render: v => v ? <span className="badge badge-primary">{v}</span> : '—' },
    { key: 'verification_status', label: 'Status', render: v => <StatusBadge status={v || 'pending'} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          className="btn btn-sm btn-ghost"
          title="Open Pending Review Page"
          onClick={() => navigate(`/drivers/${row.id}?tab=pending`)}
        >
          <Eye size={13} /> View
        </button>
        <button className="btn btn-sm btn-success" onClick={() => handleApprove(row.id)}>
          <CheckCircle size={13} /> Approve
        </button>
        <button className="btn btn-sm btn-danger" onClick={() => handleReject(row.id)}>
          <XCircle size={13} /> Reject
        </button>
      </div>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="Pending Approvals" subtitle={`${pending.length} Captain waiting for approval`} breadcrumb={['Captain', 'Pending Approval']} />
      <DataTable title="Pending Captain" columns={PEND_COLS} data={pending} searchKeys={['name', 'full_name', 'phone', 'city']} />
    </div>
  );
}

export function DriverDocuments() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(driversAPI.list, []);
  const drivers = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // Flatten: each driver may have multiple documents
  const docs = drivers.flatMap(d =>
    (d.documents ?? []).map(doc => ({
      ...doc,
      driver_id: d.id,
      driver: d.name || d.full_name,
    }))
  );

  const handleApproveDoc = async (driverId, docId) => {
    try {
      await driversAPI.approveDoc(driverId, docId);
      refetch();
    } catch {
      alert('Failed to approve document');
    }
  };

  const handleRejectDoc = async (driverId, docId) => {
    const reason = prompt('Reason for rejection:');
    if (reason) {
      try {
        await driversAPI.rejectDoc(driverId, docId, { reason });
        refetch();
      } catch {
        alert('Failed to reject document');
      }
    }
  };

  const DOC_COLS = [
    { key: 'driver', label: 'Driver', render: (v, row) => (
      <Link to={`/drivers/${row.driver_id}?tab=documents`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <strong>{v}</strong>
      </Link>
    )},
    { key: 'driver_id', label: 'Driver ID', render: v => (
      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
        #{typeof v === 'string' && v.length > 8 ? v.substring(0, 8) : v}
      </span>
    )},
    { key: 'document_type', label: 'Document' },
    { key: 'submitted_at', label: 'Submitted' },
    { key: 'expires_at', label: 'Expires', render: v => v || <span style={{ color: 'var(--text-muted)' }}>N/A</span> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        {row.status === 'pending' && <>
          <button className="btn btn-sm btn-success" onClick={() => handleApproveDoc(row.driver_id, row.id)}>
            <CheckCircle size={13} /> Approve
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => handleRejectDoc(row.driver_id, row.id)}>
            <XCircle size={13} /> Reject
          </button>
        </>}
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => navigate(`/drivers/${row.driver_id}?tab=documents`)}
        >
          <Eye size={13} /> View Docs
        </button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Captain Documents" subtitle="Verify and manage all Captain documents" breadcrumb={['Captain', 'Documents']} />
      <DataTable
        title="Documents"
        columns={DOC_COLS}
        data={docs}
        searchKeys={['driver', 'document_type']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
          ]},
        ]}
      />
    </div>
  );
}

export function DriverEarnings() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(
    () => import('../../api/client').then(m => m.earningsAPI.list()), []
  );
  const earnings = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const EARN_COLS = [
    { key: 'driver_id', label: 'ID', render: (v, row) => (
      <Link to={`/drivers/${row.id}`} style={{ color: 'var(--accent-primary)', fontSize: 12, fontWeight: 700 }}>
        #{v}
      </Link>
    )},
    { key: 'driver_name', label: 'Driver', render: (v, row) => (
      <Link to={`/drivers/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <strong>{v}</strong>
      </Link>
    )},
    { key: 'vehicle_type', label: 'Vehicle', render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'today_earnings', label: 'Today', render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v ?? 0}</strong> },
    { key: 'week_earnings', label: 'This Week', render: v => `₹${v ?? 0}` },
    { key: 'month_earnings', label: 'This Month', render: v => `₹${v ?? 0}` },
    { key: 'commission_paid', label: 'Commission Paid', render: v => `₹${v ?? 0}` },
    { key: 'pending_payout', label: 'Pending Payout', render: v => <span style={{ color: 'var(--accent-yellow)', fontWeight: 700 }}>₹{v ?? 0}</span> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <button className="btn btn-sm btn-ghost" onClick={() => navigate(`/drivers/${row.id}`)}>
        <Eye size={13} /> View Driver
      </button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Captain Earnings" subtitle="Track and manage Captain earnings & payouts" breadcrumb={['Captain', 'Earnings']} />
      <DataTable title="Captain Earnings" columns={EARN_COLS} data={earnings} searchKeys={['driver_name', 'vehicle_type']} />
    </div>
  );
}

export function DriverRatings() {
  const { data, loading, error, refetch } = useApi(
    () => import('../../api/client').then(m => m.ratingsAPI.list({ type: 'customer_to_driver' })), []
  );
  const ratings = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const RAT_COLS = [
    { key: 'driver_name', label: 'Driver', render: v => <strong>{v}</strong> },
    { key: 'customer_name', label: 'Customer' },
    { key: 'ride_id', label: 'Ride', render: v => <span style={{ color: 'var(--accent-primary)', fontSize: 12 }}>#{v}</span> },
    { key: 'rating', label: 'Rating', render: v => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} size={12} fill={i < v ? '#FFD93D' : 'none'} color={i < v ? '#FFD93D' : '#4A5568'} />
        ))}
        <span style={{ marginLeft: 4 }}>{v}</span>
      </span>
    )},
    { key: 'review', label: 'Review' },
    { key: 'created_at', label: 'Date', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'actions', label: '', render: (_, row) => (
      <button className="btn btn-sm btn-danger" onClick={() => import('../../api/client').then(m => m.ratingsAPI.delete(row.id)).then(refetch)}>Delete</button>
    )},
  ];

  return (
    <div>
      <PageHeader title="Captain Ratings" subtitle="Customer reviews for Captain" breadcrumb={['Captain', 'Ratings']} />
      <DataTable
        title="Ratings & Reviews"
        columns={RAT_COLS}
        data={ratings}
        searchKeys={['driver_name', 'customer_name']}
        filters={[
          { key: 'rating', label: 'Rating', options: [1,2,3,4,5].map(r => ({ value: r, label: `${r} Star${r > 1 ? 's' : ''}` })) },
        ]}
      />
    </div>
  );
}
