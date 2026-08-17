import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Ban, CheckCircle, XCircle, Star, Phone, Mail, MapPin,
  Car, FileText, Shield, Clock, AlertTriangle, Wallet, User, Calendar, Check, RefreshCw,
  Send, BellRing, Sparkles, Smartphone, MessageSquare, ShieldCheck, LogOut
} from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import AlertModal from '../../components/shared/AlertModal';
import Modal from '../../components/shared/Modal';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { driversAPI } from '../../api/client';

export default function DriverDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: driver, loading, error, refetch } = useApi(
    () => driversAPI.get(id), [id]
  );

  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReasonModal, setRejectReasonModal] = useState(null); // { type: 'driver' | 'doc', docId?: string }
  const [rejectReason, setRejectReason] = useState('');
  const [notifModal, setNotifModal] = useState({ isOpen: false, title: '', body: '', type: 'System' });
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

  const handleSendNotification = async () => {
    if (!notifModal.title.trim() || !notifModal.body.trim()) {
      showAlert('Please enter both a title and message body for the push alert.', 'Incomplete Data', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.sendNotification(id, notifModal);
      setNotifModal({ isOpen: false, title: '', body: '', type: 'System' });
      await refetch();
      showAlert(
        `Push alert "${notifModal.title}" has been successfully dispatched to driver ${driver.name || driver.username} and saved in records.`,
        'Alert Sent',
        'success'
      );
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to dispatch alert to driver.';
      showAlert(errMsg, 'Delivery Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['overview', 'documents', 'pending', 'vehicles', 'rides', 'notifications'].includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleApproveDriver = () => {
    showAlert(
      'Are you sure you want to approve this driver? The driver will be authorized to go online and accept ride requests.',
      'Approve Driver Confirmation',
      'warning',
      'Yes, Approve',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.approve(id);
          await refetch();
          showAlert('Driver has been successfully approved and unlocked to go online.', 'Driver Approved', 'success');
        } catch {
          showAlert('Failed to approve driver. Please try again.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleRejectDriver = async () => {
    if (!rejectReason.trim()) {
      showAlert('Please provide a rejection reason so the driver can correct it.', 'Rejection Reason Required', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.reject(id, { reason: rejectReason });
      setRejectReasonModal(null);
      setRejectReason('');
      await refetch();
      showAlert('Driver application has been rejected. The driver will not be able to go online until corrected documents are re-submitted.', 'Driver Rejected', 'error');
    } catch {
      showAlert('Failed to reject driver.', 'Error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleBlockDriver = () => {
    showAlert(
      'Are you sure you want to block and suspend this driver? The driver will be disconnected from active service.',
      'Block Driver Confirmation',
      'error',
      'Yes, Block Driver',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.block(id);
          await refetch();
          showAlert('Driver has been blocked and suspended.', 'Driver Suspended', 'error');
        } catch {
          showAlert('Failed to block driver.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleUnblockDriver = () => {
    showAlert(
      'Are you sure you want to unblock and activate this driver?',
      'Unblock Driver Confirmation',
      'info',
      'Yes, Unblock Driver',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.unblock(id);
          await refetch();
          showAlert('Driver has been unblocked and reactivated.', 'Driver Reactivated', 'success');
        } catch {
          showAlert('Failed to unblock driver.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleApproveDoc = async (docId) => {
    setActionLoading(true);
    try {
      await driversAPI.approveDoc(id, docId);
      await refetch();
      showAlert('Document approved successfully.', 'Document Verified', 'success');
    } catch {
      showAlert('Failed to approve document.', 'Error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDoc = async () => {
    if (!rejectReasonModal?.docId) return;
    if (!rejectReason.trim()) {
      showAlert('Please enter a rejection reason.', 'Reason Required', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.rejectDoc(id, rejectReasonModal.docId, { reason: rejectReason });
      setRejectReasonModal(null);
      setRejectReason('');
      await refetch();
      showAlert('Document rejected. Driver approval status updated accordingly.', 'Document Rejected', 'error');
    } catch {
      showAlert('Failed to reject document.', 'Error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState />;
  if (error || !driver) return <ErrorState message={error || 'Driver not found'} onRetry={refetch} />;

  const isPending = driver.verification_status === 'pending';
  const isSuspended = driver.status === 'suspended';
  const documents = driver.documents || [];
  const pendingDocs = documents.filter(d => d.status === 'pending');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Breadcrumb & Back Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/drivers')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to Drivers
        </button>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={refetch} disabled={actionLoading}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setNotifModal({ isOpen: true, title: '', body: '', type: 'System' })}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Send size={14} color="var(--accent-primary)" /> Send Push Alert
          </button>
          {isPending && (
            <>
              <button
                className="btn btn-success btn-sm"
                onClick={handleApproveDriver}
                disabled={actionLoading}
              >
                <CheckCircle size={14} /> Approve Driver
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => { setRejectReasonModal({ type: 'driver' }); setRejectReason(''); }}
                disabled={actionLoading}
              >
                <XCircle size={14} /> Reject Driver
              </button>
            </>
          )}
          {!isPending && (
            isSuspended ? (
              <button
                className="btn btn-success btn-sm"
                onClick={handleUnblockDriver}
                disabled={actionLoading}
              >
                <CheckCircle size={14} /> Unblock Driver
              </button>
            ) : (
              <button
                className="btn btn-danger btn-sm"
                onClick={handleBlockDriver}
                disabled={actionLoading}
              >
                <Ban size={14} /> Block Driver
              </button>
            )
          )}
        </div>
      </div>

      {/* Single Device Policy Alert */}
      <div style={{
        padding: '12px 18px',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
        borderRadius: 14,
        border: '1px solid rgba(16, 185, 129, 0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ShieldCheck size={20} color="var(--status-active)" />
          <div>
            <strong style={{ fontSize: 13 }}>Single-Device Protection Active:</strong>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 6 }}>
              Captain account is locked to 1 active terminal. A new login forces session termination on earlier devices.
            </span>
          </div>
        </div>
        <span className="badge badge-active" style={{ fontSize: 11 }}>
          ● Strict 1 Device / Partner
        </span>
      </div>

      {/* Driver Header Banner Card */}
      <div className="card" style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #16A34A 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26,
                fontWeight: 900,
                boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
              }}
            >
              {(driver.name || driver.username || 'D').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
                  {driver.name || driver.full_name || driver.username}
                </h1>
                <StatusBadge status={driver.status} />
                <StatusBadge status={driver.verification_status || 'pending'} />
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Driver ID: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{driver.id}</span> · Joined: {driver.date_joined || 'Recent'}
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: 'var(--accent-yellow)', fontSize: 18, fontWeight: 800 }}>
                <Star size={18} fill="currentColor" /> {Number(driver.rating || 5.0).toFixed(1)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Rating</span>
            </div>
            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {driver.total_trips || driver.total_rides || 0}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Completed Trips</span>
            </div>
            <div style={{ textAlign: 'center', padding: '0 16px' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-active)' }}>
                ₹{driver.wallet_balance ?? 0}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Wallet Balance</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
          {[
            { key: 'overview', label: 'Overview & Profile', icon: User },
            { key: 'documents', label: `Documents (${documents.length})`, icon: FileText, badge: pendingDocs.length > 0 ? `${pendingDocs.length} Pending` : null },
            { key: 'pending', label: 'Pending Verification', icon: Clock, badge: isPending ? 'Action Required' : null },
            { key: 'vehicles', label: 'Vehicles', icon: Car },
            { key: 'rides', label: 'Recent Rides', icon: MapPin },
            { key: 'notifications', label: `Alerts & Push (${(driver.notifications || []).length})`, icon: BellRing },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => switchTab(tab.key)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-ghost'}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  borderRadius: 10,
                  fontWeight: isActive ? 700 : 500
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 800,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: isActive ? 'white' : 'var(--accent-yellow)',
                    color: isActive ? 'var(--accent-primary)' : '#000'
                  }}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── TAB 1: OVERVIEW & PROFILE ─────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="grid-2" style={{ gap: 20 }}>
          {/* Contact & Personal Info */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={16} /> Personal & Contact Information
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Full Name:</span>
                <strong>{driver.name || driver.full_name || driver.username}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Username:</span>
                <code>@{driver.username || 'driver'}</code>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Phone Number:</span>
                <strong>{driver.phone || driver.phone_number || '—'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Email Address:</span>
                <span>{driver.email || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Operating City:</span>
                <strong>{driver.city || 'Delhi'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Online Availability:</span>
                <StatusBadge status={driver.online_status || 'offline'} />
              </div>
            </div>
          </div>

          {/* Account Status & Verification Summary */}
          <div className="card" style={{ padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={16} /> Account & Verification Status
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Approval Status:</span>
                <StatusBadge status={driver.verification_status || 'pending'} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Login Account Status:</span>
                <StatusBadge status={driver.status} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Documents Uploaded:</span>
                <strong>{documents.length} files ({pendingDocs.length} pending review)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Vehicles Registered:</span>
                <strong>{driver.vehicles?.length || 1} Vehicle(s)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                <span style={{ color: 'var(--text-muted)' }}>Quick Actions:</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {isSuspended ? (
                    <button className="btn btn-success btn-xs" onClick={handleUnblockDriver}>Unblock</button>
                  ) : (
                    <button className="btn btn-danger btn-xs" onClick={handleBlockDriver}>Block Driver</button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Captain Device & Terminal Session Card */}
          <div className="card" style={{ padding: 20, gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Smartphone size={16} /> Active Terminal & Registered Device Details ({(driver.devices || []).length})
              </h3>
              <button className="btn btn-secondary btn-xs" onClick={refetch}>
                <RefreshCw size={11} /> Refresh
              </button>
            </div>

            {(driver.devices || []).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No device registered yet.</p>
            ) : (
              <table className="table" style={{ width: '100%', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th>Device Name / Terminal</th>
                    <th>Platform</th>
                    <th>App Version</th>
                    <th>FCM Push Token</th>
                    <th>Session Status</th>
                    <th>Last Active</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(driver.devices || []).map(dev => (
                    <tr key={dev.id}>
                      <td><strong>{dev.device_name}</strong></td>
                      <td><span className="badge badge-primary" style={{ fontSize: 11 }}>{dev.device_type}</span></td>
                      <td><code>{dev.app_version}</code></td>
                      <td><code style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>{dev.firebase_token}</code></td>
                      <td>
                        {dev.is_active ? (
                          <span className="badge badge-active">● Active Terminal</span>
                        ) : (
                          <span className="badge badge-secondary">○ Logged Out</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{dev.last_active}</td>
                      <td>
                        {dev.is_active ? (
                          <button
                            className="btn btn-danger btn-xs"
                            onClick={() => {
                              showAlert(
                                `Are you sure you want to terminate session on "${dev.device_name}"? The driver will be logged out immediately.`,
                                'Force Logout Driver Terminal',
                                'warning',
                                'Yes, Force Logout',
                                'Cancel',
                                async () => {
                                  setActionLoading(true);
                                  try {
                                    await driversAPI.terminateDevice(id, dev.id);
                                    await refetch();
                                    showAlert('Driver device session terminated successfully.', 'Session Terminated', 'success');
                                  } catch (e) {
                                    showAlert(e?.response?.data?.error || 'Failed to terminate session.', 'Error', 'error');
                                  } finally {
                                    setActionLoading(false);
                                  }
                                }
                              );
                            }}
                            disabled={actionLoading}
                            style={{ fontSize: 11, padding: '4px 8px' }}
                          >
                            <LogOut size={11} /> Force Logout
                          </button>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: DRIVER DOCUMENTS ───────────────────────────── */}
      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Driver Documents ({documents.length})</h3>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Review and verify driver identity and vehicle permits</span>
          </div>

          {documents.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              <FileText size={36} style={{ margin: '0 auto 12px' }} />
              <p style={{ fontWeight: 600 }}>No documents uploaded yet by this driver.</p>
            </div>
          ) : (
            <div className="grid-2" style={{ gap: 16 }}>
              {documents.map((doc) => (
                <div key={doc.id} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ padding: 8, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                          <FileText size={18} color="var(--accent-primary)" />
                        </div>
                        <div>
                          <h4 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{doc.document_type}</h4>
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Submitted: {doc.submitted_at}</span>
                        </div>
                      </div>
                      <StatusBadge status={doc.status} />
                    </div>

                    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4, background: 'var(--bg-secondary)', padding: 10, borderRadius: 8 }}>
                      {doc.document_number && <div><strong>Number:</strong> {doc.document_number}</div>}
                      <div><strong>Expires:</strong> {doc.expires_at || 'No expiration recorded'}</div>
                      {doc.rejection_reason && <div style={{ color: 'var(--status-danger)' }}><strong>Rejection Reason:</strong> {doc.rejection_reason}</div>}
                    </div>

                    {doc.document_url && (
                      <div style={{ marginTop: 12, textAlign: 'center' }}>
                        <a href={doc.document_url} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 600 }}>
                          View Full Document Image ↗
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                    {doc.status !== 'approved' && (
                      <button
                        className="btn btn-success btn-xs"
                        onClick={() => handleApproveDoc(doc.id)}
                        disabled={actionLoading}
                        style={{ flex: 1 }}
                      >
                        <Check size={12} /> Approve Doc
                      </button>
                    )}
                    {doc.status !== 'rejected' && (
                      <button
                        className="btn btn-danger btn-xs"
                        onClick={() => { setRejectReasonModal({ type: 'doc', docId: doc.id }); setRejectReason(''); }}
                        disabled={actionLoading}
                        style={{ flex: 1 }}
                      >
                        <XCircle size={12} /> Reject Doc
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PENDING APPROVAL VIEW ──────────────────────── */}
      {activeTab === 'pending' && (
        <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>Driver Onboarding & Verification Checklist</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                Verify all credentials before approving driver onto RaahGo live platform
              </p>
            </div>
            <StatusBadge status={driver.verification_status || 'pending'} />
          </div>

          {/* ── KYC LIFECYCLE FLOW PIPELINE ── */}
          <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 14, border: '1px solid var(--border-color)' }}>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-muted)', marginBottom: 12 }}>
              🔄 KYC Verification & Online Access Lifecycle
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, fontSize: 12 }}>
              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <strong>1. Registration & Uploads</strong>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Profile, vehicle & documents submitted
                </p>
                <span className="badge badge-success" style={{ marginTop: 6, fontSize: 10 }}>Completed</span>
              </div>

              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <strong>2. Admin Review</strong>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {pendingDocs.length === 0 ? 'All docs reviewed' : `${pendingDocs.length} doc(s) pending`}
                </p>
                <span className={`badge ${pendingDocs.length === 0 ? 'badge-success' : 'badge-warning'}`} style={{ marginTop: 6, fontSize: 10 }}>
                  {pendingDocs.length === 0 ? 'Review Complete' : 'In Review'}
                </span>
              </div>

              <div style={{
                padding: 10,
                background: driver.verification_status === 'approved' ? 'rgba(72, 187, 120, 0.1)' : (driver.verification_status === 'rejected' ? 'rgba(245, 101, 101, 0.1)' : 'var(--bg-card)'),
                borderRadius: 8,
                border: driver.verification_status === 'approved' ? '1px solid var(--accent-green)' : (driver.verification_status === 'rejected' ? '1px solid var(--accent-pink)' : '1px solid var(--border-color)')
              }}>
                <strong>3. Decision Outcome</strong>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {driver.verification_status === 'approved' && '✅ Approved — Driver can go ONLINE'}
                  {driver.verification_status === 'rejected' && '❌ Rejected — Blocked from ONLINE'}
                  {driver.verification_status !== 'approved' && driver.verification_status !== 'rejected' && '⏳ Pending Admin Decision'}
                </p>
                <span className={`badge ${driver.verification_status === 'approved' ? 'badge-success' : (driver.verification_status === 'rejected' ? 'badge-danger' : 'badge-warning')}`} style={{ marginTop: 6, fontSize: 10 }}>
                  {driver.verification_status === 'approved' ? 'Online Permitted' : 'Online Blocked'}
                </span>
              </div>

              <div style={{ padding: 10, background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <strong>4. Next Steps</strong>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  {driver.verification_status === 'approved' ? 'Ready to accept ride requests' : (driver.verification_status === 'rejected' ? 'Driver must fix & re-upload docs' : 'Awaiting admin approval')}
                </p>
                <span className="badge badge-primary" style={{ marginTop: 6, fontSize: 10 }}>
                  {driver.verification_status === 'approved' ? 'Active Duty' : 'Pending Fixes / Review'}
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* 1. Phone Verification */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
              <div>
                <strong>1. Phone & OTP Verification</strong>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Mobile: <strong>{driver.phone || driver.phone_number || '—'}</strong>
                </p>
              </div>
              <span className={`badge ${driver.is_phone_verified ? 'badge-success' : 'badge-warning'}`}>
                {driver.is_phone_verified ? 'OTP Verified' : 'Pending OTP Verification'}
              </span>
            </div>

            {/* 2. Email Verification */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
              <div>
                <strong>2. Email Address</strong>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Email: <strong>{driver.email || '—'}</strong>
                </p>
              </div>
              <span className={`badge ${driver.is_email_verified ? 'badge-success' : 'badge-warning'}`}>
                {driver.is_email_verified ? 'Email Verified' : 'Unverified'}
              </span>
            </div>

            {/* 3. Driving License Record */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
              <div>
                <strong>3. Driving License Record</strong>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  License No: <strong style={{ fontFamily: 'monospace' }}>{driver.license_number || '—'}</strong>
                  {driver.license_expiry && ` (Expires: ${driver.license_expiry})`} · Experience: <strong>{driver.experience_years ?? 0} yrs</strong>
                </p>
              </div>
              <span className={`badge ${driver.license_number && driver.license_number !== '—' ? 'badge-success' : 'badge-danger'}`}>
                {driver.license_number && driver.license_number !== '—' ? 'License on File' : 'Missing License'}
              </span>
            </div>

            {/* 4. KYC & Uploaded Documents Verification */}
            <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>4. Uploaded KYC Documents ({documents.length})</strong>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {pendingDocs.length === 0 && documents.length > 0
                      ? 'All documents approved'
                      : `${pendingDocs.length} document(s) awaiting admin review`}
                  </p>
                </div>
                <span className={`badge ${pendingDocs.length === 0 && documents.length > 0 ? 'badge-success' : 'badge-warning'}`}>
                  {pendingDocs.length === 0 && documents.length > 0 ? 'All Documents Approved' : `${pendingDocs.length} Pending Review`}
                </span>
              </div>

              {documents.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {documents.map((doc) => (
                    <span
                      key={doc.id}
                      style={{
                        fontSize: 11,
                        padding: '3px 8px',
                        borderRadius: 6,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6
                      }}
                    >
                      <strong>{doc.document_type}:</strong>
                      <StatusBadge status={doc.status} />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 5. Registered Vehicles */}
            <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>5. Vehicle Assignment & Inspection</strong>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {(() => {
                      const activeVehicles = (driver.vehicles || []).filter(v => v.is_active);
                      if (activeVehicles.length === 0) return '0 active vehicles (Registration incomplete)';
                      if (activeVehicles.length === 1) return `1 active vehicle assigned: ${activeVehicles[0].make} ${activeVehicles[0].model} (${activeVehicles[0].registration_number})`;
                      return `❌ Warning: ${activeVehicles.length} active vehicles detected (Max 1 allowed)`;
                    })()}
                  </p>
                </div>
                {(() => {
                  const activeVehicles = (driver.vehicles || []).filter(v => v.is_active);
                  if (activeVehicles.length === 1 && activeVehicles[0].is_approved) {
                    return <span className="badge badge-success">1 Active Vehicle Approved</span>;
                  }
                  if (activeVehicles.length === 1) {
                    return <span className="badge badge-warning">1 Vehicle Pending Approval</span>;
                  }
                  if (activeVehicles.length === 0) {
                    return <span className="badge badge-warning">0 Vehicles (Incomplete)</span>;
                  }
                  return <span className="badge badge-danger">2+ Active (Not Allowed)</span>;
                })()}
              </div>

              {driver.vehicles && driver.vehicles.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                  {driver.vehicles.map((v) => (
                    <div
                      key={v.id}
                      style={{
                        fontSize: 11,
                        padding: '6px 10px',
                        borderRadius: 8,
                        background: 'var(--bg-card)',
                        border: v.is_active ? '1px solid var(--accent-primary)' : '1px solid var(--border-color)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        opacity: v.is_active ? 1 : 0.7
                      }}
                    >
                      <span>{v.make} {v.model} ({v.vehicle_type})</span>
                      <strong style={{ background: '#FFD93D', color: '#000', padding: '1px 5px', borderRadius: 4, fontFamily: 'monospace' }}>
                        {v.registration_number}
                      </strong>
                      <span className={`badge ${v.is_active ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: 10 }}>
                        {v.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <StatusBadge status={v.is_approved ? 'approved' : 'pending'} />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 6. Bank Account Verification */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
              <div>
                <strong>6. Payout Bank Account</strong>
                <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  {driver.bank_accounts && driver.bank_accounts.length > 0 ? (
                    <span>
                      {driver.bank_accounts[0].bank_name} · A/C: <strong>{driver.bank_accounts[0].account_number}</strong> (IFSC: {driver.bank_accounts[0].ifsc_code})
                    </span>
                  ) : (
                    'No bank account linked yet'
                  )}
                </p>
              </div>
              <span className={`badge ${driver.bank_accounts && driver.bank_accounts.length > 0 ? 'badge-success' : 'badge-warning'}`}>
                {driver.bank_accounts && driver.bank_accounts.length > 0 ? 'Account Linked' : 'Pending Bank Details'}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-color)' }}>
            <button
              className="btn btn-success"
              onClick={handleApproveDriver}
              disabled={actionLoading}
              style={{ flex: 1 }}
            >
              <CheckCircle size={16} /> Finalize & Approve Driver
            </button>
            <button
              className="btn btn-danger"
              onClick={() => { setRejectReasonModal({ type: 'driver' }); setRejectReason(''); }}
              disabled={actionLoading}
              style={{ flex: 1 }}
            >
              <XCircle size={16} /> Reject Application
            </button>
          </div>
        </div>
      )}

      {/* ── TAB 4: VEHICLES ───────────────────────────────────── */}
      {activeTab === 'vehicles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Registered Vehicles</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Platform Policy: A driver can have at most <strong>1 active vehicle</strong> assigned at any time.
              </p>
            </div>
          </div>

          {driver.vehicles && driver.vehicles.length > 0 ? (
            <div className="grid-2" style={{ gap: 16 }}>
              {driver.vehicles.map((v) => (
                <div
                  key={v.id}
                  className="card"
                  style={{
                    padding: 20,
                    border: v.is_active ? '1.5px solid var(--accent-primary)' : '1px solid var(--border-color)',
                    position: 'relative'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 800, margin: 0 }}>{v.make} {v.model}</h4>
                      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                        <span className="badge badge-primary">{v.vehicle_type}</span>
                        <span className={`badge ${v.is_active ? 'badge-success' : 'badge-secondary'}`}>
                          {v.is_active ? '● Active in Service' : 'Inactive / Standby'}
                        </span>
                      </div>
                    </div>
                    <div style={{ background: '#FFD93D', color: '#000', padding: '4px 10px', borderRadius: 6, fontWeight: 900, fontFamily: 'monospace', fontSize: 14 }}>
                      {v.registration_number}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, color: 'var(--text-muted)' }}>
                    <div>Color: <strong style={{ color: 'var(--text-primary)' }}>{v.color || 'White'}</strong> · Year: <strong style={{ color: 'var(--text-primary)' }}>{v.year || 2022}</strong></div>
                    <div>Approval Status: <StatusBadge status={v.is_approved ? 'approved' : 'pending'} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: 20 }}>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                No registered vehicles on file (0 vehicles — registration incomplete).
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 5: RECENT RIDES ────────────────────────────────── */}
      {activeTab === 'rides' && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Completed Trips</h3>
          {driver.recent_rides && driver.recent_rides.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {driver.recent_rides.map((ride) => (
                <div key={ride.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-secondary)', borderRadius: 10, fontSize: 12 }}>
                  <div>
                    <strong>Ride #{typeof ride.id === 'string' ? ride.id.substring(0, 8) : ride.id}</strong>
                    <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                      {ride.pickup_address} ➔ {ride.dropoff_address}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <strong style={{ color: 'var(--status-active)', fontSize: 13 }}>₹{ride.total_fare || ride.fare || 0}</strong>
                    <div style={{ marginTop: 2 }}><StatusBadge status={ride.status} /></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>No recent ride history recorded for this driver.</p>
          )}
        </div>
      )}

      {/* ── TAB 6: NOTIFICATIONS & ALERTS ──────────────────────── */}
      {activeTab === 'notifications' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid-3" style={{ gap: 12 }}>
            <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Alerts Sent</span>
              <h3 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0 0' }}>{(driver.notifications || []).length}</h3>
            </div>
            <div style={{ padding: 14, background: 'rgba(16, 185, 129, 0.08)', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              <span style={{ fontSize: 11, color: 'var(--status-active)', fontWeight: 700, textTransform: 'uppercase' }}>🟢 Read by Driver</span>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-active)', margin: '4px 0 0 0' }}>
                {(driver.notifications || []).filter(n => n.is_read).length}
              </h3>
            </div>
            <div style={{ padding: 14, background: 'rgba(245, 158, 11, 0.08)', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
              <span style={{ fontSize: 11, color: 'var(--accent-yellow)', fontWeight: 700, textTransform: 'uppercase' }}>🟡 Unread / Pending</span>
              <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-yellow)', margin: '4px 0 0 0' }}>
                {(driver.notifications || []).filter(n => !n.is_read).length}
              </h3>
            </div>
          </div>

          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BellRing size={18} /> Captain Push Alerts & Real-Time Read Status ({(driver.notifications || []).length})
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  ● Auto-syncing status in real-time from driver partner mobile app
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={refetch}>
                  <RefreshCw size={13} /> Refresh Status
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setNotifModal({ isOpen: true, title: '', body: '', type: 'System' })}
                >
                  <Send size={13} /> Send Push Alert
                </button>
              </div>
            </div>

            {(driver.notifications || []).length === 0 ? (
              <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                <BellRing size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No push alerts dispatched to this driver yet.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Alert Title & Message</th>
                      <th>Category</th>
                      <th>Read Status</th>
                      <th>Dispatched At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(driver.notifications || []).map(n => (
                      <tr key={n.id}>
                        <td style={{ maxWidth: 360 }}>
                          <strong style={{ fontSize: 13, display: 'block', color: 'var(--text-primary)' }}>{n.title}</strong>
                          <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{n.body}</p>
                        </td>
                        <td>
                          <span className="badge badge-active" style={{ fontSize: 11 }}>{n.type}</span>
                        </td>
                        <td>
                          {n.is_read ? (
                            <span
                              className="badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: 'var(--status-active)',
                                border: '1px solid rgba(16, 185, 129, 0.35)',
                                fontWeight: 700,
                                fontSize: 11
                              }}
                            >
                              <CheckCircle size={13} /> Read by Driver
                            </span>
                          ) : (
                            <span
                              className="badge"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: 'var(--accent-yellow)',
                                border: '1px solid rgba(245, 158, 11, 0.35)',
                                fontWeight: 700,
                                fontSize: 11
                              }}
                            >
                              <Clock size={13} /> Unread
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{n.created_at}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Reason Modal */}
      {rejectReasonModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ maxWidth: 400, width: '100%', padding: 24, borderRadius: 16 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 12px 0' }}>
              {rejectReasonModal.type === 'driver' ? 'Reject Driver Application' : 'Reject Document'}
            </h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              Please specify the reason for rejection so the driver can correct it:
            </p>
            <textarea
              className="form-control"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Document image is blurry or expired"
              rows={3}
              style={{ resize: 'none', marginBottom: 16 }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setRejectReasonModal(null)}>Cancel</button>
              <button
                className="btn btn-danger btn-sm"
                onClick={rejectReasonModal.type === 'driver' ? handleRejectDriver : handleRejectDoc}
                disabled={actionLoading}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Send Push Notification Modal ───────────────────────── */}
      {notifModal.isOpen && (
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'rgba(16, 185, 129, 0.15)',
                color: 'var(--accent-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <BellRing size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Send Push Alert to Captain</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Target: <strong>{driver.name || driver.full_name || driver.username}</strong> ({driver.license_number || 'Driver'})
                </span>
              </div>
            </div>
          }
          onClose={() => setNotifModal({ isOpen: false, title: '', body: '', type: 'System' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Smartphone size={14} /> Broadcasts directly to Driver Partner App
              </span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setNotifModal({ isOpen: false, title: '', body: '', type: 'System' })}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSendNotification}
                  disabled={actionLoading || !notifModal.title.trim() || !notifModal.body.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {actionLoading ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                  {actionLoading ? 'Dispatching...' : 'Send Push Alert'}
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
            {/* Quick Templates for Drivers */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sparkles size={13} color="var(--accent-yellow)" /> Quick Captain Templates
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  {
                    label: '🎯 Daily Target Incentive',
                    title: 'Complete 8 Rides Today & Earn ₹300 Bonus!',
                    body: 'High demand today! Complete 8 completed trips during peak hours to unlock an instant ₹300 cash bonus in your wallet.',
                    type: 'Promotional'
                  },
                  {
                    label: '⚡ Surge Zone Alert',
                    title: 'High Demand & Surge Active in Cyber City',
                    body: '1.4x Surge multiplier active in Sector 29 & DLF Cyber Hub. Move to this zone for swift back-to-back bookings.',
                    type: 'System'
                  },
                  {
                    label: '📄 Document Verification Notice',
                    title: 'Action Required: Vehicle Document Update',
                    body: 'Please review your uploaded vehicle insurance / RC in the documents tab to avoid interruption of duty.',
                    type: 'System'
                  },
                  {
                    label: '💰 Payout Processed',
                    title: 'Weekly Payout Successfully Initiated',
                    body: 'Your weekly earnings payout has been processed and transferred to your linked bank account.',
                    type: 'Payment'
                  }
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNotifModal(prev => ({ ...prev, title: tmpl.title, body: tmpl.body, type: tmpl.type }))}
                    className="btn btn-secondary btn-xs"
                    style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 20 }}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Category Selector Pills */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 6 }}>
                Alert Category
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { key: 'System', label: '📢 System', desc: 'Duty & operations' },
                  { key: 'Promotional', label: '🎯 Incentive', desc: 'Bonuses & targets' },
                  { key: 'Booking', label: '🚗 Ride', desc: 'Trip instructions' },
                  { key: 'Payment', label: '💳 Payout', desc: 'Earnings & settlements' }
                ].map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    onClick={() => setNotifModal(prev => ({ ...prev, type: cat.key }))}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: notifModal.type === cat.key ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                      background: notifModal.type === cat.key ? 'rgba(16, 185, 129, 0.12)' : 'var(--bg-secondary)',
                      color: notifModal.type === cat.key ? 'var(--accent-primary)' : 'var(--text-primary)',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 800 }}>{cat.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{cat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Title Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Alert Title</label>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notifModal.title.length}/80</span>
              </div>
              <input
                type="text"
                maxLength={80}
                className="form-control"
                placeholder="e.g. Surge active in your zone!"
                value={notifModal.title}
                onChange={e => setNotifModal(prev => ({ ...prev, title: e.target.value }))}
                style={{ fontSize: 13, fontWeight: 600 }}
              />
            </div>

            {/* Message Body Input */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 700 }}>Message Content</label>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notifModal.body.length}/250</span>
              </div>
              <textarea
                className="form-control"
                rows={3}
                maxLength={250}
                placeholder="Type the message to send to the driver..."
                value={notifModal.body}
                onChange={e => setNotifModal(prev => ({ ...prev, body: e.target.value }))}
                style={{ fontSize: 13, lineHeight: 1.5 }}
              />
            </div>

            {/* Live Push Notification Preview Card */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Live Push Preview (Driver Device)
              </label>
              <div style={{
                background: 'linear-gradient(135deg, rgba(6, 59, 40, 0.3) 0%, rgba(15, 23, 42, 0.5) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: 14,
                padding: '12px 14px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 6,
                      background: 'var(--accent-primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 11, fontWeight: 900
                    }}>
                      R
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>RaahGo Partner</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>• Just now</span>
                  </div>
                  <span className="badge badge-active" style={{ fontSize: 10, textTransform: 'uppercase', padding: '2px 8px' }}>
                    {notifModal.type || 'System'}
                  </span>
                </div>
                <p style={{ margin: '0 0 3px 0', fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {notifModal.title || 'Notification Title Preview'}
                </p>
                <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                  {notifModal.body || 'The push notification alert that will pop up on the captain device during or outside active duty...'}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Common Accessible Alert Modal */}
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
