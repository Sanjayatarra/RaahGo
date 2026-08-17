import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Ban, CheckCircle, Eye, Download, User, Phone, Mail, Wallet, Car } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';
import AlertModal from '../../components/shared/AlertModal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { customersAPI } from '../../api/client';

export function CustomerList() {
  const navigate = useNavigate();
  const { data, loading, error, refetch } = useApi(customersAPI.list, []);
  const customers = Array.isArray(data) ? data : (data?.results ?? []);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
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

  const handleBlockCustomer = (id) => {
    showAlert(
      'Are you sure you want to block this user?',
      'Block User Confirmation',
      'error',
      'Yes, Block User',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await customersAPI.block(id);
          refetch();
          if (selectedCustomer?.id === id) {
            setSelectedCustomer(prev => prev ? { ...prev, status: 'blocked' } : null);
          }
          showAlert('User has been blocked successfully.', 'User Blocked', 'error');
        } catch {
          showAlert('Failed to block customer. Please try again.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleUnblockCustomer = (id) => {
    showAlert(
      'Are you sure you want to unblock this user?',
      'Unblock User Confirmation',
      'info',
      'Yes, Unblock User',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await customersAPI.unblock(id);
          refetch();
          if (selectedCustomer?.id === id) {
            setSelectedCustomer(prev => prev ? { ...prev, status: 'active' } : null);
          }
          showAlert('User has been unblocked successfully.', 'User Unblocked', 'success');
        } catch {
          showAlert('Failed to unblock customer. Please try again.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const COLS = [
    { key: 'id', label: 'ID', render: (v, row) => (
      <Link to={`/customers/${row.id}`} style={{ color: 'var(--accent-primary)', fontSize: 12, fontWeight: 700 }}>
        #{typeof v === 'string' && v.length > 8 ? v.substring(0, 8) : v}
      </Link>
    )},
    { key: 'name', label: 'Name', render: (v, row) => (
      <Link to={`/customers/${row.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <strong>{v || row.full_name || row.username}</strong>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>@{row.username || 'customer'}</p>
      </Link>
    )},
    { key: 'phone', label: 'Phone', render: (v, row) => v || row.phone_number },
    { key: 'city', label: 'City' },
    { key: 'total_rides', label: 'Total Rides', render: v => <strong>{v ?? 0}</strong> },
    { key: 'wallet_balance', label: 'Wallet', render: v => v != null ? <strong style={{ color: 'var(--status-active)' }}>₹{v}</strong> : '₹0' },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'date_joined', label: 'Joined', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          className="btn btn-sm btn-ghost"
          title="View Customer Details"
          onClick={() => navigate(`/customers/${row.id}`)}
        >
          <Eye size={13} />
        </button>
        <button
          className={`btn btn-sm ${row.status === 'blocked' ? 'btn-success' : 'btn-danger'}`}
          title={row.status === 'blocked' ? 'Unblock User' : 'Block User'}
          onClick={() => row.status === 'blocked' ? handleUnblockCustomer(row.id) : handleBlockCustomer(row.id)}
        >
          {row.status === 'blocked' ? <CheckCircle size={13} /> : <Ban size={13} />}
        </button>
      </div>
    )},
  ];

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <div>
      <PageHeader title="User Management (Customers)" subtitle="Manage all registered app customers and users" breadcrumb={['Customers', 'All Users']}>
        <button className="btn btn-secondary btn-sm" onClick={() => window.print()}><Download size={14} /> Export</button>
      </PageHeader>
      <DataTable
        title="All Users / Customers"
        columns={COLS}
        data={customers}
        searchKeys={['name', 'full_name', 'phone', 'phone_number', 'email', 'city', 'username']}
        filters={[
          { key: 'status', label: 'Status', options: [
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'suspended', label: 'Suspended' },
            { value: 'blocked', label: 'Blocked' },
          ]},
        ]}
      />

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <Modal
          title={`User Profile: ${selectedCustomer.name || selectedCustomer.full_name || selectedCustomer.username}`}
          onClose={() => setSelectedCustomer(null)}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <div>
                {selectedCustomer.status === 'blocked' ? (
                  <button className="btn btn-success btn-sm" onClick={() => handleUnblockCustomer(selectedCustomer.id)} disabled={actionLoading}>
                    <CheckCircle size={14} /> Unblock User
                  </button>
                ) : (
                  <button className="btn btn-danger btn-sm" onClick={() => handleBlockCustomer(selectedCustomer.id)} disabled={actionLoading}>
                    <Ban size={14} /> Block User
                  </button>
                )}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setSelectedCustomer(null)}>Close</button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--bg-secondary)', borderRadius: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="avatar avatar-md" style={{ background: 'var(--accent-secondary)', color: 'white', fontWeight: 800 }}>
                  {(selectedCustomer.name || selectedCustomer.username || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{selectedCustomer.name || selectedCustomer.full_name || selectedCustomer.username}</h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>ID: #{selectedCustomer.id}</p>
                </div>
              </div>
              <StatusBadge status={selectedCustomer.status} />
            </div>

            <div className="grid-2" style={{ gap: 12 }}>
              <div className="card" style={{ padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Account Info</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div><strong>Phone:</strong> {selectedCustomer.phone || selectedCustomer.phone_number || '—'}</div>
                  <div><strong>Email:</strong> {selectedCustomer.email || '—'}</div>
                  <div><strong>City:</strong> {selectedCustomer.city || 'Delhi'}</div>
                  <div><strong>Joined Date:</strong> {selectedCustomer.date_joined || '—'}</div>
                </div>
              </div>

              <div className="card" style={{ padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Usage & Wallet</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
                  <div><strong>Wallet Balance:</strong> <strong style={{ color: 'var(--status-active)' }}>₹{selectedCustomer.wallet_balance ?? 0}</strong></div>
                  <div><strong>Total Rides Booked:</strong> {selectedCustomer.total_rides ?? 0}</div>
                  <div><strong>Account Status:</strong> <StatusBadge status={selectedCustomer.status} /></div>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Alert / Confirmation Modal */}
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

export function CustomerWallets() {
  const { data, loading, error, refetch } = useApi(
    () => import('../../api/client').then(m => m.walletsAPI.list()), []
  );
  const wallets = Array.isArray(data) ? data : (data?.results ?? []);

  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} onRetry={refetch} />;

  const WCOLS = [
    { key: 'id',      label: 'ID',       render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{v}</span> },
    { key: 'name',    label: 'Customer', render: (v, row) => <strong>{v || row.user_name || row.full_name}</strong> },
    { key: 'phone',   label: 'Phone' },
    { key: 'balance', label: 'Balance',  render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v ?? 0}</strong> },
    { key: 'total_transactions', label: 'Transactions', render: v => v ?? '—' },
    { key: 'status',  label: 'Status',   render: v => <StatusBadge status={v} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div style={{ display: 'flex', gap: 6 }}>
        <button className="btn btn-sm btn-success" onClick={() => {
          const amount = prompt('Credit amount (₹):');
          const reason = prompt('Reason:');
          if (amount && reason) {
            import('../../api/client').then(m => m.walletsAPI.credit(row.id, { amount, reason }));
          }
        }}>Credit</button>
        <button className="btn btn-sm btn-danger" onClick={() => {
          const amount = prompt('Debit amount (₹):');
          const reason = prompt('Reason:');
          if (amount && reason) {
            import('../../api/client').then(m => m.walletsAPI.debit(row.id, { amount, reason }));
          }
        }}>Debit</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader title="Customer Wallets" subtitle="Manage customer wallet balances" breadcrumb={['Customers', 'Wallets']} />
      <DataTable title="Customer Wallets" columns={WCOLS} data={wallets} searchKeys={['name', 'user_name', 'phone']} />
    </div>
  );
}
