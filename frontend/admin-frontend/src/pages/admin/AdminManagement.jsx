import { useState } from 'react';
import { Plus, Edit, Trash2, Shield, Users, Key } from 'lucide-react';
import DataTable from '../../components/shared/DataTable';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import Modal from '../../components/shared/Modal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { adminUsersAPI } from '../../api/client';

export function AdminUsers() {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: 'Admin', password: '', confirmPassword: '' });
  const [submitting, setSubmitting] = useState(false);

  const { data: usersData, loading: loadingUsers, error: errorUsers, refetch: refetchUsers } = useApi(adminUsersAPI.list);
  const { data: rolesData, loading: loadingRoles, error: errorRoles, refetch: refetchRoles } = useApi(adminUsersAPI.roles);

  const adminUsers = Array.isArray(usersData) ? usersData : (usersData?.results || []);
  const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.results || []);

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      alert('Please fill all required fields');
      return;
    }
    if (form.password !== form.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      await adminUsersAPI.create(form);
      setShowModal(false);
      setForm({ name: '', email: '', role: 'Admin', password: '', confirmPassword: '' });
      refetchUsers();
    } catch {
      alert('Failed to create admin user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Deactivate this admin user?')) {
      try {
        await adminUsersAPI.delete(id);
        refetchUsers();
      } catch {
        alert('Failed to deactivate admin user');
      }
    }
  };

  const USER_COLS = [
    { key: 'id', label: 'ID', render: v => <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>#{strVal(v)}</span> },
    { key: 'name', label: 'Name', render: (v, row) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div className="avatar avatar-sm">{(v || row.username || 'A').charAt(0).toUpperCase()}</div>
        <strong>{v || row.username}</strong>
      </div>
    )},
    { key: 'email', label: 'Email', render: v => <span style={{ color: 'var(--accent-primary)' }}>{v}</span> },
    { key: 'role', label: 'Role', render: v => <span className="badge badge-primary">{v}</span> },
    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
    { key: 'last_login', label: 'Last Login', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v || '—'}</span> },
    { key: 'actions', label: '', render: (_, row) => (
      <div style={{ display: 'flex', gap: 5 }}>
        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(row.id)}><Trash2 size={13} /></button>
      </div>
    )},
  ];

  function strVal(v) {
    if (!v) return '';
    return typeof v === 'string' && v.length > 8 ? v.substring(0, 8) : v;
  }

  if (loadingUsers || loadingRoles) return <LoadingState text="Loading admin personnel & roles..." />;
  if (errorUsers || errorRoles) return <ErrorState message={errorUsers || errorRoles} onRetry={() => { refetchUsers(); refetchRoles(); }} />;

  return (
    <div>
      <PageHeader title="Admin Users" subtitle="Manage admin accounts and access" breadcrumb={['Admin Management', 'Admin Users']}>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> Add Admin</button>
      </PageHeader>

      <div className="grid-3 mb-24">
        {roles.map(r => (
          <div key={r.id} className="stat-card">
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 2,
              background: `linear-gradient(90deg, ${r.color || '#6C63FF'}, transparent)`
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${r.color || '#6C63FF'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} color={r.color || '#6C63FF'} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 600 }}>{r.name}</h3>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>{r.permissions}</p>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{r.users} admin{r.users !== 1 ? 's' : ''}</span>
          </div>
        ))}
      </div>

      <DataTable
        title="Admin Users"
        columns={USER_COLS}
        data={adminUsers}
        searchKeys={['name','email','role','username']}
        filters={[
          { key: 'role', label: 'Role', options: roles.map(r=>({value:r.name,label:r.name})) },
          { key: 'status', label: 'Status', options: [{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}] },
        ]}
      />

      {showModal && (
        <Modal title="Add Admin User" onClose={() => setShowModal(false)}
          footer={<>
            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Admin'}
            </button>
          </>}
        >
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-control" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Rahul Verma" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="e.g. rahul@raahgo.in" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-control" value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
              {roles.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="form-control" type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className="form-control" type="password" value={form.confirmPassword} onChange={e => setForm({...form, confirmPassword: e.target.value})} />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function Roles() {
  const { data: rolesData, loading, error } = useApi(adminUsersAPI.roles);
  const roles = Array.isArray(rolesData) ? rolesData : (rolesData?.results || []);

  const PERM_GROUPS = [
    { group: 'Dashboard', perms: ['View Dashboard','View Analytics','View Reports'] },
    { group: 'Customers', perms: ['View Customers','Block/Unblock','Delete Customer'] },
    { group: 'Drivers', perms: ['View Drivers','Approve Driver','Suspend Driver','View Documents','Approve Documents'] },
    { group: 'Rides', perms: ['View All Rides','Cancel Ride','Assign Driver','Refund Ride'] },
    { group: 'Payments', perms: ['View Payments','Process Refund','Process Payout','Edit Commission'] },
    { group: 'Settings', perms: ['View Settings','Edit Settings','Manage Admins'] },
  ];

  if (loading) return <LoadingState text="Loading role permissions..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader title="Roles & Permissions" subtitle="Configure role-based access control" breadcrumb={['Admin Management', 'Roles']} />
      <div className="grid-2">
        {roles.map(r => (
          <div key={r.id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${r.color || '#6C63FF'}20`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Shield size={18} color={r.color || '#6C63FF'} />
                </div>
                <div>
                  <h3 style={{ fontSize: 15, fontWeight: 700 }}>{r.name}</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{r.users} active admin{r.users !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(r.permissions || '').split(',').map((p, i) => (
                <span key={i} className="badge badge-primary" style={{ fontSize: 11 }}>{p.trim()}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AdminUsers;
