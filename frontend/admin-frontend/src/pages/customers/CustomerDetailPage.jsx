import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Ban, CheckCircle, XCircle, Star, Phone, Mail, MapPin,
  Car, FileText, Shield, Clock, AlertTriangle, Wallet, User, Calendar,
  Check, RefreshCw, Send, Bell, Tag, Headphones, AlertCircle, Smartphone,
  Users, Activity, Key, CreditCard, Navigation, ChevronRight, Copy, Plus, Minus,
  Sparkles, BellRing, MessageSquare, ShieldCheck, LogOut
} from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import AlertModal from '../../components/shared/AlertModal';
import Modal from '../../components/shared/Modal';
import DataTable from '../../components/shared/DataTable';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { customersAPI } from '../../api/client';

export default function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'status';
  const [activeTab, setActiveTab] = useState(initialTab);

  const { data: customer, loading, error, refetch } = useApi(
    () => customersAPI.get(id), [id]
  );

  const [actionLoading, setActionLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Modals state
  const [walletModal, setWalletModal] = useState({ isOpen: false, type: 'credit', amount: '', reason: '' });
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

  const VALID_TABS = [
    'status', 'profile', 'security', 'addresses', 'rides', 'active_ride',
    'payments', 'wallet', 'coupons', 'support', 'ratings', 'emergency',
    'notifications', 'devices', 'referral', 'audit'
  ];

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && VALID_TABS.includes(tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Block & Unblock Handlers
  const handleBlockCustomer = () => {
    showAlert(
      'Are you sure you want to block and suspend this customer account? They will not be able to book rides.',
      'Block Customer Confirmation',
      'error',
      'Yes, Block User',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await customersAPI.block(id);
          await refetch();
          showAlert('Customer account has been blocked and suspended.', 'User Blocked', 'error');
        } catch {
          showAlert('Failed to block customer. Please try again.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleUnblockCustomer = () => {
    showAlert(
      'Are you sure you want to unblock this user account? The user will be restored to active status.',
      'Unblock Customer Confirmation',
      'info',
      'Yes, Unblock User',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await customersAPI.unblock(id);
          await refetch();
          showAlert('Customer account has been unblocked and reactivated.', 'User Reactivated', 'success');
        } catch {
          showAlert('Failed to unblock customer.', 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // Wallet Adjustment Handler
  const handleWalletAdjust = async () => {
    const amt = parseFloat(walletModal.amount);
    if (isNaN(amt) || amt <= 0) {
      showAlert('Please enter a valid positive amount.', 'Invalid Amount', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await customersAPI.adjustWallet(id, {
        amount: amt,
        type: walletModal.type,
        reason: walletModal.reason || `Admin manual ${walletModal.type}`
      });
      setWalletModal({ isOpen: false, type: 'credit', amount: '', reason: '' });
      await refetch();
      showAlert(`Wallet balance successfully ${walletModal.type === 'credit' ? 'credited' : 'debited'} by ₹${amt}.`, 'Wallet Updated', 'success');
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.message || 'Failed to adjust wallet. Please check balance and try again.';
      showAlert(errMsg, 'Wallet Adjustment Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Send Notification Handler
  const handleSendNotification = async () => {
    if (!notifModal.title.trim() || !notifModal.body.trim()) {
      showAlert('Please fill in both title and message body.', 'Incomplete Data', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await customersAPI.sendNotification(id, notifModal);
      setNotifModal({ isOpen: false, title: '', body: '', type: 'System' });
      await refetch();
      showAlert('Notification successfully dispatched to customer.', 'Notification Sent', 'success');
    } catch {
      showAlert('Failed to send notification. Please try again.', 'Error', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Terminate / Invalidate Device Session
  const handleTerminateDevice = (deviceId, deviceName) => {
    showAlert(
      `Are you sure you want to terminate session on "${deviceName}"? The user will be immediately logged out on that device.`,
      'Force Logout Device',
      'warning',
      'Yes, Force Logout',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await customersAPI.terminateDevice(id, deviceId);
          await refetch();
          showAlert('Device session terminated successfully. The user has been logged out.', 'Session Terminated', 'success');
        } catch (e) {
          const msg = e?.response?.data?.error || 'Failed to terminate session.';
          showAlert(msg, 'Error', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  if (loading) return <LoadingState text="Loading customer details..." />;
  if (error || !customer) return <ErrorState message={error || 'Customer not found'} onRetry={refetch} />;

  const isBlocked = customer.status === 'blocked' || !customer.is_active;
  const addresses = customer.addresses || [];
  const rides = customer.rides || [];
  const activeRide = customer.active_ride;
  const payments = customer.payments || [];
  const walletTxs = customer.wallet_transactions || [];
  const coupons = customer.coupons || [];
  const complaints = customer.complaints || [];
  const ratings = customer.ratings || [];
  const emergencyContacts = customer.emergency_contacts || [];
  const notifications = customer.notifications || [];
  const devices = customer.devices || [];
  const referral = customer.referral || { code: '—', total_referred: 0, bonus_earned: 0, friends: [] };
  const auditLogs = customer.audit_logs || [];
  const otpLogs = customer.otp_logs || [];

  const SIDEBAR_ITEMS = [
    { key: 'status', label: 'Header / Status', icon: Activity, count: isBlocked ? 'Blocked' : 'Active', color: isBlocked ? 'var(--status-suspended)' : 'var(--status-active)' },
    { key: 'profile', label: 'Customer Profile', icon: User },
    { key: 'security', label: 'Account & Security', icon: Shield, count: customer.is_phone_verified ? 'Verified' : 'Pending' },
    { key: 'addresses', label: 'Addresses', icon: MapPin, count: addresses.length },
    { key: 'rides', label: 'Ride History', icon: Car, count: rides.length },
    { key: 'active_ride', label: 'Active Ride', icon: Navigation, badge: activeRide ? 'Live' : null, color: 'var(--accent-primary)' },
    { key: 'payments', label: 'Payments', icon: CreditCard, count: payments.length },
    { key: 'wallet', label: 'Wallet', icon: Wallet, count: `₹${customer.wallet_balance ?? 0}` },
    { key: 'coupons', label: 'Coupons & Offers', icon: Tag, count: coupons.length },
    { key: 'support', label: 'Complaints / Support', icon: Headphones, count: complaints.length },
    { key: 'ratings', label: 'Ratings & Reviews', icon: Star, count: `${customer.average_rating || 5.0}★` },
    { key: 'emergency', label: 'Emergency / SOS', icon: AlertCircle, count: emergencyContacts.length },
    { key: 'notifications', label: 'Notifications', icon: Bell, count: notifications.length },
    { key: 'devices', label: 'Devices', icon: Smartphone, count: devices.length },
    { key: 'referral', label: 'Referral', icon: Users, count: referral.total_referred || 0 },
    { key: 'audit', label: 'Admin Activity / Audit', icon: FileText, count: auditLogs.length },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── Top Bar / Action Controls ────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => navigate('/customers')}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <ArrowLeft size={14} /> Back to Users
        </button>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={refetch} disabled={actionLoading}>
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setNotifModal({ isOpen: true, title: '', body: '', type: 'System' })}
          >
            <Send size={14} /> Send Push
          </button>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setWalletModal({ isOpen: true, type: 'credit', amount: '', reason: '' })}
          >
            <Wallet size={14} /> Adjust Wallet
          </button>

          {isBlocked ? (
            <button
              className="btn btn-success btn-sm"
              onClick={handleUnblockCustomer}
              disabled={actionLoading}
            >
              <CheckCircle size={14} /> Unblock User
            </button>
          ) : (
            <button
              className="btn btn-danger btn-sm"
              onClick={handleBlockCustomer}
              disabled={actionLoading}
            >
              <Ban size={14} /> Block User
            </button>
          )}
        </div>
      </div>

      {/* ── Customer Hero Banner ─────────────────────────────── */}
      <div className="card" style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div
              style={{
                width: 68,
                height: 68,
                borderRadius: 20,
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3B82F6 100%)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 900,
                boxShadow: '0 8px 18px rgba(0,0,0,0.12)'
              }}
            >
              {(customer.name || customer.username || 'C').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
                  {customer.name || customer.full_name || customer.username}
                </h1>
                <StatusBadge status={customer.status} />
                <span className={`badge ${customer.is_phone_verified ? 'badge-active' : 'badge-suspended'}`} style={{ fontSize: 11 }}>
                  {customer.is_phone_verified ? '✓ Phone Verified' : 'Phone Unverified'}
                </span>
                {customer.is_email_verified && (
                  <span className="badge badge-active" style={{ fontSize: 11 }}>
                    ✓ Email Verified
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6, fontSize: 13, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  ID: <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>#{customer.id.substring(0, 8)}</code>
                  <button onClick={handleCopyId} className="btn-ghost" style={{ padding: '2px 4px', border: 'none', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)' }} title="Copy full ID">
                    <Copy size={12} />
                  </button>
                  {copiedId && <span style={{ color: 'var(--status-active)', fontSize: 11 }}>Copied!</span>}
                </span>
                <span>•</span>
                <span>Joined: <strong>{customer.date_joined || '—'}</strong></span>
                <span>•</span>
                <span>City: <strong>{customer.city || 'Delhi'}</strong></span>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                {customer.total_rides ?? 0}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Rides</span>
            </div>

            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-active)' }}>
                ₹{customer.total_spent ?? 0}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Spent</span>
            </div>

            <div style={{ textAlign: 'center', padding: '0 16px', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--accent-primary)' }}>
                ₹{customer.wallet_balance ?? 0}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Wallet</span>
            </div>

            <div style={{ textAlign: 'center', padding: '0 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: 'var(--accent-yellow)', fontSize: 18, fontWeight: 800 }}>
                <Star size={18} fill="currentColor" /> {Number(customer.average_rating || 5.0).toFixed(1)}
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Rating</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Layout: Inner Navigation Sidebar + Content Panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* ── Left Sticky Inner Navigation Sidebar ────────────────── */}
        <div className="card" style={{ padding: 12, borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-color)', position: 'sticky', top: 20 }}>
          <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.8 }}>
            Customer Navigation
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => switchTab(item.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-secondary)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Icon size={16} color={isActive ? '#ffffff' : (item.color || 'var(--text-muted)')} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: isActive ? 'white' : 'var(--accent-pink)',
                      color: isActive ? 'var(--accent-primary)' : 'white'
                    }}>
                      {item.badge}
                    </span>
                  )}

                  {item.count !== undefined && !item.badge && (
                    <span style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: isActive ? '#ffffff' : 'var(--text-muted)',
                      opacity: 0.9
                    }}>
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right Content Area According to Selected Tab ────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* 1. HEADER / STATUS TAB */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="grid-3" style={{ gap: 16 }}>
                <div className="card" style={{ padding: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Account Health</span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: isBlocked ? 'var(--status-suspended)' : 'var(--status-active)', margin: '6px 0 0 0' }}>
                    {isBlocked ? 'Suspended / Blocked' : 'Good & Active'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    {isBlocked ? 'User is restricted from platform' : 'No active fraud flags detected'}
                  </p>
                </div>
                <div className="card" style={{ padding: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Ride Completion Rate</span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-primary)', margin: '6px 0 0 0' }}>
                    {customer.total_rides > 0 ? `${Math.round(((customer.completed_rides || 0) / customer.total_rides) * 100)}%` : '100%'}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    {customer.completed_rides || 0} completed · {customer.cancelled_rides || 0} cancelled
                  </p>
                </div>
                <div className="card" style={{ padding: 16 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Avg Customer Rating</span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-yellow)', margin: '6px 0 0 0' }}>
                    {customer.average_rating || 5.0} / 5.0 ★
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                    Based on driver feedback & rides
                  </p>
                </div>
              </div>

              <div className="grid-2" style={{ gap: 20 }}>
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Activity size={16} /> Account Status & Overview
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                      <StatusBadge status={customer.status} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Registration Date:</span>
                      <strong>{customer.date_joined}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Last Active Login:</span>
                      <span>{customer.last_login || 'Recent'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Phone Verification:</span>
                      <span style={{ color: customer.is_phone_verified ? 'var(--status-active)' : 'var(--accent-yellow)', fontWeight: 600 }}>
                        {customer.is_phone_verified ? '✓ Verified' : 'Pending Verification'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Email Verification:</span>
                      <span style={{ color: customer.is_email_verified ? 'var(--status-active)' : 'var(--text-muted)', fontWeight: 600 }}>
                        {customer.is_email_verified ? '✓ Verified' : 'Not Verified'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} /> Quick Admin Actions
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: 'flex-start', gap: 8 }}
                      onClick={() => setWalletModal({ isOpen: true, type: 'credit', amount: '', reason: '' })}
                    >
                      <Plus size={14} color="var(--status-active)" /> Credit Customer Wallet
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: 'flex-start', gap: 8 }}
                      onClick={() => setWalletModal({ isOpen: true, type: 'debit', amount: '', reason: '' })}
                    >
                      <Minus size={14} color="var(--accent-pink)" /> Debit Customer Wallet
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ justifyContent: 'flex-start', gap: 8 }}
                      onClick={() => setNotifModal({ isOpen: true, title: '', body: '', type: 'System' })}
                    >
                      <Bell size={14} color="var(--accent-primary)" /> Broadcast Direct Push Message
                    </button>
                    {isBlocked ? (
                      <button
                        className="btn btn-success btn-sm"
                        style={{ justifyContent: 'flex-start', gap: 8 }}
                        onClick={handleUnblockCustomer}
                      >
                        <CheckCircle size={14} /> Unblock Customer Account
                      </button>
                    ) : (
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ justifyContent: 'flex-start', gap: 8 }}
                        onClick={handleBlockCustomer}
                      >
                        <Ban size={14} /> Suspend / Block Customer Account
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. CUSTOMER PROFILE TAB */}
          {activeTab === 'profile' && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <User size={18} /> Customer Personal Profile Information
              </h3>
              <div className="grid-2" style={{ gap: 20, fontSize: 13 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Full Name</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customer.name || customer.full_name || '—'}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Username</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>@{customer.username || 'customer'}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Mobile Phone Number</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customer.phone || customer.phone_number || '—'}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Email Address</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customer.email || '—'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Gender</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customer.gender || 'Not Specified'}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Date of Birth</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customer.date_of_birth || '—'}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Primary Operating City & State</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customer.city || 'Delhi'}, {customer.state || 'India'}</div>
                  </div>
                  <div style={{ padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>Account Role & Type</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>{customer.role || 'Customer'} (Passenger App User)</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. ACCOUNT & SECURITY TAB */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              

              {/* OTP Verifications Log */}
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={16} /> Recent OTP Verifications & Security Audit
                </h3>
                {otpLogs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No recent OTP records recorded.</p>
                ) : (
                  <table className="table" style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Purpose</th>
                        <th>Target Phone / Email</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Timestamp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {otpLogs.map(otp => (
                        <tr key={otp.id}>
                          <td><strong>{otp.purpose}</strong></td>
                          <td><code>{otp.target}</code></td>
                          <td>
                            <span className={`badge ${otp.is_verified ? 'badge-active' : 'badge-suspended'}`}>
                              {otp.is_verified ? 'Verified' : 'Expired/Failed'}
                            </span>
                          </td>
                          <td>{otp.attempts} attempts</td>
                          <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>{otp.created_at}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* 4. ADDRESSES TAB */}
          {activeTab === 'addresses' && (
            <div className="card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <MapPin size={18} /> Saved Customer Addresses ({addresses.length})
                </h3>
              </div>

              {addresses.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <MapPin size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No saved addresses for this customer yet.</p>
                </div>
              ) : (
                <div className="grid-2" style={{ gap: 16 }}>
                  {addresses.map(addr => (
                    <div key={addr.id} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <MapPin size={14} color="var(--accent-primary)" /> {addr.title}
                        </span>
                        {addr.is_default && (
                          <span className="badge badge-active" style={{ fontSize: 10 }}>Default</span>
                        )}
                      </div>
                      <p style={{ fontSize: 13, margin: '4px 0', lineHeight: 1.5 }}>{addr.address_line_1}</p>
                      {addr.address_line_2 && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0' }}>{addr.address_line_2}</p>}
                      {addr.landmark && <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0' }}>Landmark: <strong>{addr.landmark}</strong></p>}
                      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                        <span>{addr.city}, {addr.state} - {addr.postal_code}</span>
                        {addr.latitude && <span>({addr.latitude.toFixed(4)}, {addr.longitude?.toFixed(4)})</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 5. RIDE HISTORY TAB */}
          {activeTab === 'rides' && (
            <div className="card" style={{ paddingTop: 10, paddingBottom: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 7, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Car size={18} /> Complete Ride Booking History ({rides.length})
              </h3>
              {rides.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Car size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No ride history found for this customer.</p>
                </div>
              ) : (
                <DataTable
                  maxHeight="480px"
                  stickyHeader
                  columns={[
                    { key: 'booking_number', label: 'Booking #', render: v => <strong>#{v}</strong> },
                    { key: 'pickup_address', label: 'Route', render: (v, r) => (
                      <div style={{ fontSize: 12 }}>
                        <div><strong>From:</strong> {v?.length > 35 ? v.substring(0, 35) + '...' : v}</div>
                        <div style={{ color: 'var(--text-muted)' }}><strong>To:</strong> {r.dropoff_address?.length > 35 ? r.dropoff_address.substring(0, 35) + '...' : r.dropoff_address}</div>
                      </div>
                    )},
                    { key: 'driver_name', label: 'Driver', render: (v, r) => (
                      <div style={{ fontSize: 12 }}>
                        <strong>{v}</strong>
                        <div style={{ color: 'var(--text-muted)' }}>{r.driver_phone}</div>
                      </div>
                    )},
                    { key: 'vehicle_type', label: 'Vehicle & Service', render: (v, r) => `${v} (${r.service})` },
                    { key: 'total_fare', label: 'Fare', render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v}</strong> },
                    { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
                    { key: 'created_at', label: 'Date', render: v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
                  ]}
                  data={rides}
                  searchKeys={['booking_number', 'pickup_address', 'dropoff_address', 'driver_name']}
                />
              )}
            </div>
          )}

          {/* 6. ACTIVE RIDE TAB */}
          {activeTab === 'active_ride' && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Navigation size={18} color="var(--accent-primary)" /> Live Active Ride Tracker
              </h3>

              {!activeRide ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Car size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
                  <h4 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>No Ongoing Ride in Progress</h4>
                  <p style={{ fontSize: 13, margin: '6px 0 0 0' }}>This customer is not currently on an active trip.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    <div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Booking Number</span>
                      <h4 style={{ fontSize: 18, fontWeight: 800, margin: '2px 0 0 0' }}>#{activeRide.booking_number}</h4>
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span className="badge badge-active" style={{ fontSize: 12, padding: '4px 10px' }}>
                        ● {activeRide.status.toUpperCase()}
                      </span>
                      <span style={{ fontSize: 13, fontWeight: 700, background: 'var(--bg-card)', padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                        PIN: {activeRide.ride_pin}
                      </span>
                    </div>
                  </div>

                  <div className="grid-2" style={{ gap: 16 }}>
                    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                      <h5 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>Route Details</h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                        <div>
                          <span style={{ color: 'var(--status-active)', fontWeight: 800 }}>● Pickup:</span> {activeRide.pickup_address}
                        </div>
                        <div>
                          <span style={{ color: 'var(--accent-pink)', fontWeight: 800 }}>■ Dropoff:</span> {activeRide.dropoff_address}
                        </div>
                        <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                          <span>Distance: <strong>{activeRide.distance_km} km</strong></span>
                          <span>Est. Time: <strong>{activeRide.estimated_duration_mins} mins</strong></span>
                          <span>Fare: <strong style={{ color: 'var(--status-active)' }}>₹{activeRide.fare}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                      <h5 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>Driver Details</h5>
                      {activeRide.driver ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                          <div><strong>Name:</strong> {activeRide.driver.name}</div>
                          <div><strong>Phone:</strong> {activeRide.driver.phone}</div>
                          <div><strong>Vehicle Plate:</strong> {activeRide.driver.vehicle_plate}</div>
                          <div><strong>Rating:</strong> {activeRide.driver.rating} ★</div>
                        </div>
                      ) : (
                        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Searching for matching driver nearby...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 7. PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} /> Enabled Payment Methods & Options
                </h3>
                <div className="grid-3" style={{ gap: 14 }}>
                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>⚡ UPI Payment</span>
                      <span className="badge badge-active" style={{ fontSize: 10 }}>Default</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0' }}>Google Pay, PhonePe, Paytm</p>
                    <span style={{ fontSize: 11, color: 'var(--status-active)', fontWeight: 700 }}>● Active & Verified</span>
                  </div>

                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>👛 RaahGo Wallet</span>
                      <span className="badge badge-active" style={{ fontSize: 10 }}>₹{customer.wallet_balance ?? 0}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0' }}>In-app digital balance</p>
                    <span style={{ fontSize: 11, color: 'var(--status-active)', fontWeight: 700 }}>● Instant Checkout</span>
                  </div>

                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800 }}>💵 Cash on Delivery</span>
                      <span className="badge badge-active" style={{ fontSize: 10 }}>Enabled</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0' }}>Direct payment to captain</p>
                    <span style={{ fontSize: 11, color: 'var(--status-active)', fontWeight: 700 }}>● Standard Option</span>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CreditCard size={18} /> Payment & Billing History ({payments.length})
                </h3>
                {payments.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <CreditCard size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p>No payment records found.</p>
                  </div>
                ) : (
                  <DataTable
                   maxHeight="480px"
                    stickyHeader
                    columns={[
                      { key: 'transaction_id', label: 'Txn ID', render: v => <code style={{ fontSize: 12, fontWeight: 700 }}>{v}</code> },
                      { key: 'booking_number', label: 'Booking #', render: v => <strong>#{v}</strong> },
                      { key: 'amount', label: 'Amount', render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v}</strong> },
                      { key: 'payment_method', label: 'Method', render: v => <span className="badge badge-active">{v}</span> },
                      { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
                      { key: 'paid_at', label: 'Paid Date', render: (v, r) => v || r.created_at },
                    ]}
                    data={payments}
                    searchKeys={['transaction_id', 'booking_number', 'payment_method']}
                  />
                )}
              </div>
            </div>
          )}

          {/* 8. WALLET TAB */}
          {activeTab === 'wallet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', paddingBottom:'10px' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Wallet size={16} /> Wallet Transactions Ledger ({walletTxs.length})
                  </h3>
                  <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => setWalletModal({ isOpen: true, type: 'credit', amount: '', reason: '' })}
                  >
                    <Plus size={14} /> Add Credit
                  </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setWalletModal({ isOpen: true, type: 'debit', amount: '', reason: '' })}
                    >
                      <Minus size={14} /> Debit Balance
                    </button>
                    </div>
                  </div>
                {walletTxs.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No wallet transactions recorded yet.</p>
                ) : (
                  <DataTable
                    maxHeight="480px"
                    stickyHeader  
                    columns={[
                      { key: 'created_at', label: 'Date & Time', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
                      { key: 'type', label: 'Type', render: v => (
                        <span className={`badge ${v === 'Credit' || v === 'credit' ? 'badge-active' : 'badge-suspended'}`}>
                          {v.toUpperCase()}
                        </span>
                      )},
                      { key: 'amount', label: 'Amount', render: (v, r) => (
                        <strong style={{ color: r.type === 'Credit' || r.type === 'credit' ? 'var(--status-active)' : 'var(--accent-pink)' }}>
                          {r.type === 'Credit' || r.type === 'credit' ? '+' : '-'}₹{v}
                        </strong>
                      )},
                      { key: 'reason', label: 'Description / Reason' },
                      { key: 'balance_after', label: 'Balance After', render: v => `₹${v}` },
                    ]}
                    data={walletTxs}
                    searchKeys={['reason', 'type']}
                  />
                )}
              </div>
            </div>
          )}

          {/* 9. COUPONS & OFFERS TAB */}
          {activeTab === 'coupons' && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tag size={18} /> Active Promo Codes & Available Offers ({coupons.length})
              </h3>
              {coupons.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No available coupons at this time.</p>
              ) : (
                <div className="grid-2" style={{ gap: 16 }}>
                  {coupons.map(cp => (
                    <div key={cp.id} style={{ padding: 16, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px dashed var(--accent-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <code style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-primary)' }}>{cp.code}</code>
                        <span className="badge badge-active">{cp.discount_type === 'Percentage' ? `${cp.discount_value}% OFF` : `₹${cp.discount_value} OFF`}</span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '8px 0 0 0' }}>
                        Min booking amount: ₹{cp.min_booking_amount} {cp.max_discount_amount ? `· Max cap: ₹${cp.max_discount_amount}` : ''}
                      </p>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                        Valid until: <strong>{cp.valid_until}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 10. COMPLAINTS / SUPPORT TAB */}
          {activeTab === 'support' && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Headphones size={18} /> Support Tickets & Customer Complaints ({complaints.length})
              </h3>
              {complaints.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Headphones size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No complaints or support tickets lodged by this customer.</p>
                </div>
              ) : (
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Ticket ID</th>
                      <th>Subject</th>
                      <th>Category</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th>Resolution Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complaints.map(tkt => (
                      <tr key={tkt.id}>
                        <td><strong>#{tkt.id}</strong></td>
                        <td>{tkt.subject}</td>
                        <td>{tkt.category}</td>
                        <td>
                          <span className={`badge ${tkt.priority === 'High' ? 'badge-suspended' : 'badge-active'}`}>
                            {tkt.priority}
                          </span>
                        </td>
                        <td><StatusBadge status={tkt.status} /></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{tkt.created_at}</td>
                        <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{tkt.resolution || 'Pending review'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* 11. RATINGS & REVIEWS TAB */}
          {activeTab === 'ratings' && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Star size={18} color="var(--accent-yellow)" /> Feedback & Driver Reviews Given ({ratings.length})
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 800, fontSize: 15 }}>
                  Average Given: <span style={{ color: 'var(--accent-yellow)' }}>{customer.average_rating || 5.0} ★</span>
                </div>
              </div>

              {ratings.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No ratings submitted yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {ratings.map(r => (
                    <div key={r.id} style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{r.driver_name}</strong>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)', marginLeft: 8 }}>Booking #{r.booking_number}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 2, color: 'var(--accent-yellow)' }}>
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star key={i} size={14} fill={i < r.rating ? 'currentColor' : 'none'} />
                          ))}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, margin: '8px 0 4px 0', color: 'var(--text-secondary)' }}>"{r.comment}"</p>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.created_at}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 12. EMERGENCY / SOS TAB */}
          {activeTab === 'emergency' && (
            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} color="var(--accent-pink)" /> Emergency Safety Contacts & SOS Configuration
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {emergencyContacts.map(contact => (
                  <div key={contact.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                    <div>
                      <h4 style={{ fontSize: 15, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        {contact.name}
                        {contact.is_sos && <span className="badge badge-suspended" style={{ fontSize: 10 }}>24x7 SOS</span>}
                      </h4>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Relation: {contact.relation}</p>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-pink)' }}>
                      <Phone size={14} style={{ marginRight: 4 }} /> {contact.phone}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 13. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Notification KPI Summary Cards */}
              <div className="grid-4" style={{ gap: 12 }}>
                <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Dispatched</span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0 0' }}>{notifications.length}</h3>
                </div>
                <div style={{ padding: 14, background: 'rgba(16, 185, 129, 0.08)', borderRadius: 12, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                  <span style={{ fontSize: 11, color: 'var(--status-active)', fontWeight: 700, textTransform: 'uppercase' }}>🟢 Read by Customer</span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--status-active)', margin: '4px 0 0 0' }}>
                    {notifications.filter(n => n.is_read).length}
                  </h3>
                </div>
                <div style={{ padding: 14, background: 'rgba(245, 158, 11, 0.08)', borderRadius: 12, border: '1px solid rgba(245, 158, 11, 0.25)' }}>
                  <span style={{ fontSize: 11, color: 'var(--accent-yellow)', fontWeight: 700, textTransform: 'uppercase' }}>🟡 Unread / Pending</span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent-yellow)', margin: '4px 0 0 0' }}>
                    {notifications.filter(n => !n.is_read).length}
                  </h3>
                </div>
                <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12, border: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>⚡ Read Rate</span>
                  <h3 style={{ fontSize: 20, fontWeight: 800, margin: '4px 0 0 0' }}>
                    {notifications.length > 0 ? Math.round((notifications.filter(n => n.is_read).length / notifications.length) * 100) : 100}%
                  </h3>
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Bell size={18} /> Sent Push Notifications & Real-Time Read Status ({notifications.length})
                    </h3>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      ● Auto-syncing status in real-time from customer mobile app
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
                      <Send size={13} /> Send Push Notification
                    </button>
                  </div>
                </div>

                {notifications.length === 0 ? (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Bell size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p>No notifications sent to this customer yet.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table" style={{ width: '100%', fontSize: 13 }}>
                      <thead>
                        <tr>
                          <th>Notification Title & Body</th>
                          <th>Category</th>
                          <th>Read Status</th>
                          <th>Dispatched At</th>
                        </tr>
                      </thead>
                      <tbody>
                        {notifications.map(n => (
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
                                  <CheckCircle size={13} /> Read by User
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
                                  <Clock size={13} />Unread
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

          {/* 14. DEVICES TAB */}
          {activeTab === 'devices' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Single Device Policy Alert */}
              <div style={{
                padding: 16,
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)',
                borderRadius: 14,
                border: '1px solid rgba(16, 185, 129, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--status-active)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0 }}>Single-Device Protection Active</h4>
                    <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                      Only <strong>1 active device</strong> is permitted per user. Logging in on a new phone immediately revokes access on prior terminals.
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span className="badge badge-active" style={{ fontSize: 11 }}>
                    ● 1 Active Device Permitted
                  </span>
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Smartphone size={18} /> Registered Devices & Active Mobile Sessions ({devices.length})
                  </h3>
                  <button className="btn btn-secondary btn-sm" onClick={refetch}>
                    <RefreshCw size={13} /> Refresh
                  </button>
                </div>

                {devices.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No registered mobile devices found.</p>
                ) : (
                  <table className="table" style={{ width: '100%', fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>Device Name / Model</th>
                        <th>Platform</th>
                        <th>App Version</th>
                        <th>FCM Push Token</th>
                        <th>Session Status</th>
                        <th>Last Active</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {devices.map(d => (
                        <tr key={d.id}>
                          <td>
                            <strong>{d.device_name}</strong>
                          </td>
                          <td>
                            <span className="badge badge-primary" style={{ fontSize: 11 }}>{d.device_type}</span>
                          </td>
                          <td><code>{d.app_version}</code></td>
                          <td>
                            <code style={{ fontSize: 11, background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: 4 }}>
                              {d.firebase_token}
                            </code>
                          </td>
                          <td>
                            {d.is_active ? (
                              <span className="badge badge-active" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                ● Active (Current)
                              </span>
                            ) : (
                              <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                ○ Logged Out
                              </span>
                            )}
                          </td>
                          <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{d.last_active}</td>
                          <td>
                            {d.is_active ? (
                              <button
                                className="btn btn-danger btn-xs"
                                style={{ fontSize: 11, padding: '4px 8px' }}
                                onClick={() => handleTerminateDevice(d.id, d.device_name)}
                                disabled={actionLoading}
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

          {/* 15. REFERRAL TAB */}
          {activeTab === 'referral' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 24, background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)' }}>
                <div className="grid-3" style={{ gap: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Referral Code</span>
                    <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--accent-primary)', margin: '4px 0 0 0', letterSpacing: 1 }}>
                      {referral.code}
                    </h3>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Friends Invited</span>
                    <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                      {referral.total_referred} Users
                    </h3>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Referral Rewards Earned</span>
                    <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--status-active)', margin: '4px 0 0 0' }}>
                      ₹{referral.bonus_earned}
                    </h3>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Referred Friends & Onboarding Status</h3>
                <table className="table" style={{ width: '100%', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th>Friend Name</th>
                      <th>Join Date</th>
                      <th>Status</th>
                      <th>Reward Credited</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(referral.friends || []).map((f, i) => (
                      <tr key={i}>
                        <td><strong>{f.name}</strong></td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{f.date}</td>
                        <td><span className="badge badge-active">{f.status}</span></td>
                        <td><strong style={{ color: 'var(--status-active)' }}>+₹{f.bonus}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 16. ADMIN ACTIVITY / AUDIT TAB */}
          {activeTab === 'audit' && (
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} /> Administrative Action History & System Audit Log
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {auditLogs.map(log => (
                  <div key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: 'var(--bg-secondary)', borderRadius: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{log.action}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{log.details}</div>
                    </div>
                    <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--text-muted)' }}>
                      <div>By <strong>{log.actor}</strong></div>
                      <div style={{ fontSize: 11 }}>{log.created_at}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── Adjust Wallet Modal ───────────────────────────────── */}
      {walletModal.isOpen && (
        <Modal
          title={`Adjust Wallet Balance: ${customer.name || customer.username}`}
          onClose={() => setWalletModal({ isOpen: false, type: 'credit', amount: '', reason: '' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setWalletModal({ isOpen: false, type: 'credit', amount: '', reason: '' })}>
                Cancel
              </button>
              <button className={`btn btn-sm ${walletModal.type === 'credit' ? 'btn-success' : 'btn-danger'}`} onClick={handleWalletAdjust} disabled={actionLoading}>
                {walletModal.type === 'credit' ? 'Confirm Credit' : 'Confirm Debit'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '8px 0' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                className={`btn btn-sm ${walletModal.type === 'credit' ? 'btn-success' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setWalletModal(prev => ({ ...prev, type: 'credit' }))}
              >
                + Credit (Add Money)
              </button>
              <button
                type="button"
                className={`btn btn-sm ${walletModal.type === 'debit' ? 'btn-danger' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setWalletModal(prev => ({ ...prev, type: 'debit' }))}
              >
                - Debit (Deduct Money)
              </button>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Amount (₹)</label>
              <input
                type="number"
                className="form-control"
                placeholder="Enter amount (e.g. 100)"
                value={walletModal.amount}
                onChange={e => setWalletModal(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Reason / Notes</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Promotional credit, ride refund, etc."
                value={walletModal.reason}
                onChange={e => setWalletModal(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
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
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Send Push Notification</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Dispatch directly to <strong>{customer.name || customer.username}</strong> (@{customer.username})
                </span>
              </div>
            </div>
          }
          onClose={() => setNotifModal({ isOpen: false, title: '', body: '', type: 'System' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
                <Smartphone size={14} /> Delivered to active devices & in-app inbox
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
                  {actionLoading ? 'Dispatching...' : 'Send Notification'}
                </button>
              </div>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
            {/* Quick Presets / Templates */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sparkles size={13} color="var(--accent-yellow)" /> Quick Notification Templates
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  {
                    label: '🎁 20% Promo Discount',
                    title: 'Special 20% Discount on Next 3 Rides!',
                    body: 'Use promo code RAAHGO20 at checkout and enjoy 20% off up to ₹100 on your next 3 rides.',
                    type: 'Promotional'
                  },
                  {
                    label: '🛡️ Security Verification',
                    title: 'Important: Account Security Check',
                    body: 'Please review and verify your linked mobile number and primary email to ensure account safety.',
                    type: 'System'
                  },
                  {
                    label: '🚗 Ride Confirmation',
                    title: 'Ride Scheduled Successfully',
                    body: 'Your ride has been confirmed. Your captain details and live tracking will be assigned 15 mins prior.',
                    type: 'Booking'
                  },
                  {
                    label: '💰 Cashback Credited',
                    title: '₹50 Wallet Cashback Received!',
                    body: 'Congratulations! ₹50 cashback has been credited to your RaahGo Wallet for your recent rides.',
                    type: 'Payment'
                  },
                  {
                    label: '⚡ Peak Demand Notice',
                    title: 'High Demand in Your Zone',
                    body: 'Cabs and autos are in high demand in your area. Book a few minutes early for the fastest pickup.',
                    type: 'System'
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
                Notification Category
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                {[
                  { key: 'System', label: '📢 System', desc: 'Critical alerts & news' },
                  { key: 'Promotional', label: '🎁 Promo', desc: 'Offers & coupons' },
                  { key: 'Booking', label: '🚗 Booking', desc: 'Ride status updates' },
                  { key: 'Payment', label: '💳 Payment', desc: 'Wallet & billing' }
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
                <label style={{ fontSize: 12, fontWeight: 700 }}>Notification Title</label>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notifModal.title.length}/80</span>
              </div>
              <input
                type="text"
                maxLength={80}
                className="form-control"
                placeholder="e.g. Exclusive Weekend Discount!"
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
                placeholder="Type the message to send to the customer..."
                value={notifModal.body}
                onChange={e => setNotifModal(prev => ({ ...prev, body: e.target.value }))}
                style={{ fontSize: 13, lineHeight: 1.5 }}
              />
            </div>

            {/* Live Push Notification Preview Card */}
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Live Push Preview (Mobile Device)
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
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>RaahGo</span>
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
                  {notifModal.body || 'The notification message text will be delivered immediately to customer push tray and notifications inbox...'}
                </p>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Alert Confirmation Modal ─────────────────────────── */}
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
