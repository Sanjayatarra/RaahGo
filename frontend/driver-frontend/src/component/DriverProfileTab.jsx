import React, { useState, useEffect } from 'react';
import {
  User, Car, FileText, CreditCard, Shield, ShieldCheck, Star,
  Phone, Mail, Calendar, MapPin, Award, LogOut, ChevronRight,
  Settings, Headphones, AlertTriangle, CheckCircle2, XCircle, Clock,
  Volume2, Navigation, Upload, Eye, RefreshCw, Check, Edit3, Plus,
  Lock, AlertCircle, Sparkles, Building2, Info
} from 'lucide-react';
import { fetchWithAuth } from '../common/apiClient';

const STANDARD_DOC_TYPES = [
  { key: 'License', title: 'Driving License', desc: 'Commercial Driving License', matchKeys: ['license', 'licence', 'dl', 'driving'] },
  { key: 'Aadhaar', title: 'Aadhaar Card', desc: 'Government-issued UIDAI identification', matchKeys: ['aadhaar', 'adhar', 'aadhar', 'uidai'] },
  { key: 'Photo', title: 'Passport Photo', desc: 'Captain Passport Size Photograph', matchKeys: ['photo', 'passport', 'picture', 'selfie'] },
  { key: 'RC', title: 'Registration Certificate (RC)', desc: 'Official Vehicle Registration Document', matchKeys: ['rc', 'registration'] },
  { key: 'Insurance', title: 'Vehicle Insurance', desc: 'Active Commercial Vehicle Insurance Policy', matchKeys: ['insurance', 'ins'] },
  { key: 'Permit', title: 'Transport Permit / Fitness', desc: 'Commercial fitness & permit certificate', matchKeys: ['permit', 'fitness', 'puc', 'transport'] },
];

export default function DriverProfileTab({
  driverProfile,
  user,
  onLogout,
  onShowAlert,
  onRefreshProfile
}) {
  const [activeModal, setActiveModal] = useState(null); // 'personal' | 'vehicle' | 'docs' | 'bank' | 'safety' | 'emergency' | 'settings' | 'support'
  const [isModalLoading, setIsModalLoading] = useState(false);

  // ── Tab-specific Live State ──────────────────────────────────────────
  const [modalDocs, setModalDocs] = useState(null);
  const [modalBank, setModalBank] = useState(null);
  const [modalVehicle, setModalVehicle] = useState(null);
  const [modalEmergency, setModalEmergency] = useState(null);

  // ── Personal Info State (One-time edit if not existed) ─────────────
  const [personalForm, setPersonalForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone_number: '',
    operating_address: '',
    service_city: '',
    operating_pincode: ''
  });
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);

  // ── Bank Form State (Editable -> Status Uploaded / Pending) ─────────
  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bank_name: '',
    account_holder_name: '',
    account_number: '',
    confirm_account_number: '',
    ifsc_code: ''
  });
  const [isSavingBank, setIsSavingBank] = useState(false);

  // ── Emergency Contact State ─────────────────────────────────────────
  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({
    name: '',
    relationship: 'Family',
    phone_number: ''
  });
  const [isSavingEmergency, setIsSavingEmergency] = useState(false);

  // ── Document Upload / Edit Modal State ──────────────────────────────
  const [docUploadModal, setDocUploadModal] = useState(null); // { docType, docTitle, existingDoc }
  const [docNumberInput, setDocNumberInput] = useState('');
  const [docFileInput, setDocFileInput] = useState(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);

  // ── Rejected Document Re-upload ────────────────────────────────────
  const [selectedRejectedDoc, setSelectedRejectedDoc] = useState(null);
  const [reuploadNumber, setReuploadNumber] = useState('');
  const [reuploadFile, setReuploadFile] = useState(null);
  const [isSubmittingReupload, setIsSubmittingReupload] = useState(false);

  // Profile data extraction
  const driverName = driverProfile?.user?.first_name
    ? `${driverProfile.user.first_name} ${driverProfile.user.last_name || ''}`.trim()
    : (user?.name || user?.user?.first_name || 'Captain');

  const phone = driverProfile?.user?.phone_number || user?.phone_number || '—';
  const email = driverProfile?.user?.email || user?.email || '—';
  const rating = driverProfile?.rating ? parseFloat(driverProfile.rating).toFixed(1) : '5.0';
  const totalTrips = driverProfile?.total_trips ?? 0;

  const vehicle = driverProfile?.vehicle || (driverProfile?.vehicles && driverProfile.vehicles[0]) || null;
  const documents = Array.isArray(driverProfile?.documents) ? driverProfile.documents : [];
  const bank = driverProfile?.bank || null;
  const emergency = driverProfile?.emergency_contact || null;

  // Active modal-specific fallback sources
  const activeDocs = modalDocs !== null ? modalDocs : documents;
  const activeBank = modalBank !== null ? modalBank : bank;
  const activeVehicle = modalVehicle !== null ? modalVehicle : vehicle;
  const activeEmergency = modalEmergency !== null ? modalEmergency : emergency;

  const rejectedDocsCount = activeDocs.filter(
    (d) => String(d.verification_status || d.status).toLowerCase() === 'rejected'
  ).length;

  // Dedicated fetch function for each individual tab
  const fetchSectionData = async (sectionId) => {
    setIsModalLoading(true);
    try {
      if (sectionId === 'docs') {
        const res = await fetchWithAuth('/api/v1/driver/documents/');
        if (res.ok) {
          const data = await res.json();
          setModalDocs(Array.isArray(data) ? data : []);
        }
      } else if (sectionId === 'bank') {
        const res = await fetchWithAuth('/api/v1/driver/bank/');
        if (res.ok) {
          const data = await res.json();
          setModalBank(data);
          if (data) {
            setBankForm({
              bank_name: data.bank_name || '',
              account_holder_name: data.account_holder_name || '',
              account_number: data.account_number || '',
              confirm_account_number: data.account_number || '',
              ifsc_code: data.ifsc_code || ''
            });
          }
        }
      } else if (sectionId === 'vehicle') {
        const res = await fetchWithAuth('/api/v1/driver/vehicle/');
        if (res.ok) {
          const data = await res.json();
          const v = Array.isArray(data) ? data[0] : data;
          setModalVehicle(v || null);
        }
      } else if (sectionId === 'emergency') {
        const res = await fetchWithAuth('/api/v1/driver/emergency-contacts/');
        if (res.ok) {
          const data = await res.json();
          setModalEmergency(data);
          if (data) {
            setEmergencyForm({
              name: data.name || '',
              relationship: data.relationship || 'Family',
              phone_number: data.phone_number || ''
            });
          }
        }
      } else if (sectionId === 'personal') {
        const res = await fetchWithAuth('/api/v1/driver/profile/');
        if (res.ok) {
          const data = await res.json();
          if (data?.user) {
            setPersonalForm({
              first_name: data.user.first_name || '',
              last_name: data.user.last_name || '',
              email: data.user.email || '',
              phone_number: data.user.phone_number || '',
              operating_address: data.operating_address || '',
              service_city: data.service_city || '',
              operating_pincode: data.operating_pincode || ''
            });
          }
        }
      }
    } catch (err) {
      console.log(`Error fetching ${sectionId} details:`, err);
    } finally {
      setIsModalLoading(false);
    }
  };

  // Open modal and fetch its dedicated API individually
  const openSectionModal = (sectionId) => {
    setActiveModal(sectionId);
    setIsEditingBank(false);
    setIsEditingEmergency(false);
    fetchSectionData(sectionId);
  };

  // Initialize Forms when driverProfile updates
  useEffect(() => {
    if (driverProfile) {
      setPersonalForm({
        first_name: driverProfile?.user?.first_name || '',
        last_name: driverProfile?.user?.last_name || '',
        email: driverProfile?.user?.email || '',
        phone_number: driverProfile?.user?.phone_number || '',
        operating_address: driverProfile?.operating_address || '',
        service_city: driverProfile?.service_city || '',
        operating_pincode: driverProfile?.operating_pincode || ''
      });

      if (bank) {
        setBankForm({
          bank_name: bank.bank_name || '',
          account_holder_name: bank.account_holder_name || '',
          account_number: bank.account_number || '',
          confirm_account_number: bank.account_number || '',
          ifsc_code: bank.ifsc_code || ''
        });
      }

      if (emergency) {
        setEmergencyForm({
          name: emergency.name || '',
          relationship: emergency.relationship || 'Family',
          phone_number: emergency.phone_number || ''
        });
      }
    }
  }, [driverProfile, bank, emergency]);

  // ── 1. Personal Information Submit (One-Time for Missing Fields) ──
  const handleSavePersonal = async (e) => {
    e.preventDefault();
    setIsSavingPersonal(true);
    try {
      const payload = {};
      if (!driverProfile?.user?.first_name && personalForm.first_name) payload.first_name = personalForm.first_name.trim();
      if (!driverProfile?.user?.last_name && personalForm.last_name) payload.last_name = personalForm.last_name.trim();
      if (!driverProfile?.user?.email && personalForm.email) payload.email = personalForm.email.trim();
      if (!driverProfile?.user?.phone_number && personalForm.phone_number) payload.phone_number = personalForm.phone_number.trim();
      if (!driverProfile?.operating_address && personalForm.operating_address) payload.operating_address = personalForm.operating_address.trim();
      if (!driverProfile?.service_city && personalForm.service_city) payload.service_city = personalForm.service_city.trim();
      if (!driverProfile?.operating_pincode && personalForm.operating_pincode) payload.operating_pincode = personalForm.operating_pincode.trim();

      const res = await fetchWithAuth('/api/v1/driver/profile/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchSectionData('personal');
        if (onRefreshProfile) onRefreshProfile();
        if (onShowAlert) {
          onShowAlert('Personal information saved successfully and locked.', 'Profile Updated', 'success');
        }
        setActiveModal(null);
      } else {
        const err = await res.json();
        if (onShowAlert) {
          onShowAlert(err.error || 'Failed to update personal details.', 'Update Error', 'error');
        }
      }
    } catch (err) {
      console.log('Update personal error:', err);
      if (onShowAlert) onShowAlert('Network error while updating details.', 'Error', 'error');
    } finally {
      setIsSavingPersonal(false);
    }
  };

  // ── 2. Bank Submit (Editable -> Status Uploaded, Admin shows Pending) ──
  const handleSaveBank = async (e) => {
    e.preventDefault();
    if (!bankForm.bank_name || !bankForm.account_number || !bankForm.ifsc_code || !bankForm.account_holder_name) {
      if (onShowAlert) onShowAlert('Please fill in all bank details.', 'Missing Details', 'error');
      return;
    }

    if (bankForm.account_number !== bankForm.confirm_account_number) {
      if (onShowAlert) onShowAlert('Account numbers do not match.', 'Validation Error', 'error');
      return;
    }

    setIsSavingBank(true);
    try {
      const res = await fetchWithAuth('/api/v1/driver/bank/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bank_name: bankForm.bank_name.trim(),
          account_holder_name: bankForm.account_holder_name.trim(),
          account_number: bankForm.account_number.trim(),
          ifsc_code: bankForm.ifsc_code.trim().toUpperCase()
        })
      });

      if (res.ok) {
        setIsEditingBank(false);
        fetchSectionData('bank');
        if (onRefreshProfile) onRefreshProfile();
        if (onShowAlert) {
          onShowAlert(
            'Bank account details uploaded successfully! Status is set to Uploaded and queued for Admin verification.',
            'Bank Details Uploaded',
            'success'
          );
        }
      } else {
        const err = await res.json();
        if (onShowAlert) onShowAlert(err.error || 'Failed to save bank details.', 'Error', 'error');
      }
    } catch (err) {
      console.log('Bank save error:', err);
      if (onShowAlert) onShowAlert('Network error saving bank details.', 'Error', 'error');
    } finally {
      setIsSavingBank(false);
    }
  };

  // ── Emergency Contact Submit ────────────────────────────────────────
  const handleSaveEmergency = async (e) => {
    e.preventDefault();
    if (!emergencyForm.name || !emergencyForm.phone_number) {
      if (onShowAlert) onShowAlert('Please provide contact name and phone number.', 'Validation Error', 'error');
      return;
    }
    setIsSavingEmergency(true);
    try {
      const res = await fetchWithAuth('/api/v1/driver/emergency-contacts/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emergencyForm)
      });
      if (res.ok) {
        setIsEditingEmergency(false);
        fetchSectionData('emergency');
        if (onRefreshProfile) onRefreshProfile();
        if (onShowAlert) onShowAlert('Emergency contact saved successfully.', 'Saved', 'success');
      } else {
        const err = await res.json();
        if (onShowAlert) onShowAlert(err.error || 'Failed to save contact.', 'Error', 'error');
      }
    } catch (err) {
      if (onShowAlert) onShowAlert('Network error saving emergency contact.', 'Error', 'error');
    } finally {
      setIsSavingEmergency(false);
    }
  };

  // ── 3. Document Upload / Edit Submit (Status Uploaded, Admin shows Pending) ──
  const handleOpenDocModal = (docTypeKey, docTitle, existingDoc = null) => {
    setDocUploadModal({
      docType: docTypeKey,
      docTitle: docTitle,
      existingDoc: existingDoc
    });
    setDocNumberInput(existingDoc?.document_number && existingDoc.document_number !== '—' ? existingDoc.document_number : '');
    setDocFileInput(null);
  };

  const handleSaveDocUpload = async (e) => {
    e.preventDefault();
    if (!docUploadModal) return;

    setIsSavingDoc(true);
    try {
      const formData = new FormData();
      formData.append('document_type', docUploadModal.docType);
      if (docNumberInput) {
        formData.append('document_number', docNumberInput.trim());
      }
      if (docFileInput) {
        formData.append('file', docFileInput);
      } else if (docUploadModal.existingDoc?.document_url) {
        formData.append('document_url', docUploadModal.existingDoc.document_url);
      } else {
        formData.append('document_url', `https://storage.raahgo.com/docs/${docUploadModal.docType}_uploaded.pdf`);
      }

      const url = docUploadModal.existingDoc?.id
        ? `/api/v1/driver/documents/${docUploadModal.existingDoc.id}/`
        : '/api/v1/driver/documents/';

      const res = await fetchWithAuth(url, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setDocUploadModal(null);
        if (onRefreshProfile) onRefreshProfile();
        if (onShowAlert) {
          onShowAlert(
            `${docUploadModal.docTitle} uploaded successfully! Status is set to Uploaded and submitted for Admin verification.`,
            'Document Uploaded',
            'success'
          );
        }
      } else {
        const err = await res.json();
        if (onShowAlert) onShowAlert(err.error || 'Failed to upload document.', 'Upload Error', 'error');
      }
    } catch (err) {
      console.log('Doc upload error:', err);
      if (onShowAlert) onShowAlert('Network error uploading document.', 'Upload Error', 'error');
    } finally {
      setIsSavingDoc(false);
    }
  };

  // ── 4. Rejected Doc Re-upload Submit ────────────────────────────────
  const handleOpenDocRejectionModal = (doc) => {
    setSelectedRejectedDoc(doc);
    setReuploadNumber(doc.document_number !== '—' ? (doc.document_number || '') : '');
    setReuploadFile(null);
  };

  const handleReuploadSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRejectedDoc) return;

    setIsSubmittingReupload(true);
    try {
      const formData = new FormData();
      if (reuploadNumber) formData.append('document_number', reuploadNumber);
      if (reuploadFile) {
        formData.append('file', reuploadFile);
      } else {
        formData.append('document_url', selectedRejectedDoc.document_url || 'https://storage.raahgo.com/docs/reuploaded.pdf');
      }

      const res = await fetchWithAuth(`/api/v1/driver/documents/${selectedRejectedDoc.id}/`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setSelectedRejectedDoc(null);
        if (onRefreshProfile) onRefreshProfile();
        if (onShowAlert) {
          onShowAlert(
            `${selectedRejectedDoc.document_type?.toUpperCase() || 'Document'} re-uploaded! Status is now Uploaded (Pending Admin Review).`,
            'Document Re-uploaded',
            'success'
          );
        }
      } else {
        const err = await res.json();
        if (onShowAlert) onShowAlert(err.error || 'Failed to re-upload document.', 'Upload Error', 'error');
      }
    } catch (err) {
      console.log('Re-upload error:', err);
      if (onShowAlert) onShowAlert('Network error while re-uploading.', 'Upload Error', 'error');
    } finally {
      setIsSubmittingReupload(false);
    }
  };

  // Missing field calculations for Personal Info
  const hasFirstName = Boolean(driverProfile?.user?.first_name?.trim());
  const hasLastName = Boolean(driverProfile?.user?.last_name?.trim());
  const hasPhone = Boolean(driverProfile?.user?.phone_number?.trim() || user?.phone_number?.trim());
  const hasEmail = Boolean(driverProfile?.user?.email?.trim() || user?.email?.trim());
  const hasAddress = Boolean(driverProfile?.operating_address?.trim());
  const hasCity = Boolean(driverProfile?.service_city?.trim());
  const hasPincode = Boolean(driverProfile?.operating_pincode?.trim());
  const hasMissingPersonalFields = !hasFirstName || !hasLastName || !hasEmail || !hasPhone || !hasAddress || !hasCity || !hasPincode;

  // Build menu sections: ONLY show Vehicle if vehicle exists (Admin assigned, read-only)
  const MENU_SECTIONS = [
    {
      id: 'personal',
      title: 'Personal Information',
      subtitle: `${phone} • ${email}`,
      icon: User,
      badge: hasMissingPersonalFields ? 'Incomplete • Fill Missing' : 'Verified',
      badgeColor: hasMissingPersonalFields ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
    },
    ...(vehicle ? [{
      id: 'vehicle',
      title: 'Vehicle Information',
      subtitle: `${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.registration_number || vehicle.vehicle_number || ''})`.trim(),
      icon: Car,
      badge: vehicle.is_approved ? 'Verified' : 'Assigned • Pending Admin',
      badgeColor: vehicle.is_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
    }] : []),
    {
      id: 'docs',
      title: 'KYC & Verification Documents',
      subtitle: rejectedDocsCount > 0
        ? `⚠️ ${rejectedDocsCount} Rejected Document (Action Required)`
        : documents.length > 0 ? `${documents.length} documents on file` : 'Pending document upload (Click to upload)',
      icon: FileText,
      badge: rejectedDocsCount > 0 ? `${rejectedDocsCount} Rejected` : (documents.length >= 4 ? 'Uploaded' : '+ Upload Docs'),
      badgeColor: rejectedDocsCount > 0 ? 'bg-red-500 text-white' : 'bg-emerald-100 text-emerald-800'
    },
    {
      id: 'bank',
      title: 'Bank Account & Payouts',
      subtitle: bank ? `${bank.bank_name} •••• ${bank.account_number?.slice(-4)}` : 'No bank account added (Click to add)',
      icon: CreditCard,
      badge: bank ? (bank.is_verified ? 'Verified' : 'Uploaded • Pending') : '+ Add Bank',
      badgeColor: bank ? (bank.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800') : 'bg-blue-100 text-blue-800'
    },
    {
      id: 'safety',
      title: 'Insurance & Safety Protection',
      subtitle: 'RaahGo Captain Partner cover active',
      icon: Shield
    },
    {
      id: 'emergency',
      title: 'Emergency Contact (ICE)',
      subtitle: emergency ? `${emergency.name} (${emergency.relationship})` : 'Not configured',
      icon: AlertTriangle
    },
    {
      id: 'settings',
      title: 'App Settings & Sound',
      subtitle: 'Auto-accept, navigation & audio chime',
      icon: Settings
    },
    {
      id: 'support',
      title: 'Help & Partner Support',
      subtitle: '24x7 Captain assistance & emergency hotline',
      icon: Headphones
    },
  ];

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4">
      {/* Header Profile Card */}
      <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-400 to-[#FFC000] text-black font-black text-2xl sm:text-3xl flex items-center justify-center shadow-md shrink-0">
            {driverName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-gray-900 truncate">
                {driverName}
              </h2>
              {driverProfile?.approval_status === 'Approved' ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-extrabold border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified Captain
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-[11px] font-extrabold border border-amber-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> {driverProfile?.approval_status || 'Under Review'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
              <span className="flex items-center gap-1 font-bold text-gray-800">
                <Star className="w-3.5 h-3.5 fill-[#FFD93D] text-[#FFD93D]" /> {rating}
              </span>
              <span>•</span>
              <span>{totalTrips} Trips Completed</span>
              {driverProfile?.license_number && (
                <>
                  <span>•</span>
                  <span className="text-gray-600 font-mono">#{driverProfile.license_number}</span>
                </>
              )}
            </div>

            {/* Active Vehicle Badge (Only shown if vehicle exists) */}
            {vehicle && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100/90 rounded-xl text-xs font-semibold text-gray-800 border border-gray-200">
                <Car className="w-3.5 h-3.5 text-[#FFC000]" />
                <span>
                  {vehicle.make} {vehicle.model} • <strong className="font-mono">{vehicle.registration_number || vehicle.vehicle_number}</strong>
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                  vehicle.is_approved ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {vehicle.is_approved ? 'Verified' : 'Assigned'}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KYC Alert if rejected docs exist */}
      {rejectedDocsCount > 0 && (
        <div
          onClick={() => openSectionModal('docs')}
          className="p-4 bg-red-50 border border-red-200 rounded-2xl cursor-pointer hover:bg-red-100/70 transition-colors flex items-center justify-between shadow-xs"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-red-500 text-white">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-red-900">
                {rejectedDocsCount} Document Rejected by Admin
              </h4>
              <p className="text-xs text-red-700">
                Click here to view reason and re-upload document to complete KYC verification.
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-red-400 shrink-0" />
        </div>
      )}

      {/* Profile Sections List */}
      <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden divide-y divide-gray-100 shadow-xs">
        {MENU_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              onClick={() => openSectionModal(sec.id)}
              className="w-full p-4 sm:p-4.5 flex items-center justify-between text-left hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3.5 min-w-0 pr-2">
                <div className="p-2.5 rounded-xl bg-gray-100 text-gray-700 shrink-0">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-gray-900 truncate">{sec.title}</h4>
                    {sec.badge && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${sec.badgeColor}`}>
                        {sec.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{sec.subtitle}</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
            </button>
          );
        })}
      </div>

      {/* Logout Action */}
      <button
        onClick={onLogout}
        className="w-full p-4 rounded-2xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-xs"
      >
        <LogOut className="w-4 h-4" /> Logout from RaahGo Driver Partner
      </button>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Main Details Modal ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-extrabold text-base sm:text-lg text-gray-900">
                  {MENU_SECTIONS.find(s => s.id === activeModal)?.title || 'Details'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setActiveModal(null);
                  setIsEditingBank(false);
                  setIsEditingEmergency(false);
                }}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="text-xs sm:text-sm text-gray-700 space-y-3.5 max-h-[65vh] overflow-y-auto pr-1">
              {isModalLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2.5 text-gray-500">
                  <RefreshCw className="w-7 h-7 animate-spin text-[#FFC000]" />
                  <p className="text-xs font-bold text-gray-700">Loading latest {MENU_SECTIONS.find(s => s.id === activeModal)?.title || 'data'}…</p>
                </div>
              ) : (
                <>
                  {/* ──────────────────────────────────────────────────────────── */}
                  {/* 1. PERSONAL INFORMATION (One-Time Edit on Missing Fields)   */}
                  {/* ──────────────────────────────────────────────────────────── */}
                  {activeModal === 'personal' && (
                    <form onSubmit={handleSavePersonal} className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* First Name */}
                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-gray-500">First Name</span>
                            {hasFirstName ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Locked
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Empty • Fill Once
                              </span>
                            )}
                          </div>
                          {hasFirstName ? (
                            <p className="font-bold text-gray-900">{driverProfile?.user?.first_name}</p>
                          ) : (
                            <input
                              type="text"
                              value={personalForm.first_name}
                              onChange={(e) => setPersonalForm({ ...personalForm, first_name: e.target.value })}
                              placeholder="Enter your first name"
                              className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          )}
                        </div>

                        {/* Last Name */}
                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-gray-500">Last Name</span>
                            {hasLastName ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Locked
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Empty • Fill Once
                              </span>
                            )}
                          </div>
                          {hasLastName ? (
                            <p className="font-bold text-gray-900">{driverProfile?.user?.last_name || '—'}</p>
                          ) : (
                            <input
                              type="text"
                              value={personalForm.last_name}
                              onChange={(e) => setPersonalForm({ ...personalForm, last_name: e.target.value })}
                              placeholder="Enter your last name"
                              className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                            />
                          )}
                        </div>

                        {/* Email Address */}
                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-gray-500">Email Address</span>
                            {hasEmail ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Locked
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Empty • Fill Once
                              </span>
                            )}
                          </div>
                          {hasEmail ? (
                            <p className="font-bold text-gray-900">{driverProfile?.user?.email}</p>
                          ) : (
                            <input
                              type="email"
                              value={personalForm.email}
                              onChange={(e) => setPersonalForm({ ...personalForm, email: e.target.value })}
                              placeholder="name@example.com"
                              className="w-full mt-1 p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          )}
                        </div>

                        {/* Registered Phone */}
                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-gray-500">Mobile Phone Number</span>
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5" /> Verified OTP
                            </span>
                          </div>
                          <p className="font-mono font-bold text-gray-900">{phone}</p>
                        </div>

                        {/* Operating Address */}
                        <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 sm:col-span-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[11px] font-bold text-gray-500">Service Base Address</span>
                            {hasAddress && hasCity ? (
                              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <Lock className="w-2.5 h-2.5" /> Locked
                              </span>
                            ) : (
                              <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                                Fill Missing
                              </span>
                            )}
                          </div>
                          {hasAddress && hasCity ? (
                            <p className="font-bold text-gray-900">
                              {driverProfile?.operating_address}, {driverProfile?.service_city} {driverProfile?.operating_pincode}
                            </p>
                          ) : (
                            <div className="space-y-2 mt-1">
                              <input
                                type="text"
                                value={personalForm.operating_address}
                                onChange={(e) => setPersonalForm({ ...personalForm, operating_address: e.target.value })}
                                placeholder="Street / Area Address"
                                className="w-full p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  value={personalForm.service_city}
                                  onChange={(e) => setPersonalForm({ ...personalForm, service_city: e.target.value })}
                                  placeholder="City (e.g. Delhi, Noida)"
                                  className="p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={personalForm.operating_pincode}
                                  onChange={(e) => setPersonalForm({ ...personalForm, operating_pincode: e.target.value })}
                                  placeholder="Pincode"
                                  className="p-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Submit missing personal info */}
                      {hasMissingPersonalFields ? (
                        <button
                          type="submit"
                          disabled={isSavingPersonal}
                          className="w-full py-3 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold rounded-2xl text-xs sm:text-sm shadow-md transition-all flex items-center justify-center gap-2"
                        >
                          {isSavingPersonal ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          <span>Save & Lock Missing Information</span>
                        </button>
                      ) : (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>All personal profile information is complete, verified and locked.</span>
                        </div>
                      )}
                    </form>
                  )}

                  {/* ──────────────────────────────────────────────────────────── */}
                  {/* 2. VEHICLE INFORMATION (Read-Only • Assigned by Admin)       */}
                  {/* ──────────────────────────────────────────────────────────── */}
                  {activeModal === 'vehicle' && (
                    activeVehicle ? (
                      <div className="space-y-3">
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                          <div>
                            <span className="text-gray-400 text-[10px] uppercase font-bold">Assigned Vehicle</span>
                            <p className="font-extrabold text-base sm:text-lg text-gray-900">{activeVehicle.make} {activeVehicle.model}</p>
                          </div>
                          <span className="px-3 py-1 rounded-xl bg-gray-200 text-gray-800 text-xs font-bold capitalize">
                            {activeVehicle.vehicle_type || 'Vehicle'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className="text-gray-400 text-[10px] uppercase font-bold">Registration / Plate</span>
                            <p className="font-mono font-black text-gray-900 text-sm mt-0.5">
                              {activeVehicle.registration_number || activeVehicle.vehicle_number || '—'}
                            </p>
                          </div>
                          <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <span className="text-gray-400 text-[10px] uppercase font-bold">Color / Model Year</span>
                            <p className="font-bold text-gray-900 text-sm mt-0.5">
                              {activeVehicle.color || 'Standard'} • {activeVehicle.year || 2024}
                            </p>
                          </div>
                        </div>

                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 text-xs flex items-center gap-2">
                          <Info className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Vehicle assignment and approval is managed directly by RaahGo Operations.</span>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center text-gray-500 space-y-2">
                        <Car className="w-8 h-8 text-gray-300 mx-auto" />
                        <p className="font-bold text-gray-700">No Vehicle Assigned</p>
                        <p className="text-xs text-gray-500">Contact RaahGo Admin to link and verify your vehicle.</p>
                      </div>
                    )
                  )}

                  {/* ──────────────────────────────────────────────────────────── */}
                  {/* 3. KYC DOCUMENTS (Editable -> Status Uploaded/Pending)       */}
                  {/* ──────────────────────────────────────────────────────────── */}
                  {activeModal === 'docs' && (
                    <div className="space-y-3">
                      <div className="space-y-2.5">
                        {STANDARD_DOC_TYPES.map((stdDoc) => {
                          const matchedDoc = activeDocs.find((d) => {
                            const rawType = String(d.document_type || d.type || '').toLowerCase();
                            return (stdDoc.matchKeys || [stdDoc.key.toLowerCase()]).some((k) =>
                              rawType === k || rawType.includes(k) || k.includes(rawType)
                            );
                          });

                          const isRejected = matchedDoc && (String(matchedDoc.verification_status || matchedDoc.status).toLowerCase() === 'rejected');
                          const isVerified = matchedDoc && (String(matchedDoc.verification_status || matchedDoc.status).toLowerCase() === 'verified');
                          const isUploaded = Boolean(matchedDoc);

                          return (
                            <div
                              key={stdDoc.key}
                              className={`p-3.5 rounded-2xl border transition-all ${
                                isRejected
                                  ? 'bg-red-50/50 border-red-200'
                                  : isVerified
                                  ? 'bg-emerald-50/40 border-emerald-200'
                                  : isUploaded
                                  ? 'bg-amber-50/40 border-amber-200'
                                  : 'bg-gray-50 border-gray-200/80 border-dashed'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-start gap-2.5">
                                  <div className={`p-2 rounded-xl mt-0.5 ${
                                    isRejected ? 'bg-red-100 text-red-700' : isVerified ? 'bg-emerald-100 text-emerald-700' : isUploaded ? 'bg-amber-100 text-amber-700' : 'bg-gray-200 text-gray-600'
                                  }`}>
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-xs sm:text-sm text-gray-900">{stdDoc.title}</p>
                                    <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                                      {matchedDoc?.document_number && matchedDoc.document_number !== '—' ? `#${matchedDoc.document_number}` : stdDoc.desc}
                                    </p>
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="flex items-center gap-2 shrink-0">
                                  {isUploaded ? (
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black capitalize ${
                                      isVerified
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isRejected
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {isVerified ? '✓ Verified' : isRejected ? 'Rejected' : 'Uploaded'}
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-gray-200 text-gray-600">
                                      Not Uploaded
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Actions / Rejection notice */}
                              <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                                <div className="text-[10px] text-gray-500 truncate max-w-[200px]">
                                  {isRejected ? (
                                    <span className="text-red-600 font-bold">{matchedDoc.rejection_reason || 'Rejected by Admin'}</span>
                                  ) : isVerified ? (
                                    <span className="text-emerald-700 font-medium">Verified by RaahGo Operations</span>
                                  ) : isUploaded ? (
                                    <span className="text-amber-700 font-medium">Pending Admin verification</span>
                                  ) : (
                                    <span>Required for KYC verification</span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isRejected) {
                                      handleOpenDocRejectionModal(matchedDoc);
                                    } else {
                                      handleOpenDocModal(stdDoc.key, stdDoc.title, matchedDoc);
                                    }
                                  }}
                                  className={`px-3 py-1 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1 transition-colors ${
                                    isRejected
                                      ? 'bg-red-600 hover:bg-red-700 text-white'
                                      : isUploaded
                                      ? 'bg-gray-800 hover:bg-black text-white'
                                      : 'bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold'
                                  }`}
                                >
                                  {isRejected ? (
                                    <>
                                      <RefreshCw className="w-2 h-2" /> Re-upload
                                    </>
                                  ) : isUploaded ? (
                                    <>
                                      <Edit3 className="w-2 h-2" /> Update
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="w-2 h-2" /> Upload
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Extra Uploaded Documents Not in Standard List */}
                        {activeDocs
                          .filter((d) => {
                            const rawType = String(d.document_type || d.type || '').toLowerCase();
                            return !STANDARD_DOC_TYPES.some((std) =>
                              (std.matchKeys || [std.key.toLowerCase()]).some((k) =>
                                rawType === k || rawType.includes(k) || k.includes(rawType)
                              )
                            );
                          })
                          .map((extraDoc) => {
                            const isRejected = String(extraDoc.verification_status || extraDoc.status).toLowerCase() === 'rejected';
                            const isVerified = String(extraDoc.verification_status || extraDoc.status).toLowerCase() === 'verified';
                            return (
                              <div
                                key={extraDoc.id || extraDoc.document_type}
                                className={`p-3.5 rounded-2xl border transition-all ${
                                  isRejected
                                    ? 'bg-red-50/50 border-red-200'
                                    : isVerified
                                    ? 'bg-emerald-50/40 border-emerald-200'
                                    : 'bg-amber-50/40 border-amber-200'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-start gap-2.5">
                                    <div className={`p-2 rounded-xl mt-0.5 ${
                                      isRejected ? 'bg-red-100 text-red-700' : isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                                    }`}>
                                      <FileText className="w-4 h-4" />
                                    </div>
                                    <div>
                                      <p className="font-bold text-xs sm:text-sm text-gray-900 capitalize">{extraDoc.document_type?.replace(/_/g, ' ') || 'Document'}</p>
                                      <p className="text-[11px] text-gray-500 font-mono mt-0.5">
                                        {extraDoc.document_number && extraDoc.document_number !== '—' ? `#${extraDoc.document_number}` : 'Additional Compliance Document'}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black capitalize ${
                                      isVerified
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : isRejected
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-amber-100 text-amber-800'
                                    }`}>
                                      {isVerified ? '✓ Verified' : isRejected ? 'Rejected' : 'Uploaded'}
                                    </span>
                                  </div>
                                </div>

                                <div className="mt-2.5 pt-2 border-t border-gray-200/60 flex items-center justify-between">
                                  <div className="text-[10px] text-gray-500 truncate max-w-[200px]">
                                    {isRejected ? (
                                      <span className="text-red-600 font-bold">{extraDoc.rejection_reason || 'Rejected by Admin'}</span>
                                    ) : isVerified ? (
                                      <span className="text-emerald-700 font-medium">Verified by RaahGo Operations</span>
                                    ) : (
                                      <span className="text-amber-700 font-medium">Pending Admin verification</span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDocModal(extraDoc.document_type, extraDoc.document_type, extraDoc)}
                                    className="px-3 py-1 text-xs font-bold rounded-xl shadow-2xs flex items-center gap-1 transition-colors bg-gray-800 hover:bg-black text-white"
                                  >
                                    <Edit3 className="w-2 h-2" /> Update
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* ──────────────────────────────────────────────────────────── */}
                  {/* 4. BANK ACCOUNT (Editable -> Status Uploaded/Pending)        */}
                  {/* ──────────────────────────────────────────────────────────── */}
                  {activeModal === 'bank' && (
                    <div className="space-y-3">
                      {!isEditingBank ? (
                        <>
                          {activeBank ? (
                            <div className="space-y-2.5">
                              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800">
                                    <Building2 className="w-5 h-5" />
                                  </div>
                                  <div>
                                    <span className="text-gray-400 text-[10px] uppercase font-bold">Registered Bank</span>
                                    <p className="font-extrabold text-sm sm:text-base text-gray-900">{activeBank.bank_name}</p>
                                  </div>
                                </div>
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                                  activeBank.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {activeBank.is_verified ? 'Verified' : 'Uploaded'}
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                  <span className="text-gray-400 text-[10px] uppercase font-bold">Account Holder</span>
                                  <p className="font-bold text-gray-900 text-xs sm:text-sm mt-0.5 truncate">
                                    {activeBank.account_holder_name || driverName}
                                  </p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                  <span className="text-gray-400 text-[10px] uppercase font-bold">IFSC Code</span>
                                  <p className="font-mono font-bold text-gray-900 text-xs sm:text-sm mt-0.5">
                                    {activeBank.ifsc_code}
                                  </p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 sm:col-span-2">
                                  <span className="text-gray-400 text-[10px] uppercase font-bold">Account Number</span>
                                  <p className="font-mono font-black text-gray-900 text-xs sm:text-sm mt-0.5">
                                    •••• •••• •••• {activeBank.account_number?.slice(-4) || '••••'}
                                  </p>
                                </div>
                              </div>

                              {/* Status Banner */}
                              <div className={`p-3.5 rounded-2xl border ${
                                activeBank.is_verified
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                  : 'bg-amber-50 border-amber-200 text-amber-900'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {activeBank.is_verified ? (
                                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    ) : (
                                      <Clock className="w-4 h-4 text-amber-600" />
                                    )}
                                    <span className="font-bold text-xs">
                                      {activeBank.is_verified ? '✓ Verified for Direct Payouts' : '⏳ Uploaded • Awaiting Bank Verification'}
                                    </span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-black ${
                                    activeBank.is_verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {activeBank.is_verified ? 'Verified' : 'Pending'}
                                  </span>
                                </div>
                                <p className="text-[11px] mt-1 text-gray-600">
                                  {activeBank.is_verified
                                    ? 'Weekly trip earnings are settled directly to this account.'
                                    : 'Bank account details are uploaded on the client app and pending verification in Admin panel.'}
                                </p>
                              </div>

                              {/* Edit Bank Button */}
                              <button
                                type="button"
                                onClick={() => setIsEditingBank(true)}
                                className="w-full py-3 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-xs"
                              >
                                <Edit3 className="w-4 h-4" /> Edit Bank Details
                              </button>
                            </div>
                          ) : (
                            <div className="p-6 text-center space-y-3 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                              <CreditCard className="w-10 h-10 text-gray-400 mx-auto" />
                              <div>
                                <p className="font-bold text-sm text-gray-800">No Bank Account Added</p>
                                <p className="text-xs text-gray-500">Add your bank account to receive weekly payouts.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsEditingBank(true)}
                                className="px-4 py-2.5 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                              >
                                <Plus className="w-4 h-4" /> Add Bank Account
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        /* Edit Bank Form */
                        <form onSubmit={handleSaveBank} className="space-y-3 animate-in fade-in duration-200">
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs">
                            <p className="font-bold">⚠️ Note on Updating Bank Details</p>
                            <p className="mt-0.5 text-[11px] text-amber-800">
                              Updating your bank account will mark it as <strong>Uploaded</strong> and queue it for Admin verification.
                            </p>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-700 block">Bank Name</label>
                            <input
                              type="text"
                              value={bankForm.bank_name}
                              onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                              placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-700 block">Account Holder Name</label>
                            <input
                              type="text"
                              value={bankForm.account_holder_name}
                              onChange={(e) => setBankForm({ ...bankForm, account_holder_name: e.target.value })}
                              placeholder="Name as registered on bank passbook"
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-700 block">Account Number</label>
                            <input
                              type="password"
                              value={bankForm.account_number}
                              onChange={(e) => setBankForm({ ...bankForm, account_number: e.target.value })}
                              placeholder="Enter complete bank account number"
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-700 block">Confirm Account Number</label>
                            <input
                              type="text"
                              value={bankForm.confirm_account_number}
                              onChange={(e) => setBankForm({ ...bankForm, confirm_account_number: e.target.value })}
                              placeholder="Re-enter bank account number"
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-xs font-bold text-gray-700 block">IFSC Code</label>
                            <input
                              type="text"
                              value={bankForm.ifsc_code}
                              onChange={(e) => setBankForm({ ...bankForm, ifsc_code: e.target.value.toUpperCase() })}
                              placeholder="e.g. SBIN0001234, HDFC0000001"
                              maxLength={11}
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold uppercase focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          </div>

                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsEditingBank(false)}
                              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingBank}
                              className="flex-2 py-3 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                            >
                              {isSavingBank ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              <span>Save & Submit Bank</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {/* ──────────────────────────────────────────────────────────── */}
                  {/* Other Static Info Sections                                   */}
                  {/* ──────────────────────────────────────────────────────────── */}
                  {activeModal === 'safety' && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-blue-900 space-y-2">
                      <p className="font-bold text-sm">Active Captain Safety Insurance</p>
                      <p className="text-xs leading-relaxed text-blue-800">
                        You are covered under RaahGo Captain Partner Insurance with ₹5,00,000 accidental & medical hospitalization coverage while on active duty.
                      </p>
                    </div>
                  )}

                  {activeModal === 'emergency' && (
                    <div className="space-y-3">
                      {!isEditingEmergency ? (
                        <>
                          {activeEmergency ? (
                            <div className="space-y-2.5">
                              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-gray-400 text-xs">Contact Name:</span>
                                <p className="font-bold text-gray-900">{activeEmergency.name} ({activeEmergency.relationship || 'Family'})</p>
                              </div>
                              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                                <span className="text-gray-400 text-xs">Emergency Phone:</span>
                                <p className="font-mono font-bold text-gray-900">{activeEmergency.phone_number}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsEditingEmergency(true)}
                                className="w-full py-2.5 bg-gray-900 hover:bg-black text-white font-bold rounded-2xl text-xs flex items-center justify-center gap-2 transition-all shadow-xs"
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Edit Emergency Contact
                              </button>
                            </div>
                          ) : (
                            <div className="p-6 text-center space-y-3 bg-gray-50 rounded-3xl border border-dashed border-gray-300">
                              <AlertTriangle className="w-8 h-8 text-gray-400 mx-auto" />
                              <div>
                                <p className="font-bold text-sm text-gray-800">No Emergency Contact Added</p>
                                <p className="text-xs text-gray-500">Add emergency contact for safety and SOS assistance.</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setIsEditingEmergency(true)}
                                className="px-4 py-2.5 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                              >
                                <Plus className="w-4 h-4" /> Add Emergency Contact
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <form onSubmit={handleSaveEmergency} className="space-y-3 animate-in fade-in duration-200">
                          <div>
                            <label className="text-xs font-bold text-gray-700 block">Contact Name</label>
                            <input
                              type="text"
                              value={emergencyForm.name}
                              onChange={(e) => setEmergencyForm({ ...emergencyForm, name: e.target.value })}
                              placeholder="Name of family member or guardian"
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-700 block">Relationship</label>
                            <input
                              type="text"
                              value={emergencyForm.relationship}
                              onChange={(e) => setEmergencyForm({ ...emergencyForm, relationship: e.target.value })}
                              placeholder="e.g. Spouse, Father, Mother, Brother, Friend"
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-700 block">Phone Number</label>
                            <input
                              type="tel"
                              value={emergencyForm.phone_number}
                              onChange={(e) => setEmergencyForm({ ...emergencyForm, phone_number: e.target.value })}
                              placeholder="10-digit mobile number"
                              className="w-full mt-1 p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                              required
                            />
                          </div>
                          <div className="flex items-center gap-2 pt-2">
                            <button
                              type="button"
                              onClick={() => setIsEditingEmergency(false)}
                              className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              disabled={isSavingEmergency}
                              className="flex-2 py-3 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                            >
                              {isSavingEmergency ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              <span>Save Contact</span>
                            </button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}

                  {activeModal === 'settings' && (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-medium text-xs">Auto-Accept Incoming Rides</span>
                        <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#FFC000]" />
                      </div>
                      <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-medium text-xs">Navigation App</span>
                        <span className="font-bold text-xs text-gray-800">Google Maps</span>
                      </div>
                      <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
                        <span className="font-medium text-xs">Ride Alert Chime Ringtone</span>
                        <span className="font-bold text-xs text-emerald-600">Enabled (Polyphonic)</span>
                      </div>
                    </div>
                  )}

                  {activeModal === 'support' && (
                    <div className="space-y-2.5">
                      <p className="text-xs text-gray-600">Need urgent assistance or experiencing app issues?</p>
                      <a
                        href="tel:18001234567"
                        className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                      >
                        <Phone className="w-4 h-4" /> Call 24x7 Captain Helpline (Toll-Free)
                      </a>
                      <a
                        href="tel:112"
                        className="w-full py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-2xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                      >
                        <AlertTriangle className="w-4 h-4" /> Emergency SOS (Police 112)
                      </a>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Close Modal Button */}
            <button
              onClick={() => {
                setActiveModal(null);
                setIsEditingBank(false);
              }}
              className="w-full py-3 bg-black text-white font-bold rounded-2xl text-xs sm:text-sm hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Document Upload / Edit Modal ──────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {docUploadModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-base sm:text-lg text-gray-900">
                  {docUploadModal.docTitle}
                </h3>
                <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3.5 h-3.5" /> Upload will submit document for Admin Review
                </span>
              </div>
              <button
                onClick={() => setDocUploadModal(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocUpload} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block">
                  {docUploadModal.docTitle} Number
                </label>
                <input
                  type="text"
                  value={docNumberInput}
                  onChange={(e) => setDocNumberInput(e.target.value)}
                  placeholder="Enter official document number"
                  className="w-full mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block">
                  Document File (Image / PDF)
                </label>
                <div className="mt-1.5 border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-2xl p-4 text-center bg-gray-50 relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setDocFileInput(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-gray-800">
                    {docFileInput ? docFileInput.name : 'Click to choose or drag & drop document'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Clear photo or PDF document up to 10 MB
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setDocUploadModal(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs sm:text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingDoc}
                  className="flex-2 py-3 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSavingDoc ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Uploading…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Upload & Submit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── Document Rejection Reason & Re-upload Modal ───────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {selectedRejectedDoc && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-black text-base sm:text-lg text-gray-900 capitalize">
                  {selectedRejectedDoc.document_type?.replace(/_/g, ' ') || 'Document'} Verification
                </h3>
                <span className="text-[11px] font-bold text-red-600 flex items-center gap-1 mt-0.5">
                  <XCircle className="w-3.5 h-3.5" /> Rejected by Admin Review
                </span>
              </div>
              <button
                onClick={() => setSelectedRejectedDoc(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Rejection Reason Card */}
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-600 block">
                Admin Rejection Reason:
              </span>
              <p className="text-xs sm:text-sm font-bold text-red-900 leading-relaxed">
                "{selectedRejectedDoc.rejection_reason || 'The document copy uploaded is blurry or invalid. Please re-upload a clear and valid official document.'}"
              </p>
            </div>

            {/* Re-upload Form */}
            <form onSubmit={handleReuploadSubmit} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-gray-700 block">
                  Document Number (Optional / Update if incorrect)
                </label>
                <input
                  type="text"
                  value={reuploadNumber}
                  onChange={(e) => setReuploadNumber(e.target.value)}
                  placeholder="e.g. DL-1420110012345 / HR26SU1001"
                  className="w-full mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-mono font-bold focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-700 block">
                  Select New Document File (PDF, PNG, JPG)
                </label>
                <div className="mt-1.5 border-2 border-dashed border-gray-300 hover:border-gray-400 rounded-2xl p-4 text-center bg-gray-50 relative cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReuploadFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1.5" />
                  <p className="text-xs font-bold text-gray-800">
                    {reuploadFile ? reuploadFile.name : 'Click to choose or drag & drop new file'}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Clear image or PDF up to 10 MB
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedRejectedDoc(null)}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl text-xs sm:text-sm transition-colors"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingReupload}
                  className="flex-2 py-3 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-extrabold rounded-2xl text-xs sm:text-sm transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmittingReupload ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Submitting…</span>
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      <span>Re-upload & Submit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
