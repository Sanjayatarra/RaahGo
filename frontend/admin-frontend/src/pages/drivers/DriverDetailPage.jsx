import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Ban, CheckCircle, XCircle, Star, Phone, Mail, MapPin,
  Car, FileText, Shield, Clock, AlertTriangle, Wallet, User, Calendar,
  Check, RefreshCw, Send, BellRing, Sparkles, Smartphone, MessageSquare,
  ShieldCheck, LogOut, Navigation, TrendingUp, CreditCard, Layers,
  AlertOctagon, Key, FileSpreadsheet, Eye, Plus, Minus, Copy,
  ExternalLink, ChevronRight, CheckCircle2, X, Play, Fuel, Edit, Edit3
} from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import AlertModal from '../../components/shared/AlertModal';
import Modal from '../../components/shared/Modal';
import DataTable from '../../components/shared/DataTable';
import { useApi, LoadingState, ErrorState } from '../../hooks/useApi';
import { driversAPI } from '../../api/client';

function Capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Fix default marker icon assets
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const driverMapIcon = L.divIcon({
  className: '',
  html: `<div style="width:36px;height:36px;background:#FF6B35;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:2.5px solid #ffffff">🚖</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 18],
});

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
  const [copiedId, setCopiedId] = useState(false);

  // Modals state
  const [rejectDocModal, setRejectDocModal] = useState({ isOpen: false, docId: null, docType: '', reason: '' });
  const [rejectDriverModal, setRejectDriverModal] = useState({ isOpen: false, reason: '' });
  const [suspendDriverModal, setSuspendDriverModal] = useState({ isOpen: false, reason: '' });
  const [walletModal, setWalletModal] = useState({ isOpen: false, type: 'credit', amount: '', reason: '' });
  const [notifModal, setNotifModal] = useState({ isOpen: false, title: '', body: '', type: 'System' });
  const [docPreviewModal, setDocPreviewModal] = useState({ isOpen: false, url: '', title: '', type: '' });
  const [editDocModal, setEditDocModal] = useState({
    isOpen: false,
    docId: null,
    docType: '',
    documentNumber: '',
    expiresAt: '',
    documentUrl: '',
    isVerified: false,
    status: '',
    rejectionReason: '',
    type: 'driver',
    // Aadhaar fields
    aadhaar_number: '',
    name: '',
    dob: '',
    gender: 'Male',
    care_of: '',
    pincode: '',
    address: '',
    // Insurance fields
    policy_number: '',
    insurer_name: '',
    policy_type: 'Comprehensive',
    vehicle_registration_no: '',
    policy_start_date: '',
    policy_expiry_date: '',
    insured_name: '',
    // RC fields
    registration_no: '',
    owner_name: '',
    chassis_number: '',
    engine_number: '',
    vehicle_make: '',
    vehicle_model: '',
    fuel_type: 'Petrol',
    // License fields
    license_number: '',
    issuing_authority: '',
    // Vehicle specifications
    vehicleId: null,
    vehicleApproved: false,
    vehicleActive: true,
  });

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

  const switchTab = (tabKey) => {
    setActiveTab(tabKey);
    setSearchParams({ tab: tabKey });
  };

  const handleCopyId = () => {
    if (driver?.id) {
      navigator.clipboard.writeText(driver.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  // ── Driver Verification & Approval Actions ──
  const handleApproveDriver = async () => {
    showAlert(
      `Are you sure you want to approve captain "${driver.name || driver.username}"? All pending compliance documents and primary vehicle will be verified, allowing the Captain to go online.`,
      'Approve Captain',
      'info',
      'Confirm Approval',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.approve(id);
          await refetch();
          showAlert('Captain successfully approved! Account is now active for duty.', 'Captain Approved', 'success');
        } catch (err) {
          showAlert(err?.response?.data?.error || err.message, 'Approval Failed', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleConfirmRejectDriver = async () => {
    if (!rejectDriverModal.reason.trim()) {
      showAlert('Please enter a specific rejection reason.', 'Missing Reason', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.reject(id, { reason: rejectDriverModal.reason });
      setRejectDriverModal({ isOpen: false, reason: '' });
      await refetch();
      showAlert('Captain application has been rejected and notified.', 'Captain Rejected', 'success');
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message, 'Rejection Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmSuspend = async () => {
    if (!suspendDriverModal.reason.trim()) {
      showAlert('Please enter the reason for suspension.', 'Missing Reason', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.suspend(id, { reason: suspendDriverModal.reason });
      setSuspendDriverModal({ isOpen: false, reason: '' });
      await refetch();
      showAlert('Captain account suspended and taken offline immediately.', 'Captain Suspended', 'success');
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message, 'Suspension Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    showAlert(
      `Unsuspend Captain "${driver.name || driver.username}" and restore platform duty access?`,
      'Unsuspend Captain',
      'info',
      'Confirm Unsuspend',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.unsuspend(id);
          await refetch();
          showAlert('Captain account unsuspended and restored.', 'Captain Active', 'success');
        } catch (err) {
          showAlert(err?.response?.data?.error || err.message, 'Action Failed', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // ── Document Review / Edit Actions ──
  const handleOpenDocModal = (doc = null, type = 'driver') => {
    const v = primaryVehicle || driver?.vehicle || (driver?.vehicles && driver.vehicles[0]) || null;
    const docTypeRaw = doc?.document_type || (type === 'vehicle' ? 'RC' : 'License');
    const docTypeLower = (docTypeRaw || '').toLowerCase();

    const isPhoto = ['photo', 'passport', 'picture', 'selfie'].some(k => docTypeLower.includes(k));
    const isAadhaar = ['aadhaar', 'adhar', 'aadhar'].some(k => docTypeLower.includes(k));
    const isInsurance = ['insurance', 'ins'].some(k => docTypeLower.includes(k));
    const isRC = ['rc', 'registration'].some(k => docTypeLower.includes(k));
    const isLicense = ['license', 'licence', 'dl', 'driving'].some(k => docTypeLower.includes(k));

    const driverFullName = (driver?.name || `${driver?.first_name || ''} ${driver?.last_name || ''}`).trim();

    setEditDocModal({
      isOpen: true,
      docId: doc?.id || null,
      docType: docTypeRaw,
      documentNumber: (doc?.document_number && doc?.document_number !== '—') ? doc.document_number : (isRC && v?.registration_number ? v.registration_number : ''),
      expiresAt: doc?.expires_at || doc?.expiry_date || '',
      documentUrl: doc?.document_url || '',
      isVerified: Boolean(doc?.is_verified),
      status: doc?.status || (doc?.is_verified ? 'verified' : 'pending'),
      rejectionReason: doc?.rejection_reason || '',
      type: (isRC || isInsurance) ? 'vehicle' : type,

      // Aadhaar fields
      aadhaar_number: doc?.aadhaar_number || (isAadhaar && doc?.document_number && doc?.document_number !== '—' ? doc.document_number : ''),
      name: doc?.name || driverFullName || '',
      dob: doc?.dob || doc?.date_of_birth || driver?.date_of_birth || '',
      gender: doc?.gender || driver?.gender || 'Male',
      address: doc?.address || driver?.operating_address || driver?.address || '',

      // Insurance fields
      policy_number: doc?.policy_number || (isInsurance && doc?.document_number && doc?.document_number !== '—' ? doc.document_number : ''),
      insurer_name: doc?.insurer_name || v?.insurance_company || '',
      policy_type: doc?.policy_type || 'Comprehensive',
      vehicle_registration_no: doc?.vehicle_registration_no || v?.registration_number || '',
      policy_start_date: doc?.policy_start_date || '',
      policy_expiry_date: doc?.expires_at || doc?.expiry_date || v?.insurance_expiry || '',
      insured_name: doc?.insured_name || driverFullName || '',

      // RC fields
      registration_no: doc?.registration_no || v?.registration_number || (isRC && doc?.document_number && doc?.document_number !== '—' ? doc.document_number : ''),
      owner_name: doc?.owner_name || driverFullName || '',
      chassis_number: doc?.chassis_number || v?.chassis_number || '',
      engine_number: doc?.engine_number || v?.engine_number || '',
      vehicle_make: doc?.vehicle_make || v?.make || '',
      vehicle_model: doc?.vehicle_model || v?.model || '',
      fuel_type: doc?.fuel_type || v?.fuel_type || 'Petrol',

      // License fields
      license_number: doc?.license_number || (isLicense && doc?.document_number && doc?.document_number !== '—' ? doc.document_number : driver?.license_number || ''),
      issuing_authority: doc?.issuing_authority || '',

      // Vehicle specs
      vehicleId: v?.id || null,
      vehicleApproved: Boolean(v?.is_approved),
      vehicleActive: v?.is_active ?? true,
    });
  };

  const handleSaveDocUpdate = async (shouldApprove = false) => {
    setActionLoading(true);
    try {
      const docTypeLower = (editDocModal.docType || '').toLowerCase();
      const isPhoto = ['photo', 'passport', 'picture', 'selfie'].some(k => docTypeLower.includes(k));
      const isAadhaar = ['aadhaar', 'adhar', 'aadhar'].some(k => docTypeLower.includes(k));
      const isInsurance = ['insurance', 'ins'].some(k => docTypeLower.includes(k));
      const isRC = ['rc', 'registration'].some(k => docTypeLower.includes(k));
      const isLicense = ['license', 'licence', 'dl', 'driving'].some(k => docTypeLower.includes(k));

      let docNumber = editDocModal.documentNumber.trim();
      let docExpiry = editDocModal.expiresAt || null;

      if (isAadhaar) {
        docNumber = editDocModal.aadhaar_number.trim();
      } else if (isInsurance) {
        docNumber = editDocModal.policy_number.trim();
        docExpiry = editDocModal.policy_expiry_date || docExpiry;
      } else if (isRC) {
        docNumber = editDocModal.registration_no.trim();
      } else if (isLicense) {
        docNumber = editDocModal.license_number.trim() || docNumber;
      }

      const payload = {
        document_number: docNumber,
        expiry_date: docExpiry,
        // Aadhaar fields
        name: editDocModal.name,
        dob: editDocModal.dob,
        gender: editDocModal.gender,
        care_of: editDocModal.care_of,
        pincode: editDocModal.pincode,
        address: editDocModal.address,
        // Insurance fields
        policy_number: editDocModal.policy_number,
        insurer_name: editDocModal.insurer_name,
        policy_type: editDocModal.policy_type,
        vehicle_registration_no: editDocModal.vehicle_registration_no,
        policy_start_date: editDocModal.policy_start_date,
        policy_expiry_date: editDocModal.policy_expiry_date,
        insured_name: editDocModal.insured_name,
        // RC fields
        registration_no: editDocModal.registration_no,
        owner_name: editDocModal.owner_name,
        chassis_number: editDocModal.chassis_number,
        engine_number: editDocModal.engine_number,
        vehicle_make: editDocModal.vehicle_make,
        vehicle_model: editDocModal.vehicle_model,
        fuel_type: editDocModal.fuel_type,
        // Vehicle fields
        registration_number: isRC ? editDocModal.registration_no.trim() : (isInsurance ? editDocModal.vehicle_registration_no.trim() : undefined),
        make: editDocModal.vehicle_make.trim() || undefined,
        model: editDocModal.vehicle_model.trim() || undefined,
        vehicle_is_approved: shouldApprove ? true : editDocModal.vehicleApproved,
        vehicle_is_active: editDocModal.vehicleActive,
      };

      if (shouldApprove) {
        if (editDocModal.docId) {
          await driversAPI.approveDoc(id, editDocModal.docId, payload);
        }
        if (editDocModal.vehicleId || (isRC && editDocModal.registration_no)) {
          await driversAPI.updateVehicle(id, editDocModal.vehicleId || 'primary', {
            ...payload,
            is_approved: true,
            is_active: true
          });
        }
        showAlert(`Document "${editDocModal.docType.toUpperCase()}" verified & approved successfully.`, 'Verified & Approved', 'success');
      } else {
        if (editDocModal.docId) {
          await driversAPI.updateDoc(id, editDocModal.docId, payload);
        }
        if (editDocModal.vehicleId || (isRC && editDocModal.registration_no)) {
          await driversAPI.updateVehicle(id, editDocModal.vehicleId || 'primary', payload);
        }
        showAlert(`Document "${editDocModal.docType.toUpperCase()}" details updated successfully.`, 'Updated Successfully', 'success');
      }
      setEditDocModal(prev => ({ ...prev, isOpen: false }));
      await refetch();
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message, 'Action Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDoc = async (docId, docType) => {
    const targetDoc = (driver?.documents || []).find(d => String(d.id) === String(docId));
    if (targetDoc) {
      handleOpenDocModal(targetDoc);
      return;
    }
    showAlert(
      `Approve document "${docType.toUpperCase()}" for this Captain?`,
      'Approve Document',
      'info',
      'Confirm Approve',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.approveDoc(id, docId);
          await refetch();
          showAlert(`Document "${docType.toUpperCase()}" verified successfully.`, 'Document Approved', 'success');
        } catch (err) {
          showAlert(err?.response?.data?.error || err.message, 'Approval Failed', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleConfirmRejectDoc = async () => {
    if (!rejectDocModal.reason.trim()) {
      showAlert('Please enter a specific rejection reason.', 'Missing Reason', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.rejectDoc(id, rejectDocModal.docId, { reason: rejectDocModal.reason });
      setRejectDocModal({ isOpen: false, docId: null, docType: '', reason: '' });
      await refetch();
      showAlert('Document rejected with reason recorded.', 'Document Rejected', 'success');
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message, 'Rejection Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Vehicle Review Actions ──
  const handleApproveVehicle = async (vehicleId) => {
    showAlert(
      'Approve this vehicle for platform ride service?',
      'Approve Vehicle',
      'info',
      'Confirm Approve',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.approveVehicle(id, vehicleId);
          await refetch();
          showAlert('Vehicle approved for commercial ride operations.', 'Vehicle Approved', 'success');
        } catch (err) {
          showAlert(err?.response?.data?.error || err.message, 'Vehicle Action Failed', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  const handleDeactivateVehicle = async (vehicleId) => {
    showAlert(
      'Deactivate this vehicle? Captain will not be able to go online until a new vehicle is added and verified.',
      'Deactivate Vehicle',
      'warning',
      'Confirm Deactivation',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.deactivateVehicle(id, vehicleId);
          await refetch();
          showAlert('Vehicle deactivated successfully.', 'Vehicle Deactivated', 'success');
        } catch (err) {
          showAlert(err?.response?.data?.error || err.message, 'Deactivation Failed', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  // ── Wallet Adjustment Action ──
  const handleWalletAdjust = async () => {
    const numAmount = parseFloat(walletModal.amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showAlert('Please enter a valid positive numerical amount.', 'Invalid Amount', 'warning');
      return;
    }
    if (!walletModal.reason.trim()) {
      showAlert('Please provide an operational note / reason for this adjustment.', 'Reason Required', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.adjustWallet(id, {
        type: walletModal.type,
        amount: numAmount,
        reason: walletModal.reason.trim()
      });
      setWalletModal({ isOpen: false, type: 'credit', amount: '', reason: '' });
      await refetch();
      showAlert(`Wallet successfully ${walletModal.type === 'credit' ? 'credited' : 'debited'} by ₹${numAmount}.`, 'Adjustment Successful', 'success');
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message, 'Wallet Adjustment Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Push Notification Dispatch ──
  const handleSendNotification = async () => {
    if (!notifModal.title.trim() || !notifModal.body.trim()) {
      showAlert('Please enter both an alert title and message body.', 'Incomplete Data', 'warning');
      return;
    }
    setActionLoading(true);
    try {
      await driversAPI.sendNotification(id, notifModal);
      setNotifModal({ isOpen: false, title: '', body: '', type: 'System' });
      await refetch();
      showAlert(`Push alert "${notifModal.title}" sent to Captain partner terminal.`, 'Alert Dispatched', 'success');
    } catch (err) {
      showAlert(err?.response?.data?.error || err.message, 'Dispatch Failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // ── Force Remote Logout ──
  const handleForceLogout = async () => {
    showAlert(
      `Force logout Captain "${driver.name || driver.username}" from all active smartphone sessions immediately?`,
      'Force Logout Session',
      'warning',
      'Terminate All Sessions',
      'Cancel',
      async () => {
        setActionLoading(true);
        try {
          await driversAPI.forceLogout(id);
          await refetch();
          showAlert('Captain successfully logged out from all active device terminals.', 'Sessions Revoked', 'success');
        } catch (err) {
          showAlert(err?.response?.data?.error || err.message, 'Logout Failed', 'error');
        } finally {
          setActionLoading(false);
        }
      }
    );
  };

  if (loading) return <LoadingState message="Loading Captains dossier..." />;
  if (error || !driver) return <ErrorState error={error || 'Captain profile not found'} onRetry={refetch} />;

  const isSuspended = driver.status === 'suspended' || driver.approval_status === 'Suspended' || driver.approval_status === 'suspended';
  const isApproved = driver.approval_status === 'Approved' || driver.approval_status === 'approved';
  const isPending = driver.approval_status === 'Pending' || driver.approval_status === 'pending';
  const isRejected = driver.approval_status === 'Rejected' || driver.approval_status === 'rejected';
  const isOnline = driver.online_status === 'online' || driver.availability_status === 'Online';
  const isInTrip = driver.online_status === 'in_trip' || driver.availability_status === 'In Trip' || driver.multi_status?.ride_status === 'in_trip';

  const eligibility = driver.eligibility || {
    eligible: false,
    can_accept_rides: false,
    checks: {},
    reasons: ['Eligibility calculation unavailable']
  };

  const primaryVehicle = driver.vehicle || (driver.vehicles && driver.vehicles[0]) || null;
  const driverDocs = driver.driver_documents || (driver.documents || []).filter(d => ['License', 'Background Check', 'Aadhar', 'ID', 'Profile Photo'].some(k => (d.document_type || '').includes(k)));
  const vehicleDocs = driver.vehicle_documents || (driver.documents || []).filter(d => ['RC', 'Insurance', 'PUC', 'Permit', 'Vehicle Photo'].some(k => (d.document_type || '').includes(k)));
  const rides = driver.rides || driver.recent_rides || [];
  const earnings = driver.earnings || { today: 0, this_week: 0, this_month: 0, lifetime: 0, ride_earnings: 0, commission_deducted: 0, net_earnings: 0 };
  const walletTxs = driver.wallet_transactions || [];
  const bankAccounts = driver.bank_accounts || [];
  const payouts = driver.payouts || [];
  const ratingsList = driver.ratings || [];
  const complaintsList = driver.complaints || [];
  const emergenciesList = driver.emergencies || [];
  const notifsList = driver.notifications || [];
  const devicesList = driver.devices || [];
  const servicesList = driver.services || [];
  const dutyHistory = driver.duty_history || [];
  const incentivesList = driver.incentives || [];
  const auditLogs = driver.audit_logs || [];

  // 21 Master Sub-Navigation Sidebar Items
  const SIDEBAR_ITEMS = [
    { key: 'profile', label: 'Captain Profile & KYC', icon: User, color: '#6C63FF', badge: isPending ? 'PENDING' : 'APPROVED' },
    { key: 'driver_documents', label: 'Captain Documents', icon: FileText, color: '#FFD93D', count: driverDocs.length },
    { key: 'vehicle_documents', label: 'Vehicle Documents', icon: FileText, color: '#FF6B35', count: vehicleDocs.length },
    { key: 'vehicle', label: 'Vehicle (Max 1)', icon: Car, color: '#3B82F6', badge: primaryVehicle ? primaryVehicle.vehicle_type : 'NONE' },
    
    { key: 'verification', label: 'Verification Center', icon: CheckCircle, color: '#6BCB77', badge: isApproved ? 'APPROVED' : (isPending ? 'PENDING' : 'REJECTED') },
    { key: 'active_ride', label: 'Live Active Ride', icon: Navigation, color: '#4ECDC4', badge: driver.active_ride ? 'LIVE' : null },
    { key: 'rides', label: 'Ride History', icon: Car, color: '#A78BFA', count: rides.length },
    { key: 'earnings', label: 'Earnings & Revenue', icon: TrendingUp, color: '#10B981', badge: `₹${earnings.today}` },
    { key: 'payouts', label: 'Payouts & Bank Accounts', icon: CreditCard, color: '#6366F1', count: bankAccounts.length },
    { key: 'wallet', label: 'Captain Digital Wallet', icon: Wallet, color: '#EC4899', badge: `₹${driver.wallet_balance || 0}` },
    { key: 'ratings', label: 'Ratings & Reviews', icon: Star, color: '#FFD93D', badge: `★ ${driver.rating || 5.0}` },
    { key: 'complaints', label: 'Complaints / Support', icon: AlertTriangle, color: '#EF4444', count: complaintsList.length },
    { key: 'sos', label: 'SOS / Emergencies', icon: AlertOctagon, color: '#DC2626', count: emergenciesList.length },
    { key: 'notifications', label: 'Push Notifications', icon: BellRing, color: '#06B6D4', count: notifsList.length },
    { key: 'devices', label: 'Terminal & Devices', icon: Smartphone, color: '#8B5CF6', count: devicesList.length },
    { key: 'services', label: 'Service Eligibility', icon: Layers, color: '#14B8A6', count: servicesList.length },
    { key: 'online_history', label: 'Online / Duty History', icon: Clock, color: '#F59E0B' },
    { key: 'incentives', label: 'Incentives & Targets', icon: Sparkles, color: '#FBBF24', count: incentivesList.length },
    { key: 'security', label: 'Account & Security', icon: Key, color: '#64748B' },
    { key: 'audit', label: 'Admin Activity Logs', icon: FileSpreadsheet, color: '#94A3B8', count: auditLogs.length },
    { key: 'overview', label: 'Overview & Eligibility', icon: ShieldCheck, color: '#4ECDC4', badge: eligibility.can_accept_rides ? 'READY' : 'NOT READY' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ── Breadcrumb Header & Master Actions ── */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => navigate('/drivers')}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 3 }}
          >
            <ArrowLeft size={16} />
          </button>
        
                <span>•</span>
                <span>License: <strong>{driver.license_number || '—'}</strong></span>
                <span>•</span>
                <span>Phone: <strong>{driver.phone || driver.phone_number}</strong></span>
                <span>•</span>
                <span>Joined: <strong>{driver.date_joined || '—'}</strong></span>
              </div>
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <button
                  onClick={refetch}
                  className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                  title="Refresh Captain status">
                <RefreshCw size={14} /> Refresh
              </button>

              <button
                onClick={() => setNotifModal({ isOpen: true, title: '', body: '', type: 'System' })}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)' }}>
                <Send size={14} /> Push Alert
              </button>

              <button
                onClick={() => setWalletModal({ isOpen: true, type: 'credit', amount: '', reason: '' })}
                className="btn btn-secondary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--status-active)' }}>
                <Wallet size={14} /> Adjust Wallet
              </button>

              {isPending && (
            <button
              onClick={handleApproveDriver}
              disabled={actionLoading}
              className="btn btn-success btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle size={14} /> Approve Captain
            </button>
          )}

          {isPending && (
            <button
              onClick={() => setRejectDriverModal({ isOpen: true, reason: '' })}
              disabled={actionLoading}
              className="btn btn-danger btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <XCircle size={14} /> Reject Application
            </button>
          )}

          {isSuspended ? (
            <button
              onClick={handleUnsuspend}
              disabled={actionLoading}
              className="btn btn-success btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <CheckCircle size={14} /> Unsuspend Captain
            </button>
          ) : (
            <button
              onClick={() => setSuspendDriverModal({ isOpen: true, reason: '' })}
              disabled={actionLoading}
              className="btn btn-danger btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              <Ban size={14} /> Suspend Captain
            </button>
          )}
        </div>
        </div>
      

      {/* ── Driver Hero Banner with Multi-Status & KPIs ── */}
      <div className="card" style={{ padding: '0px 20px', borderRadius: 16, background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 50}}>
               <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{driver.full_name || driver.name || driver.username}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
               

                {/* Multi-Status Chips */}
                {isSuspended ? (
                  <span className="badge badge-suspended" style={{ fontSize: 11 }}>● SUSPENDED</span>
                ) : isApproved ? (
                  <span className="badge badge-active" style={{ fontSize: 11 }}>✓ VERIFIED</span>
                ) : (
                  <span className="badge badge-pending" style={{ fontSize: 11 }}>⚠ {driver.approval_status?.toUpperCase()}</span>
                )}

                {isInTrip ? (
                  <span className="badge" style={{ fontSize: 11, background: 'rgba(78,205,196,0.15)', color: 'var(--accent-secondary)', border: '1px solid var(--accent-secondary)' }}>
                    🚗 IN TRIP
                  </span>
                ) : isOnline ? (
                  <span className="badge badge-active" style={{ fontSize: 11 }}>🟢 ONLINE (Available)</span>
                ) : (
                  <span className="badge badge-inactive" style={{ fontSize: 11 }}>○ OFFLINE</span>
                )}

                {primaryVehicle && (
                  <span className="badge" style={{ fontSize: 11, background: 'rgba(108,99,255,0.12)', color: 'var(--accent-primary)' }}>
                    🛵 {primaryVehicle.vehicle_type} · {primaryVehicle.registration_number}
                  </span>
                )}
              </div>
              

              
            </div>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center', padding: '0 4px', borderRight: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {driver.total_trips ?? 0}
                </div>
                <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Total Trips</span>
            </div>
            <div style={{ textAlign: 'center', padding: '0 4px', borderRight: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--status-active)' }}>
                    ₹{earnings.lifetime ?? 0}
                </div>
                <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Lifetime Gross</span>
              </div>

            <div style={{ textAlign: 'center', padding: '0 4px', borderRight: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)' }}>
                ₹{driver.wallet_balance ?? 0}
              </div>
              <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Wallet</span>
            </div>

            <div style={{ textAlign: 'center', padding: '0 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center', color: 'var(--accent-yellow)', fontSize: 20, fontWeight: 800 }}>
                <Star size={12} fill="currentColor" /> {Number(driver.rating || 5.0).toFixed(1)}
              </div>
              <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Rating</span>
            </div>
            

            

            
          </div>
        </div>
      </div>

      {/* ── Main Layout: Inner Navigation Sidebar + 21 Tab Panels ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '270px 1fr', gap: 12, alignItems: 'start' }}>

        {/* ── Left Sticky Navigation Sidebar ── */}
        <div
          className="card"
          style={{
            padding: 8,
            borderRadius: 14,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            maxHeight: '75.5vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div style={{ padding: '6px 10px', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: 0.8 }}>
            Captain Master Dossier
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
                    padding: '7px 10px',
                    borderRadius: 8,
                    border: 'none',
                    background: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? '#ffffff' : 'var(--text-primary)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: 12.5,
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <Icon size={15} color={isActive ? '#ffffff' : (item.color || 'var(--text-muted)')} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: isActive ? 'white' : (item.badge === 'READY' ? 'rgba(107,203,119,0.2)' : 'var(--bg-secondary)'),
                      color: isActive ? 'var(--accent-primary)' : (item.badge === 'READY' ? 'var(--status-active)' : 'var(--text-secondary)')
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

        {/* ── Right Content Area: Selected Tab View ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            maxHeight: 'calc(100vh - 200px)',
            overflowY: 'auto',
            paddingRight: 4
          }}
        >

          {/* 1. OVERVIEW & READY TO RIDE ELIGIBILITY */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* 🌟 Central Ride Eligibility Engine Card 🌟 */}
              <div className="card" style={{
                padding: 10,
                borderRadius: 16,
                background: eligibility.can_accept_rides
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.12) 0%, var(--bg-card) 100%)'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, var(--bg-card) 100%)',
                border: `1.5px solid ${eligibility.can_accept_rides ? 'var(--status-active)' : 'var(--accent-pink)'}`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {eligibility.can_accept_rides ? (
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.2)', color: 'var(--status-active)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={22} />
                      </div>
                    ) : (
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(239,68,68,0.2)', color: 'var(--accent-pink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <XCircle size={22} />
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                        Captain RIDE ELIGIBILITY (Source of Truth)
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        Automated compliance verification engine determining if captain is legally eligible to receive rides
                      </p>
                    </div>
                  </div>

                  <div style={{
                    padding: '8px 16px',
                    borderRadius: 20,
                    fontWeight: 900,
                    fontSize: 13,
                    letterSpacing: 0.5,
                    background: eligibility.can_accept_rides ? 'var(--status-active)' : 'var(--accent-pink)',
                    color: '#ffffff'
                  }}>
                    {eligibility.can_accept_rides ? '🟢 READY TO ACCEPT RIDES' : '🔴 NOT ELIGIBLE FOR RIDES'}
                  </div>
                </div>

                {/* 8-Point Compliance Checklist Grid */}
                <div className="grid-4" style={{ gap: 12, marginTop: 12 }}>
                  {[
                    { label: 'Account Active', key: 'account_active', ok: eligibility.checks?.account_active },
                    { label: 'Captain KYC Approved', key: 'driver_approved', ok: eligibility.checks?.driver_approved },
                    { label: 'Vehicle Approved', key: 'vehicle_approved', ok: eligibility.checks?.vehicle_approved },
                    { label: 'Driving License Valid', key: 'license_valid', ok: eligibility.checks?.license_valid },
                    { label: 'RC (Registration) Valid', key: 'rc_valid', ok: eligibility.checks?.rc_valid },
                    { label: 'Vehicle Insurance Valid', key: 'insurance_valid', ok: eligibility.checks?.insurance_valid },
                    { label: 'PUC / Fitness Valid', key: 'puc_valid', ok: eligibility.checks?.puc_valid },
                    { label: 'No Suspension Flags', key: 'no_suspension', ok: eligibility.checks?.no_suspension },
                  ].map((chk, idx) => (
                    <div key={idx} style={{
                      padding: 12,
                      borderRadius: 10,
                      background: chk.ok ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
                      border: `1px solid ${chk.ok ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10
                    }}>
                      {chk.ok ? <CheckCircle size={18} color="var(--status-active)" /> : <XCircle size={18} color="var(--accent-pink)" />}
                      <span style={{ fontSize: 12, fontWeight: 700, color: chk.ok ? 'var(--text-primary)' : 'var(--accent-pink)' }}>
                        {chk.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Ineligibility Reasons Alert */}
                {!eligibility.can_accept_rides && eligibility.reasons?.length > 0 && (
                  <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--accent-pink)', display: 'block', marginBottom: 4 }}>
                      Blocking Reasons Preventing Duty:
                    </span>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-primary)' }}>
                      {eligibility.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Real-Time Duty Location & Performance Overview */}
              <div className="grid-3" style={{ gap: 16 }}>
                <div className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-primary)', marginBottom: 8 }}>
                    <MapPin size={18} />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Live Duty Location</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0' }}>{driver.last_location || (driver.city ? `${driver.city}, ${driver.state || ''}` : 'Location Unavailable')}</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Updated {driver.last_location_update || 'Just now'}</p>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-yellow)', marginBottom: 8 }}>
                    <Clock size={18} />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Today's Duty Hours</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0' }}>{driver.performance?.online_hours || 0} Hours</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Max daily safety limit: 12 Hours</p>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--status-active)', marginBottom: 8 }}>
                    <TrendingUp size={18} />
                    <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase' }}>Ride Acceptance Rate</span>
                  </div>
                  <h4 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 4px 0' }}>{driver.performance?.acceptance_rate}%</h4>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>Completion rate: {driver.performance?.completion_rate}%</p>
                </div>
              </div>

              {/* 🗺️ Live OpenStreetMap (OSM) GPS Radar & City/State Telemetry 🗺️ */}
              <div className="card" style={{ padding: 16, borderRadius: 16, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,107,53,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Navigation size={18} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                        Live OpenStreetMap (OSM) GPS Telemetry
                        <span className="badge badge-primary" style={{ fontSize: 10, padding: '2px 8px' }}>
                          OSM Map Radar
                        </span>
                      </h3>
                      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                        Live captain GPS coordinates resolved via OpenStreetMap Nominatim
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, flexWrap: 'wrap' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--bg-secondary)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      📍 {driver.city || 'Delhi'}, {driver.state || 'Delhi NCR'}
                    </span>
                    <span style={{ padding: '4px 10px', borderRadius: 8, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      GPS: {Number(driver.latitude || driver.current_latitude || 28.4415).toFixed(4)}, {Number(driver.longitude || driver.current_longitude || 77.0395).toFixed(4)}
                    </span>
                  </div>
                </div>

                {/* OpenStreetMap Container */}
                <div style={{ height: 260, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                  <MapContainer
                    center={[Number(driver.latitude || driver.current_latitude || 28.4415), Number(driver.longitude || driver.current_longitude || 77.0395)]}
                    zoom={15}
                    style={{ height: '100%', width: '100%' }}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker
                      position={[Number(driver.latitude || driver.current_latitude || 28.4415), Number(driver.longitude || driver.current_longitude || 77.0395)]}
                      icon={driverMapIcon}
                    >
                      <Popup>
                        <div style={{ padding: 4, minWidth: 160 }}>
                          <strong style={{ fontSize: 13, display: 'block', color: '#111827' }}>
                            {driver.name || driver.username}
                          </strong>
                          <div style={{ fontSize: 11, color: '#4B5563', marginTop: 2 }}>
                            {driver.vehicle ? `${driver.vehicle.make} ${driver.vehicle.model} (${driver.vehicle.registration_number})` : 'Registered Captain'}
                          </div>
                          <div style={{ fontSize: 11, color: '#059669', fontWeight: 700, marginTop: 2 }}>
                            ● {driver.availability_status || 'Online'}
                          </div>
                          <div style={{ fontSize: 11, color: '#374151', marginTop: 4, borderTop: '1px solid #E5E7EB', paddingTop: 4 }}>
                            📍 {driver.last_location || `${driver.city || 'Delhi'}, ${driver.state || 'India'}`}
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  </MapContainer>
                </div>
              </div>

              {/* Active Ride Callout (if in trip) */}
              {driver.active_ride && (
                <div className="card" style={{ padding: 10, border: '1.5px solid var(--accent-secondary)', background: 'rgba(78,205,196,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <span className="badge" style={{ background: 'var(--accent-secondary)', color: '#000', fontWeight: 800, fontSize: 11 }}>
                        CURRENT ACTIVE TRIP #{driver.active_ride.booking_number}
                      </span>
                      <h3 style={{ fontSize: 18, fontWeight: 800, margin: '8px 0 2px 0' }}>
                        Customer: {driver.active_ride.customer_name} ({driver.active_ride.customer_phone})
                      </h3>
                      <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: 0 }}>
                        <strong>Route:</strong> {driver.active_ride.pickup_address} → {driver.active_ride.dropoff_address}
                      </p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--status-active)' }}>
                        ₹{driver.active_ride.fare}
                      </div>
                      <Link to="/operations/map" className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <Navigation size={13} /> Live Map Tracking
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 2. VERIFICATION CENTER TAB */}
          {activeTab === 'verification' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <CheckCircle size={18} /> Captain KYC & Vehicle Compliance Center
                  </h3>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isPending && (
                      <button onClick={handleApproveDriver} className="btn btn-success btn-sm" disabled={actionLoading}>
                        Approve Captain
                      </button>
                    )}
                    {isPending && (
                      <button onClick={() => setRejectDriverModal({ isOpen: true, reason: '' })} className="btn btn-danger btn-sm" disabled={actionLoading}>
                        Reject Application
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid-3" style={{ gap: 16 }}>
                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Captain KYC State</span>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                      {isApproved ? '✓ Approved' : isRejected ? '✗ Rejected' : '⚠ Under Review'}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>All identity & license credentials</p>
                  </div>

                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Vehicle Verification</span>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: primaryVehicle?.is_approved ? 'var(--status-active)' : 'var(--accent-yellow)' }}>
                      {primaryVehicle?.is_approved ? '✓ Approved' : '⚠ Pending Review'}
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>{primaryVehicle ? `${primaryVehicle.make} ${primaryVehicle.model}` : 'No vehicle linked'}</p>
                  </div>

                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Documents Audit</span>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>
                      {(driver.documents || []).filter(d => d.is_verified).length} / {(driver.documents || []).length} Verified
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0 0' }}>Compliance documents uploaded</p>
                  </div>
                </div>

                {/* Fast-Track Compliance Documents List */}
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <FileText size={16} /> Compliance Documents Quick Verification
                    </h4>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Click any document row to inspect, edit document number & expiry date, or approve
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                    {(driver.documents || []).map(doc => (
                      <div
                        key={doc.id}
                        onClick={() => handleOpenDocModal(doc)}
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-color)',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 10,
                          transition: 'all 0.15s ease'
                        }}
                        className="hover-card"
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 2 }}>
                            <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {Capitalize(doc.document_type)}
                            </strong>
                            <span className={`badge ${doc.is_verified ? 'badge-active' : (doc.status === 'rejected' ? 'badge-suspended' : 'badge-pending')}`} style={{ fontSize: 10, padding: '2px 6px' }}>
                              {doc.status?.toUpperCase() || (doc.is_verified ? 'VERIFIED' : 'PENDING')}
                            </span>
                            <button
                          type="button"
                          className="btn btn-secondary btn-xs p-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDocModal(doc);
                          }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        >
                          <Edit3 size={11} />
                        </button>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <span>No: <strong style={{ color: 'var(--text-primary)' }}>{doc.document_number || '—'}</strong></span>
                            {doc.expires_at && <span>Exp: <strong style={{ color: doc.is_expired ? 'var(--accent-pink)' : 'inherit' }}>{doc.expires_at}</strong></span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. DRIVER PROFILE TAB */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <User size={18} /> Personal & Professional Credentials
                </h3>
                <div className="grid-2" style={{ gap: 16 }}>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Full Legal Name:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.name || driver.full_name}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Registered Phone:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.phone || driver.phone_number}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Email Address:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.email}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Driving License Number:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.license_number || '—'}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>License Expiry Date:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.license_expiry || '—'}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Driving Experience:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.experience_years} Years</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gender / DOB:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.gender} · {driver.date_of_birth}</strong></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Operating City:</span> <strong style={{ display: 'block', fontSize: 14 }}>{driver.city || driver.service_city || 'Delhi NCR'}, {driver.state || 'Delhi NCR'}</strong></div>
                  <div style={{ gridColumn: '1 / -1' }}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ride Operating Address (Where Captain Rides the Bike):</span> <strong style={{ display: 'block', fontSize: 14, color: 'var(--text-primary)' }}>{driver.operating_address || driver.last_location_address || 'Not specified'}</strong></div>
                </div>
              </div>

              {/* Emergency Contacts */}
              <div className="card" style={{ padding: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Emergency Contacts & Support Desk</h3>
                {(!driver.emergency_contacts || driver.emergency_contacts.length === 0) ? (
                  <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                    No emergency contacts registered for this captain.
                  </div>
                ) : (
                  <div className="grid-2" style={{ gap: 12 }}>
                    {(driver.emergency_contacts || []).map((ec, idx) => (
                      <div key={idx} style={{ padding: 12, borderRadius: 10, background: 'var(--bg-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{ec.name}</strong>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ec.relation}</div>
                        </div>
                        <a href={`tel:${ec.phone}`} className="btn btn-secondary btn-xs" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <Phone size={12} /> {ec.phone}
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 4. VEHICLE TAB (MAX 1 RULE) */}
          {activeTab === 'vehicle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Car size={18} /> Primary Assigned Vehicle (Max 1 Rule)
                    </h3>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Each Captain partner may operate strictly one approved vehicle at a time
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleOpenDocModal(null, 'vehicle')}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      title="Edit Vehicle specifications & registration"
                    >
                      <Edit3 size={13} /> Edit Vehicle Details
                    </button>
                    {primaryVehicle && !primaryVehicle.is_approved && (
                      <button onClick={() => handleApproveVehicle(primaryVehicle.id)} className="btn btn-success btn-sm" disabled={actionLoading}>
                        Approve Vehicle
                      </button>
                    )}
                    {primaryVehicle && (
                      <button onClick={() => handleDeactivateVehicle(primaryVehicle.id)} className="btn btn-danger btn-sm" disabled={actionLoading}>
                        Deactivate / Replace Vehicle
                      </button>
                    )}
                  </div>
                </div>

                {primaryVehicle ? (
                  <div style={{ padding: 18, borderRadius: 14, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Car size={22} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
                            {primaryVehicle.make} {primaryVehicle.model} ({primaryVehicle.year})
                          </h4>
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            Category: <strong>{primaryVehicle.vehicle_type}</strong> · Color: <strong>{primaryVehicle.color}</strong>
                          </span>
                        </div>
                      </div>

                      <div>
                        {primaryVehicle.is_approved ? (
                          <span className="badge badge-active" style={{ fontSize: 12, padding: '4px 10px' }}>✓ Approved for Duty</span>
                        ) : (
                          <span className="badge badge-pending" style={{ fontSize: 12, padding: '4px 10px' }}>⚠ Verification Pending</span>
                        )}
                      </div>
                    </div>

                    <div className="grid-3" style={{ gap: 12, paddingTop: 12, borderTop: '1px solid var(--border-light)' }}>
                      <div><span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Registration Number</span><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent-yellow)' }}>{primaryVehicle.registration_number}</div></div>
                      <div><span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Operational Status</span><div style={{ fontSize: 15, fontWeight: 800, color: primaryVehicle.is_active ? 'var(--status-active)' : 'var(--text-muted)' }}>{primaryVehicle.is_active ? 'Active on Fleet' : 'Deactivated'}</div></div>
                      <div><span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Fuel / Type</span><div style={{ fontSize: 15, fontWeight: 800 }}>Commercial / EV / Petrol</div></div>
                    </div>
                  </div>
                ) : (
                  <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Car size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <p>No primary vehicle registered for this captain yet.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. DRIVER DOCUMENTS TAB */}
          {activeTab === 'driver_documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={18} /> Captain Personal Compliance Documents ({driverDocs.length})
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Click any document or &quot;Edit&quot; to update document number & expiry date
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {driverDocs.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => handleOpenDocModal(doc, 'driver')}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      className="hover-card"
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <FileText size={15} color="var(--accent-primary)" />
                            {doc.document_type.toUpperCase()}
                          </strong>
                          <span className={`badge ${doc.is_verified ? 'badge-active' : (doc.status === 'rejected' ? 'badge-suspended' : 'badge-pending')}`} style={{ fontSize: 11 }}>
                            {doc.status?.toUpperCase() || (doc.is_verified ? 'VERIFIED' : 'PENDING')}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Number: <strong style={{ color: doc.document_number && doc.document_number !== '—' ? 'var(--text-primary)' : 'var(--text-muted)' }}>{doc.document_number || 'Not Provided'}</strong></span>
                          <Edit3 size={13} style={{ opacity: 0.6 }} />
                        </div>
                        {doc.expires_at && (
                          <div style={{ fontSize: 12, color: doc.is_expired ? 'var(--accent-pink)' : 'var(--text-muted)', marginTop: 2 }}>
                            Expires: <strong>{doc.expires_at}</strong> {doc.is_expired && '(EXPIRED)'}
                          </div>
                        )}
                        {doc.rejection_reason && (
                          <div style={{ fontSize: 11, color: 'var(--accent-pink)', marginTop: 6, background: 'rgba(239,68,68,0.1)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                            <strong>Rejection Note:</strong> {doc.rejection_reason}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-light)', paddingTop: 10 }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, url: doc.document_url, title: doc.document_type, type: 'driver' })}
                          className="btn btn-secondary btn-xs"
                          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          title="View Document Image"
                        >
                          <Eye size={12} /> View File
                        </button>
                        {!doc.is_verified ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDocModal(doc, 'driver')}
                            className="btn btn-success btn-xs"
                            disabled={actionLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            title="Verify and Approve Document"
                          >
                            <Check size={12} /> Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenDocModal(doc, 'driver')}
                            className="btn btn-ghost btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--status-active)' }}
                            title="Click to update details or re-verify"
                          >
                            <CheckCircle2 size={12} /> Verified
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRejectDocModal({ isOpen: true, docId: doc.id, docType: doc.document_type, reason: '' })}
                          className="btn btn-danger btn-xs"
                          disabled={actionLoading}
                          title="Reject Document"
                        >
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. VEHICLE DOCUMENTS TAB */}
          {activeTab === 'vehicle_documents' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileText size={18} /> Vehicle Compliance Documents ({vehicleDocs.length})
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Click any document or &quot;Edit&quot; to update document number & expiry date
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                  {vehicleDocs.map(doc => (
                    <div
                      key={doc.id}
                      onClick={() => handleOpenDocModal(doc, 'vehicle')}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 12,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      className="hover-card"
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Car size={15} color="var(--accent-primary)" />
                            {doc.document_type.toUpperCase()}
                          </strong>
                          <span className={`badge ${doc.is_verified ? 'badge-active' : (doc.status === 'rejected' ? 'badge-suspended' : 'badge-pending')}`} style={{ fontSize: 11 }}>
                            {doc.status?.toUpperCase() || (doc.is_verified ? 'VERIFIED' : 'PENDING')}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>Number: <strong style={{ color: doc.document_number && doc.document_number !== '—' ? 'var(--text-primary)' : 'var(--text-muted)' }}>{doc.document_number || 'Not Provided'}</strong></span>
                          <Edit3 size={13} style={{ opacity: 0.6 }} />
                        </div>
                        <div style={{ fontSize: 12, color: doc.is_expired ? 'var(--accent-pink)' : 'var(--text-muted)', marginTop: 2 }}>
                          Expires: <strong>{doc.expires_at || 'No Expiry'}</strong> {doc.is_expired && '(EXPIRED)'}
                        </div>
                        {doc.rejection_reason && (
                          <div style={{ fontSize: 11, color: 'var(--accent-pink)', marginTop: 6, background: 'rgba(239,68,68,0.1)', padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)' }}>
                            <strong>Rejection Note:</strong> {doc.rejection_reason}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, borderTop: '1px solid var(--border-light)', paddingTop: 10 }} onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setDocPreviewModal({ isOpen: true, url: doc.document_url, title: doc.document_type, type: 'vehicle' })}
                          className="btn btn-secondary btn-xs"
                          style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          title="View Document Image"
                        >
                          <Eye size={12} /> View File
                        </button>
                        {!doc.is_verified ? (
                          <button
                            type="button"
                            onClick={() => handleOpenDocModal(doc, 'vehicle')}
                            className="btn btn-success btn-xs"
                            disabled={actionLoading}
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                            title="Verify and Approve Document"
                          >
                            <Check size={12} /> Approve
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenDocModal(doc, 'vehicle')}
                            className="btn btn-ghost btn-xs"
                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--status-active)' }}
                            title="Click to update details or re-verify"
                          >
                            <CheckCircle2 size={12} /> Verified
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setRejectDocModal({ isOpen: true, docId: doc.id, docType: doc.document_type, reason: '' })}
                          className="btn btn-danger btn-xs"
                          disabled={actionLoading}
                          title="Reject Document"
                        >
                          <X size={12} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 7. LIVE ACTIVE RIDE TAB */}
          {activeTab === 'active_ride' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Navigation size={18} /> Real-Time Active Ride Information
              </h3>
              {driver.active_ride ? (
                <div style={{ padding: 18, borderRadius: 12, background: 'var(--bg-secondary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
                    <div>
                      <h4 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Booking #{driver.active_ride.booking_number}</h4>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Passenger: <strong>{driver.active_ride.customer_name}</strong> ({driver.active_ride.customer_phone})</span>
                    </div>
                    <span className="badge badge-active" style={{ fontSize: 13 }}>{driver.active_ride.status}</span>
                  </div>
                  <div className="grid-2" style={{ gap: 12, marginBottom: 14 }}>
                    <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Pickup Location:</span> <div style={{ fontSize: 13, fontWeight: 600 }}>{driver.active_ride.pickup_address}</div></div>
                    <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dropoff Location:</span> <div style={{ fontSize: 13, fontWeight: 600 }}>{driver.active_ride.dropoff_address}</div></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 12 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--status-active)' }}>Trip Fare: ₹{driver.active_ride.fare}</div>
                    <Link to="/operations/map" className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <Navigation size={14} /> Open Live Map Tracker
                    </Link>
                  </div>
                </div>
              ) : (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Navigation size={36} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>Captain is currently not engaged in any active trip.</p>
                </div>
              )}
            </div>
          )}

          {/* 8. RIDE HISTORY TAB */}
          {activeTab === 'rides' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Car size={18} /> Captain Ride History ({rides.length})
              </h3>
              <DataTable
                maxHeight="480px"
                stickyHeader
                columns={[
                  { key: 'booking_number', label: 'Booking #', render: v => <strong>#{v}</strong> },
                  {
                    key: 'pickup_address', label: 'Route', render: (v, r) => (
                      <div style={{ fontSize: 12 }}>
                        <div><strong>From:</strong> {v?.length > 30 ? v.substring(0, 30) + '...' : v}</div>
                        <div style={{ color: 'var(--text-muted)' }}><strong>To:</strong> {r.dropoff_address?.length > 30 ? r.dropoff_address.substring(0, 30) + '...' : r.dropoff_address}</div>
                      </div>
                    )
                  },
                  {
                    key: 'customer_name', label: 'Customer', render: (v, r) => (
                      <div style={{ fontSize: 12 }}>
                        <strong>{v || 'Customer'}</strong>
                        <div style={{ color: 'var(--text-muted)' }}>{r.customer_phone || '—'}</div>
                      </div>
                    )
                  },
                  { key: 'total_fare', label: 'Total Fare', render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v}</strong> },
                  { key: 'driver_earnings', label: 'Captain Net', render: v => <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>₹{v || '—'}</span> },
                  { key: 'status', label: 'Status', render: v => <StatusBadge status={v} /> },
                  { key: 'created_at', label: 'Date', render: v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
                ]}
                data={rides}
                searchKeys={['booking_number', 'pickup_address', 'dropoff_address', 'customer_name']}
              />
            </div>
          )}

          {/* 9. EARNINGS & REVENUE TAB */}
          {activeTab === 'earnings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="grid-4" style={{ gap: 16 }}>
                <div className="card" style={{ padding: 18 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Today's Net</span>
                  <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--status-active)', margin: '6px 0 0 0' }}>₹{earnings.today}</h3>
                </div>
                <div className="card" style={{ padding: 18 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>This Week</span>
                  <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-primary)', margin: '6px 0 0 0' }}>₹{earnings.this_week}</h3>
                </div>
                <div className="card" style={{ padding: 18 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>This Month</span>
                  <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--accent-secondary)', margin: '6px 0 0 0' }}>₹{earnings.this_month}</h3>
                </div>
                <div className="card" style={{ padding: 18 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Lifetime Gross</span>
                  <h3 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text-primary)', margin: '6px 0 0 0' }}>₹{earnings.lifetime}</h3>
                </div>
              </div>

              <div className="card" style={{ padding: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Financial Revenue & Deduction Breakdown</h3>
                <div className="grid-2" style={{ gap: 16 }}>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Gross Ride Earnings:</span> <div style={{ fontSize: 16, fontWeight: 800 }}>₹{earnings.ride_earnings}</div></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Platform Commission (15% Avg):</span> <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-pink)' }}>- ₹{earnings.commission_deducted}</div></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Incentives & Targets Credited:</span> <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent-yellow)' }}>+ ₹{earnings.incentives}</div></div>
                  <div><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Net Earnings Paid Out:</span> <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--status-active)' }}>₹{earnings.net_earnings}</div></div>
                </div>
              </div>
            </div>
          )}

          {/* 10. PAYOUTS & BANK ACCOUNTS TAB */}
          {activeTab === 'payouts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Linked Bank Accounts for Direct Deposit</h3>
                {bankAccounts.length === 0 ? (
                  <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
                    No bank accounts linked by this captain yet.
                  </div>
                ) : (
                  <div className="grid-2" style={{ gap: 14 }}>
                    {bankAccounts.map(b => (
                      <div key={b.id} style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <strong style={{ fontSize: 14 }}>{b.bank_name}</strong>
                          <span className="badge badge-active" style={{ fontSize: 11 }}>{b.is_verified ? '✓ Verified' : 'Unverified'}</span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account Holder: <strong>{b.account_holder_name}</strong></div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Account Number: <code>{b.account_number}</code></div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>IFSC: <code>{b.ifsc_code}</code></div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Payout History */}
              <div className="card" style={{ padding: 10 }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>Bank Payouts & Settlement History</h3>
                <DataTable
                  maxHeight="480px"
                  stickyHeader
                  columns={[
                    { key: 'id', label: 'Payout ID', render: v => <strong>{v}</strong> },
                    { key: 'amount', label: 'Settlement Amount', render: v => <strong style={{ color: 'var(--status-active)' }}>₹{v}</strong> },
                    { key: 'bank_name', label: 'Bank Name', render: (v, r) => `${v} (${r.account_number})` },
                    { key: 'status', label: 'Status', render: v => <span className="badge badge-active">{v}</span> },
                    { key: 'date', label: 'Payout Date', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
                  ]}
                  data={payouts}
                  searchKeys={['id', 'bank_name']}
                />
              </div>
            </div>
          )}

          {/* 11. DRIVER DIGITAL WALLET TAB */}
          {activeTab === 'wallet' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Captain Digital Wallet Balance</span>
                    <h2 style={{ fontSize: 32, fontWeight: 900, color: 'var(--status-active)', margin: '4px 0 0 0' }}>
                      ₹{driver.wallet_balance ?? 0}
                    </h2>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setWalletModal({ isOpen: true, type: 'credit', amount: '', reason: '' })} className="btn btn-success btn-sm">
                      <Plus size={14} /> Add Credit
                    </button>
                    <button onClick={() => setWalletModal({ isOpen: true, type: 'debit', amount: '', reason: '' })} className="btn btn-danger btn-sm">
                      <Minus size={14} /> Debit Balance
                    </button>
                  </div>
                </div>

                {/* Wallet Transactions Ledger */}
                <DataTable
                  maxHeight="440px"
                  stickyHeader
                  columns={[
                    { key: 'created_at', label: 'Date & Time', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
                    {
                      key: 'type', label: 'Type', render: v => (
                        <span className={`badge ${v === 'Credit' ? 'badge-active' : 'badge-suspended'}`} style={{ fontSize: 11 }}>
                          {v}
                        </span>
                      )
                    },
                    {
                      key: 'amount', label: 'Amount', render: (v, r) => (
                        <strong style={{ color: r.type === 'Credit' ? 'var(--status-active)' : 'var(--accent-pink)' }}>
                          {r.type === 'Credit' ? '+' : '-'} ₹{v}
                        </strong>
                      )
                    },
                    { key: 'description', label: 'Description / Purpose', render: v => <span style={{ fontSize: 13 }}>{v}</span> },
                    { key: 'balance_after', label: 'Balance After', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{v}</span> },
                  ]}
                  data={walletTxs}
                  searchKeys={['description', 'type']}
                />
              </div>
            </div>
          )}

          {/* 12. RATINGS & REVIEWS TAB */}
          {activeTab === 'ratings' && (
            <div className="card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Captain Ratings & Passenger Reviews</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Overall average score: <strong>★ {driver.rating}</strong> across {ratingsList.length} reviews</span>
                </div>
              </div>

              <DataTable
                maxHeight="440px"
                stickyHeader
                columns={[
                  { key: 'reviewer_name', label: 'Passenger', render: v => <strong>{v}</strong> },
                  { key: 'booking_number', label: 'Ride #', render: v => <code>{v}</code> },
                  {
                    key: 'rating', label: 'Score', render: v => (
                      <span style={{ color: 'var(--accent-yellow)', fontWeight: 800, fontSize: 13 }}>
                        ★ {v}.0
                      </span>
                    )
                  },
                  { key: 'comment', label: 'Feedback Review', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
                  { key: 'created_at', label: 'Date', render: v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
                ]}
                data={ratingsList}
                searchKeys={['reviewer_name', 'comment', 'booking_number']}
              />
            </div>
          )}

          {/* 13. COMPLAINTS TAB */}
          {activeTab === 'complaints' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} /> Passenger Complaints & Service Reports ({complaintsList.length})
              </h3>
              {complaintsList.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <CheckCircle size={32} style={{ opacity: 0.3, marginBottom: 8, color: 'var(--status-active)' }} />
                  <p>Clean track record! No customer complaints registered against this captain.</p>
                </div>
              ) : (
                <DataTable
                  maxHeight="480px"
                  stickyHeader
                  columns={[
                    { key: 'id', label: 'Ticket #', render: v => <strong>{v}</strong> },
                    { key: 'customer_name', label: 'Passenger', render: v => <span>{v}</span> },
                    { key: 'subject', label: 'Issue Subject', render: v => <span style={{ fontWeight: 600 }}>{v}</span> },
                    { key: 'reason', label: 'Details', render: v => <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{v}</span> },
                    { key: 'status', label: 'Status', render: v => <span className="badge badge-active">{v}</span> },
                    { key: 'created_at', label: 'Date', render: v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
                  ]}
                  data={complaintsList}
                  searchKeys={['id', 'customer_name', 'subject']}
                />
              )}
            </div>
          )}

          {/* 14. SOS / EMERGENCIES TAB */}
          {activeTab === 'sos' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertOctagon size={18} color="var(--accent-pink)" /> SOS Emergency & Incident Triggers
              </h3>
              {emergenciesList.length === 0 ? (
                <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <ShieldCheck size={36} style={{ opacity: 0.3, marginBottom: 8, color: 'var(--status-active)' }} />
                  <p>No active or past emergency/SOS incidents triggered for this captain.</p>
                </div>
              ) : (
                <DataTable
                  columns={[
                    { key: 'id', label: 'SOS ID', render: v => <strong>{v}</strong> },
                    { key: 'ride_id', label: 'Ride #', render: v => <code>{v}</code> },
                    { key: 'reason', label: 'Emergency Reason', render: v => <span>{v}</span> },
                    { key: 'status', label: 'Resolution', render: v => <span className="badge badge-active">{v}</span> },
                    { key: 'created_at', label: 'Incident Date', render: v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
                  ]}
                  data={emergenciesList}
                />
              )}
            </div>
          )}

          {/* 15. NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div className="card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Captain Push Alerts & Real-Time Sync ({notifsList.length})</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Live delivered alerts and in-app partner read receipts</span>
                </div>
                <button onClick={() => setNotifModal({ isOpen: true, title: '', body: '', type: 'System' })} className="btn btn-primary btn-sm">
                  <Send size={14} /> Send Push Alert
                </button>
              </div>

              <DataTable
                maxHeight="440px"
                stickyHeader
                columns={[
                  {
                    key: 'title', label: 'Alert Title & Message', render: (v, r) => (
                      <div style={{ maxWidth: 360 }}>
                        <strong style={{ fontSize: 13, display: 'block' }}>{v}</strong>
                        <p style={{ margin: '2px 0 0 0', fontSize: 12, color: 'var(--text-secondary)' }}>{r.body}</p>
                      </div>
                    )
                  },
                  { key: 'type', label: 'Category', render: v => <span className="badge badge-primary">{v}</span> },
                  {
                    key: 'is_read', label: 'Read Status', render: v => (
                      <span className={`badge ${v ? 'badge-active' : 'badge-pending'}`} style={{ fontSize: 11 }}>
                        {v ? '✓ Read by Captain' : '○ Unread'}
                      </span>
                    )
                  },
                  { key: 'created_at', label: 'Dispatched At', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
                ]}
                data={notifsList}
                searchKeys={['title', 'body', 'type']}
              />
            </div>
          )}

          {/* 16. DEVICES TAB */}
          {activeTab === 'devices' && (
            <div className="card" style={{ padding: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Captain Terminal & Active Mobile Sessions</h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Enforced Single-Device Protection via JWT Nonce Rotation</span>
                </div>
                <button onClick={handleForceLogout} className="btn btn-danger btn-sm" disabled={actionLoading}>
                  <LogOut size={13} /> Force Logout All Devices
                </button>
              </div>

              <DataTable
                maxHeight="480px"
                stickyHeader
                columns={[
                  { key: 'device_name', label: 'Device Model', render: v => <strong>{v}</strong> },
                  { key: 'device_type', label: 'Platform', render: v => <span className="badge badge-primary">{v}</span> },
                  { key: 'app_version', label: 'App Build', render: v => <code>{v}</code> },
                  { key: 'firebase_token', label: 'FCM Token', render: v => <code style={{ fontSize: 11 }}>{v}</code> },
                  {
                    key: 'is_active', label: 'Status', render: v => (
                      <span className={`badge ${v ? 'badge-active' : 'badge-inactive'}`}>
                        {v ? '● Active Terminal' : '○ Logged Out'}
                      </span>
                    )
                  },
                  { key: 'last_active', label: 'Last Active', render: v => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{v}</span> },
                ]}
                data={devicesList}
                searchKeys={['device_name', 'device_type']}
              />
            </div>
          )}

          {/* 17. SERVICE ELIGIBILITY TAB */}
          {activeTab === 'services' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={18} /> Service Category Permissions & Vehicle Mapping
              </h3>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                Services automatically determined based on the captain's approved primary vehicle ({primaryVehicle?.vehicle_type || 'None'}).
              </p>
              {servicesList.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Layers size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No service permissions configured for this vehicle category.</p>
                </div>
              ) : (
                <div className="grid-2" style={{ gap: 14 }}>
                  {servicesList.map(srv => (
                    <div key={srv.id} style={{ padding: 16, borderRadius: 12, background: srv.enabled ? 'rgba(16,185,129,0.08)' : 'var(--bg-secondary)', border: `1px solid ${srv.enabled ? 'rgba(16,185,129,0.25)' : 'var(--border-color)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 24 }}>{srv.icon}</span>
                        <div>
                          <strong style={{ fontSize: 14 }}>{srv.name}</strong>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{srv.desc}</div>
                        </div>
                      </div>
                      <span className={`badge ${srv.enabled ? 'badge-active' : 'badge-inactive'}`} style={{ fontSize: 11 }}>
                        {srv.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 18. ONLINE / DUTY HISTORY TAB */}
          {activeTab === 'online_history' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clock size={18} /> Captain Shift History & Online Duty Tracker
              </h3>
              <DataTable
                maxHeight="480px"
                stickyHeader
                columns={[
                  { key: 'date', label: 'Duty Date', render: v => <strong>{v}</strong> },
                  { key: 'online', label: 'Shift Start', render: v => <span style={{ color: 'var(--status-active)' }}>{v}</span> },
                  { key: 'offline', label: 'Shift End', render: v => <span style={{ color: 'var(--accent-pink)' }}>{v}</span> },
                  { key: 'hours', label: 'Total Online Hours', render: v => <strong>{v} hrs</strong> },
                  { key: 'status', label: 'Duty Status', render: v => <span className="badge badge-active">{v}</span> },
                ]}
                data={dutyHistory}
              />
            </div>
          )}

          {/* 19. INCENTIVES TAB */}
          {activeTab === 'incentives' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="var(--accent-yellow)" /> Active Targets & Captain Incentives ({incentivesList.length})
              </h3>
              {incentivesList.length === 0 ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                  <Sparkles size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <p>No active incentive targets currently assigned to this captain.</p>
                </div>
              ) : (
                <div className="grid-2" style={{ gap: 14 }}>
                  {incentivesList.map(inc => (
                    <div key={inc.id} style={{ padding: 18, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <strong style={{ fontSize: 14 }}>{inc.title}</strong>
                        <span className="badge badge-active" style={{ fontSize: 11 }}>+ ₹{inc.reward} Bonus</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                        <span>Progress: <strong>{inc.completed} / {inc.target} Trips</strong></span>
                        <span>Expires: <strong>{inc.expiry}</strong></span>
                      </div>
                      <div style={{ width: '100%', height: 6, borderRadius: 3, background: 'var(--border-light)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, Math.round((inc.completed / inc.target) * 100))}%`, height: '100%', background: 'var(--accent-gradient)' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 20. ACCOUNT & SECURITY TAB */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div className="card" style={{ padding: 10 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Key size={18} /> Authentication & Access Integrity
                </h3>
                <div className="grid-3" style={{ gap: 14 }}>
                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Account Lock State</span>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: isSuspended ? 'var(--accent-pink)' : 'var(--status-active)' }}>
                      {isSuspended ? 'Suspended / Locked' : 'Active & Clear'}
                    </div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Phone Verification</span>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: driver.is_phone_verified ? 'var(--status-active)' : 'var(--accent-yellow)' }}>
                      {driver.is_phone_verified ? '✓ Verified' : 'Unverified'}
                    </div>
                  </div>

                  <div style={{ padding: 14, background: 'var(--bg-secondary)', borderRadius: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Single-Device Protection</span>
                    <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4, color: 'var(--status-active)' }}>
                      Enforced (JWT Nonce)
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button onClick={handleForceLogout} className="btn btn-secondary btn-sm" disabled={actionLoading}>
                    <LogOut size={13} /> Terminate Device Sessions
                  </button>
                  {isSuspended ? (
                    <button onClick={handleUnsuspend} className="btn btn-success btn-sm" disabled={actionLoading}>
                      <CheckCircle size={13} /> Unsuspend Captain
                    </button>
                  ) : (
                    <button onClick={() => setSuspendDriverModal({ isOpen: true, reason: '' })} className="btn btn-danger btn-sm" disabled={actionLoading}>
                      <Ban size={13} /> Suspend Captain
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 21. ADMIN AUDIT LOGS TAB */}
          {activeTab === 'audit' && (
            <div className="card" style={{ padding: 10 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={18} /> Administrative Action History ({auditLogs.length})
              </h3>
              <DataTable
                maxHeight="440px"
                stickyHeader
                columns={[
                  { key: 'action', label: 'Action Event', render: v => <strong>{v}</strong> },
                  { key: 'actor', label: 'Admin Actor', render: v => <span className="badge badge-primary">{v}</span> },
                  { key: 'details', label: 'Operational Notes', render: v => <span style={{ fontSize: 12 }}>{v}</span> },
                  { key: 'created_at', label: 'Timestamp', render: v => <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v}</span> },
                ]}
                data={auditLogs}
                searchKeys={['action', 'actor', 'details']}
              />
            </div>
          )}

        </div>
      </div>

      {/* ── Document Edit / Verification Modal ── */}
      {editDocModal.isOpen && (() => {
        const docTypeLower = (editDocModal.docType || '').toLowerCase();
        const isPhoto = ['photo', 'passport', 'picture', 'selfie'].some(k => docTypeLower.includes(k));
        const isAadhaar = ['aadhaar', 'adhar', 'aadhar'].some(k => docTypeLower.includes(k));
        const isInsurance = ['insurance', 'ins'].some(k => docTypeLower.includes(k));
        const isRC = ['rc', 'registration'].some(k => docTypeLower.includes(k));
        const isLicense = ['license', 'licence', 'dl', 'driving'].some(k => docTypeLower.includes(k));

        return (
          <Modal
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {isRC || isInsurance ? <Car size={18} /> : (isPhoto ? <User size={18} /> : <FileText size={18} />)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>
                    Review & Update {editDocModal.docType.toUpperCase()}
                  </h3>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Captain: <strong>{driver.name || driver.username}</strong>
                  </span>
                </div>
              </div>
            }
            onClose={() => setEditDocModal(prev => ({ ...prev, isOpen: false }))}
            size="modal-lg"
            footer={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  {!editDocModal.isVerified && editDocModal.docId && (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => {
                        const docId = editDocModal.docId;
                        const docType = editDocModal.docType;
                        setEditDocModal(prev => ({ ...prev, isOpen: false }));
                        setRejectDocModal({ isOpen: true, docId, docType, reason: '' });
                      }}
                      disabled={actionLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setEditDocModal(prev => ({ ...prev, isOpen: false }))}
                  >
                    Cancel
                  </button>
                  {!isPhoto && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => handleSaveDocUpdate(false)}
                      disabled={actionLoading}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      <RefreshCw size={13} /> Update Details
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-success btn-sm"
                    onClick={() => handleSaveDocUpdate(true)}
                    disabled={actionLoading}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <CheckCircle size={14} /> {editDocModal.isVerified ? 'Save & Re-Verify' : 'Approve Document'}
                  </button>
                </div>
              </div>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0' }}>
              
              {/* Document Image Thumbnail Preview if available */}
              {editDocModal.documentUrl && (
                <div
                  style={{
                    position: 'relative',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: '1px solid var(--border-color)',
                    background: '#000000',
                    maxHeight: '180px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => setDocPreviewModal({ isOpen: true, url: editDocModal.documentUrl, title: editDocModal.docType, type: editDocModal.type })}
                  title="Click to view full image"
                >
                  <img
                    src={editDocModal.documentUrl}
                    alt={editDocModal.docType}
                    style={{ maxHeight: '180px', maxWidth: '100%', objectFit: 'contain' }}
                  />
                  <div style={{
                    position: 'absolute',
                    bottom: 6,
                    right: 6,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: 'rgba(0,0,0,0.7)',
                    color: '#fff',
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}>
                    <Eye size={12} /> Expand Preview
                  </div>
                </div>
              )}

              {/* Status Header Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Verification Status</span>
                <span className={`badge ${editDocModal.isVerified ? 'badge-active' : (editDocModal.status === 'rejected' ? 'badge-suspended' : 'badge-pending')}`} style={{ fontSize: 11 }}>
                  {editDocModal.status?.toUpperCase() || (editDocModal.isVerified ? 'VERIFIED' : 'PENDING REVIEW')}
                </span>
              </div>

              {/* Rejection reason if any */}
              {editDocModal.rejectionReason && (
                <div style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  color: 'var(--accent-pink)',
                  fontSize: 12
                }}>
                  <strong>Previous Rejection Note:</strong> {editDocModal.rejectionReason}
                </div>
              )}

              {/* ── 1. Photo Type: No editable fields ── */}
              {isPhoto && (
                <div style={{ padding: 16, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                    <User size={22} />
                  </div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: 15, fontWeight: 700 }}>Captain Passport Photograph</h4>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                    Verify that the photo is clear, front-facing, and matches the Captain identity. No additional input fields required.
                  </p>
                </div>
              )}

              {/* ── 2. Aadhaar Card Fields ── */}
              {isAadhaar && (
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)' }}>
                    <ShieldCheck size={16} /> Aadhaar Card Details
                  </h4>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Aadhaar Number <span style={{ color: 'var(--accent-pink)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. 1234 5678 9012"
                        value={editDocModal.aadhaar_number}
                        onChange={e => setEditDocModal(prev => ({ ...prev, aadhaar_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Full Name (as on Aadhaar)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Full Name"
                        value={editDocModal.name}
                        onChange={e => setEditDocModal(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Date of Birth (DOB)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="YYYY-MM-DD or DD/MM/YYYY"
                        value={editDocModal.dob}
                        onChange={e => setEditDocModal(prev => ({ ...prev, dob: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Gender
                      </label>
                      <select
                        className="form-control"
                        value={editDocModal.gender}
                        onChange={e => setEditDocModal(prev => ({ ...prev, gender: e.target.value }))}
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other / Transgender</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Pincode
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="6-digit Pincode"
                        value={editDocModal.pincode}
                        onChange={e => setEditDocModal(prev => ({ ...prev, pincode: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                      Address
                    </label>
                    <textarea
                      className="form-control"
                      rows={2}
                      placeholder="Full Address as on Aadhaar"
                      value={editDocModal.address}
                      onChange={e => setEditDocModal(prev => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                </div>
              )}

              {/* ── 3. Insurance Policy Fields ── */}
              {isInsurance && (
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)' }}>
                    <FileText size={16} /> Vehicle Insurance Policy Details
                  </h4>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Policy Number <span style={{ color: 'var(--accent-pink)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Insurance Policy Number"
                        value={editDocModal.policy_number}
                        onChange={e => setEditDocModal(prev => ({ ...prev, policy_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Insurer Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. HDFC ERGO, ICICI Lombard, Digit"
                        value={editDocModal.insurer_name}
                        onChange={e => setEditDocModal(prev => ({ ...prev, insurer_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Policy Type
                      </label>
                      <select
                        className="form-control"
                        value={editDocModal.policy_type}
                        onChange={e => setEditDocModal(prev => ({ ...prev, policy_type: e.target.value }))}
                      >
                        <option value="Comprehensive">Comprehensive (First Party)</option>
                        <option value="Third Party">Third Party Only</option>
                        <option value="Zero Depreciation">Zero Depreciation</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Vehicle Registration No
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. DL01AB1234"
                        value={editDocModal.vehicle_registration_no.toUpperCase()}
                        onChange={e => setEditDocModal(prev => ({ ...prev, vehicle_registration_no: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Policy Start Date
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={editDocModal.policy_start_date}
                        onChange={e => setEditDocModal(prev => ({ ...prev, policy_start_date: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Policy Expiry Date <span style={{ color: 'var(--accent-pink)' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={editDocModal.policy_expiry_date || editDocModal.expiresAt}
                        onChange={e => setEditDocModal(prev => ({ ...prev, policy_expiry_date: e.target.value, expiresAt: e.target.value }))}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Insured Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Insured Person / Policy Holder"
                        value={editDocModal.insured_name}
                        onChange={e => setEditDocModal(prev => ({ ...prev, insured_name: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 4. RC (Registration Certificate) Fields ── */}
              {isRC && (
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-yellow)' }}>
                    <Car size={16} /> Registration Certificate (RC) Details
                  </h4>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Registration No (Plate Number) <span style={{ color: 'var(--accent-pink)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. UP90AB1234"
                        value={editDocModal.registration_no.toUpperCase()}
                        onChange={e => setEditDocModal(prev => ({ ...prev, registration_no: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Registered Owner Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Owner Name as on RC"
                        value={editDocModal.owner_name}
                        onChange={e => setEditDocModal(prev => ({ ...prev, owner_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Chassis Number (VIN)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Chassis Number"
                        value={editDocModal.chassis_number.toUpperCase()}
                        onChange={e => setEditDocModal(prev => ({ ...prev, chassis_number: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Engine Number
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Engine Number"
                        value={editDocModal.engine_number.toUpperCase()}
                        onChange={e => setEditDocModal(prev => ({ ...prev, engine_number: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Vehicle Make / Manufacturer
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Honda, Hero, Bajaj, Maruti"
                        value={editDocModal.vehicle_make}
                        onChange={e => setEditDocModal(prev => ({ ...prev, vehicle_make: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Vehicle Model
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. Activa 6G, Splendor, WagonR"
                        value={editDocModal.vehicle_model}
                        onChange={e => setEditDocModal(prev => ({ ...prev, vehicle_model: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Fuel Type
                      </label>
                      <select
                        className="form-control"
                        value={editDocModal.fuel_type}
                        onChange={e => setEditDocModal(prev => ({ ...prev, fuel_type: e.target.value }))}
                      >
                        <option value="Petrol">Petrol</option>
                        <option value="Diesel">Diesel</option>
                        <option value="CNG">CNG</option>
                        <option value="Electric">Electric (EV)</option>
                        <option value="Hybrid">Hybrid</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        RC Fitness / Expiry Date
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={editDocModal.expiresAt}
                        onChange={e => setEditDocModal(prev => ({ ...prev, expiresAt: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 5. Driving License Fields ── */}
              {isLicense && (
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent-primary)' }}>
                    <FileText size={16} /> Driving License Details
                  </h4>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        License Number <span style={{ color: 'var(--accent-pink)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. UP9020210007094"
                        value={editDocModal.license_number.toUpperCase()}
                        onChange={e => setEditDocModal(prev => ({ ...prev, license_number: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        License Holder Name
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Full Name as on License"
                        value={editDocModal.name}
                        onChange={e => setEditDocModal(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Date of Birth (DOB)
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="YYYY-MM-DD"
                        value={editDocModal.dob}
                        onChange={e => setEditDocModal(prev => ({ ...prev, dob: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        License Expiry Date <span style={{ color: 'var(--accent-pink)' }}>*</span>
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={editDocModal.expiresAt}
                        onChange={e => setEditDocModal(prev => ({ ...prev, expiresAt: e.target.value }))}
                      />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Issuing Authority / RTO
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="e.g. RTO, BANDA"
                        value={editDocModal.issuing_authority}
                        onChange={e => setEditDocModal(prev => ({ ...prev, issuing_authority: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── 6. Fallback General Document Fields ── */}
              {!isPhoto && !isAadhaar && !isInsurance && !isRC && !isLicense && (
                <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <div className="grid-2" style={{ gap: 12 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Document Number <span style={{ color: 'var(--accent-pink)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter document number"
                        value={editDocModal.documentNumber.toUpperCase()}
                        onChange={e => setEditDocModal(prev => ({ ...prev, documentNumber: e.target.value.toUpperCase() }))}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>
                        Expiry Date
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        value={editDocModal.expiresAt}
                        onChange={e => setEditDocModal(prev => ({ ...prev, expiresAt: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>
          </Modal>
        );
      })()}

      {/* ── Document Preview Lightbox Modal ── */}
      {docPreviewModal.isOpen && (
        <Modal
          title={`Document Preview: ${docPreviewModal.title}`}
          onClose={() => setDocPreviewModal({ isOpen: false, url: '', title: '', type: '' })}
          size="modal-lg"
        >
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            {docPreviewModal.url ? (
              <img
                src={docPreviewModal.url}
                alt={docPreviewModal.title}
                style={{ maxHeight: '65vh', maxWidth: '100%', borderRadius: 10, border: '1px solid var(--border-color)', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ padding: 40, color: 'var(--text-muted)' }}>
                <FileText size={48} style={{ opacity: 0.3, marginBottom: 8 }} />
                <p>No document preview image available.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── Reject Document Modal ── */}
      {rejectDocModal.isOpen && (
        <Modal
          title={`Reject Document: ${rejectDocModal.docType}`}
          onClose={() => setRejectDocModal({ isOpen: false, docId: null, docType: '', reason: '' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setRejectDocModal({ isOpen: false, docId: null, docType: '', reason: '' })}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleConfirmRejectDoc} disabled={actionLoading}>
                Confirm Rejection
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Please specify the precise reason why this document was rejected so the Captain can upload a corrected version:
            </p>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Image blurry, name mismatch, or expired certificate..."
              value={rejectDocModal.reason}
              onChange={e => setRejectDocModal(prev => ({ ...prev, reason: e.target.value }))}
            />
          </div>
        </Modal>
      )}

      {/* ── Reject Driver Application Modal ── */}
      {rejectDriverModal.isOpen && (
        <Modal
          title="Reject Captain Application"
          onClose={() => setRejectDriverModal({ isOpen: false, reason: '' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setRejectDriverModal({ isOpen: false, reason: '' })}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleConfirmRejectDriver} disabled={actionLoading}>
                Confirm Rejection
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              State the reason for rejecting this Captain partner application:
            </p>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Incomplete documentation or background check discrepancy..."
              value={rejectDriverModal.reason}
              onChange={e => setRejectDriverModal(prev => ({ ...prev, reason: e.target.value }))}
            />
          </div>
        </Modal>
      )}

      {/* ── Suspend Driver Modal ── */}
      {suspendDriverModal.isOpen && (
        <Modal
          title="Suspend Captain Partner"
          onClose={() => setSuspendDriverModal({ isOpen: false, reason: '' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setSuspendDriverModal({ isOpen: false, reason: '' })}>
                Cancel
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleConfirmSuspend} disabled={actionLoading}>
                Confirm Suspension
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
              Suspending this Captain will revoke login access, take the Captain offline immediately, and prevent future booking assignments:
            </p>
            <textarea
              className="form-control"
              rows={3}
              placeholder="e.g. Serious passenger safety complaint or policy violation..."
              value={suspendDriverModal.reason}
              onChange={e => setSuspendDriverModal(prev => ({ ...prev, reason: e.target.value }))}
            />
          </div>
        </Modal>
      )}

      {/* ── Wallet Adjustment Modal ── */}
      {walletModal.isOpen && (
        <Modal
          title={`Adjust Captain Wallet Balance: ${driver.name || driver.username}`}
          onClose={() => setWalletModal({ isOpen: false, type: 'credit', amount: '', reason: '' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setWalletModal({ isOpen: false, type: 'credit', amount: '', reason: '' })}>
                Cancel
              </button>
              <button
                className={`btn btn-sm ${walletModal.type === 'credit' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleWalletAdjust}
                disabled={actionLoading}
              >
                {walletModal.type === 'credit' ? 'Confirm Credit' : 'Confirm Debit'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
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
                placeholder="Enter adjustment amount (e.g. 500)"
                value={walletModal.amount}
                onChange={e => setWalletModal(prev => ({ ...prev, amount: e.target.value }))}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Operational Reason / Note</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Peak hour challenge bonus, penalty deduction..."
                value={walletModal.reason}
                onChange={e => setWalletModal(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Push Notification Dispatch Modal ── */}
      {notifModal.isOpen && (
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(6,182,212,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BellRing size={18} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Send Push Alert to Captain</h3>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Dispatching to terminal of <strong>{driver.name || driver.username}</strong>
                </span>
              </div>
            </div>
          }
          onClose={() => setNotifModal({ isOpen: false, title: '', body: '', type: 'System' })}
          footer={
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setNotifModal({ isOpen: false, title: '', body: '', type: 'System' })}>
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSendNotification}
                disabled={actionLoading || !notifModal.title.trim() || !notifModal.body.trim()}
              >
                {actionLoading ? 'Dispatching...' : 'Send Push Alert'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 0' }}>
            {/* Quick Presets */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Sparkles size={13} color="var(--accent-yellow)" /> Quick Templates for Captains
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: '🎯 8-Ride Target Bonus', title: 'Complete 8 Rides & Earn ₹300 Bonus!', body: 'High demand today! Complete 8 trips during peak hours to unlock an instant ₹300 cash bonus.', type: 'Promotional' },
                  { label: '⚡ Surge Active in Zone', title: 'Surge Active in Cyber City', body: '1.4x Surge multiplier active in Sector 29 & DLF Cyber Hub. Move to this zone for faster bookings.', type: 'System' },
                  { label: '📄 Document Update Required', title: 'Action: Document Expiration Notice', body: 'Your vehicle insurance is expiring soon. Please upload updated certificate to avoid duty disruption.', type: 'System' },
                ].map((tmpl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setNotifModal(prev => ({ ...prev, title: tmpl.title, body: tmpl.body, type: tmpl.type }))}
                    className="btn btn-secondary btn-xs"
                    style={{ fontSize: 11, borderRadius: 20 }}
                  >
                    {tmpl.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Alert Title</label>
              <input
                type="text"
                className="form-control"
                placeholder="e.g. Surge active in your zone!"
                value={notifModal.title}
                onChange={e => setNotifModal(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, fontWeight: 700, display: 'block', marginBottom: 4 }}>Message Content</label>
              <textarea
                className="form-control"
                rows={3}
                placeholder="Enter alert text to display as push banner on Captain partner app..."
                value={notifModal.body}
                onChange={e => setNotifModal(prev => ({ ...prev, body: e.target.value }))}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Reusable Alert Modal ── */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        confirmText={alertModal.confirmText}
        cancelText={alertModal.cancelText}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
}
