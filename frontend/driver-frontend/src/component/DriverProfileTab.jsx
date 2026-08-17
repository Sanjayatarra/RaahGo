import React, { useState } from 'react';
import {
  User, Car, FileText, CreditCard, Shield, ShieldCheck, Star,
  Phone, Mail, Calendar, MapPin, Award, LogOut, ChevronRight,
  Settings, Headphones, AlertTriangle, CheckCircle2, XCircle, Clock,
  Volume2, Navigation, Upload, Eye, RefreshCw, Check
} from 'lucide-react';
import { fetchWithAuth } from '../common/apiClient';

export default function DriverProfileTab({
  driverProfile,
  user,
  onLogout,
  onShowAlert,
  onRefreshProfile
}) {
  const [activeModal, setActiveModal] = useState(null); // 'personal' | 'vehicle' | 'docs' | 'bank' | 'settings' | 'support'
  const [selectedRejectedDoc, setSelectedRejectedDoc] = useState(null);
  const [reuploadNumber, setReuploadNumber] = useState('');
  const [reuploadFile, setReuploadFile] = useState(null);
  const [isSubmittingReupload, setIsSubmittingReupload] = useState(false);

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

  const rejectedDocsCount = documents.filter(
    (d) => String(d.verification_status).toLowerCase() === 'rejected' || String(d.status).toLowerCase() === 'rejected'
  ).length;

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
      if (reuploadNumber) {
        formData.append('document_number', reuploadNumber);
      }
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
            `${selectedRejectedDoc.document_type?.toUpperCase() || 'Document'} has been re-uploaded successfully and queued for Admin verification.`,
            'Document Re-uploaded',
            'success'
          );
        }
      } else {
        const err = await res.json();
        if (onShowAlert) {
          onShowAlert(err.error || 'Failed to re-upload document. Please try again.', 'Upload Error', 'error');
        }
      }
    } catch (err) {
      console.log('Re-upload document error:', err);
      if (onShowAlert) {
        onShowAlert('Network error while re-uploading. Please check connection.', 'Upload Error', 'error');
      }
    } finally {
      setIsSubmittingReupload(false);
    }
  };

  const MENU_SECTIONS = [
    {
      id: 'personal',
      title: 'Personal Information',
      subtitle: `${phone} • ${email}`,
      icon: User
    },
    {
      id: 'vehicle',
      title: 'Vehicle Information',
      subtitle: vehicle ? `${vehicle.make || ''} ${vehicle.model || ''} (${vehicle.registration_number || vehicle.vehicle_number})`.trim() : 'No vehicle assigned',
      icon: Car
    },
    {
      id: 'docs',
      title: 'KYC & Verification Documents',
      subtitle: rejectedDocsCount > 0
        ? `⚠️ ${rejectedDocsCount} Rejected Document (Action Required)`
        : documents.length > 0 ? `${documents.length} documents on file` : 'Pending document upload',
      icon: FileText,
      badge: rejectedDocsCount > 0 ? `${rejectedDocsCount} Rejected` : null,
      badgeColor: 'bg-red-500 text-white'
    },
    {
      id: 'bank',
      title: 'Bank Account & Payouts',
      subtitle: bank ? `${bank.bank_name} •••• ${bank.account_number?.slice(-4)}` : 'No bank account added',
      icon: CreditCard
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

            {/* Active Vehicle Badge */}
            {vehicle && (
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100/90 rounded-xl text-xs font-semibold text-gray-800 border border-gray-200">
                <Car className="w-3.5 h-3.5 text-[#FFC000]" />
                <span>
                  {vehicle.make} {vehicle.model} • <strong className="font-mono">{vehicle.registration_number || vehicle.vehicle_number}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KYC Alert if rejected docs exist */}
      {rejectedDocsCount > 0 && (
        <div
          onClick={() => setActiveModal('docs')}
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
              onClick={() => setActiveModal(sec.id)}
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
                      <span className={`px-2 py-0.2 rounded-full text-[10px] font-black ${sec.badgeColor}`}>
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

      {/* ── Sub-Modals for Details ── */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 border border-gray-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-extrabold text-base text-gray-900">
                {MENU_SECTIONS.find(s => s.id === activeModal)?.title || 'Details'}
              </h3>
              <button
                onClick={() => setActiveModal(null)}
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body Content */}
            <div className="text-xs sm:text-sm text-gray-700 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {activeModal === 'personal' && (
                <div className="space-y-2.5">
                  <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Full Name:</span> <p className="font-bold text-gray-900">{driverName}</p></div>
                  <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Registered Phone:</span> <p className="font-bold text-gray-900">{phone}</p></div>
                  <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Email Address:</span> <p className="font-bold text-gray-900">{email}</p></div>
                  <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Commercial Driving Experience:</span> <p className="font-bold text-gray-900">{driverProfile?.experience_years ?? 0} Years</p></div>
                </div>
              )}

              {activeModal === 'vehicle' && (
                <div className="space-y-2.5">
                  {vehicle ? (
                    <>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Assigned Vehicle:</span> <p className="font-bold text-gray-900">{vehicle.make} {vehicle.model}</p></div>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Plate Number:</span> <p className="font-mono font-bold text-gray-900">{vehicle.registration_number || vehicle.vehicle_number}</p></div>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Category:</span> <p className="font-bold text-gray-900">{vehicle.vehicle_type || 'Vehicle'}</p></div>
                      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800">
                        <span className="text-emerald-600 text-xs">Status:</span>
                        <p className="font-semibold text-xs mt-0.5">
                          {vehicle.is_approved ? 'Verified & Active in service.' : 'Awaiting Admin Verification.'}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-gray-500">No active vehicle registered.</div>
                  )}
                </div>
              )}

              {activeModal === 'docs' && (
                <div className="space-y-2.5">
                  {documents.length > 0 ? (
                    documents.map((doc) => {
                      const isRejected = String(doc.verification_status).toLowerCase() === 'rejected' || String(doc.status).toLowerCase() === 'rejected';
                      const isVerified = String(doc.verification_status).toLowerCase() === 'verified' || String(doc.status).toLowerCase() === 'verified';

                      return (
                        <div
                          key={doc.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isRejected
                              ? 'bg-red-50/40 border-red-200 shadow-2xs'
                              : 'bg-gray-50 border-gray-100'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-bold text-sm text-gray-900 capitalize">
                                {doc.document_type?.replace(/_/g, ' ') || 'Document'}
                              </p>
                              <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                #{doc.document_number || '—'} • {doc.expiry_date || 'Valid till 2030'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold capitalize ${
                                  isVerified
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : isRejected
                                    ? 'bg-red-50 text-red-700 border border-red-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {doc.verification_status || doc.status || 'Pending'}
                              </span>
                            </div>
                          </div>

                          {/* If Rejected: Show View Reason & Re-upload Trigger */}
                          {isRejected && (
                            <div className="mt-2.5 pt-2.5 border-t border-red-100 flex items-center justify-between">
                              <span className="text-[11px] text-red-600 font-medium truncate pr-2">
                                {doc.rejection_reason || 'Rejected by Admin'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleOpenDocRejectionModal(doc)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 shrink-0 transition-colors"
                              >
                                <Eye className="w-3 h-3" /> View Reason
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-gray-500">No documents found in database.</div>
                  )}
                </div>
              )}

              {activeModal === 'bank' && (
                <div className="space-y-2.5">
                  {bank ? (
                    <>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Bank Name:</span> <p className="font-bold text-gray-900">{bank.bank_name}</p></div>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Account Number:</span> <p className="font-mono font-bold text-gray-900">•••• •••• •••• {bank.account_number?.slice(-4)}</p></div>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">IFSC Code:</span> <p className="font-mono font-bold text-gray-900">{bank.ifsc_code}</p></div>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Account Holder:</span> <p className="font-bold text-gray-900">{bank.account_holder_name}</p></div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-gray-500">No bank account registered yet.</div>
                  )}
                </div>
              )}

              {activeModal === 'safety' && (
                <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 space-y-1.5">
                  <p className="font-bold">Active Captain Safety Insurance</p>
                  <p className="text-xs leading-relaxed">
                    You are covered under RaahGo Captain Partner Insurance with ₹5,00,000 accidental & medical hospitalization coverage while on active duty.
                  </p>
                </div>
              )}

              {activeModal === 'emergency' && (
                <div className="space-y-2.5">
                  {emergency ? (
                    <>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Contact Name:</span> <p className="font-bold text-gray-900">{emergency.name} ({emergency.relationship})</p></div>
                      <div className="p-3 bg-gray-50 rounded-xl"><span className="text-gray-400 text-xs">Emergency Phone:</span> <p className="font-mono font-bold text-gray-900">{emergency.phone_number}</p></div>
                    </>
                  ) : (
                    <div className="p-6 text-center text-gray-500">No emergency contact added yet.</div>
                  )}
                </div>
              )}

              {activeModal === 'settings' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span>Auto-Accept Incoming Rides</span>
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-[#FFC000]" />
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span>Navigation App</span>
                    <span className="font-bold text-xs">Google Maps</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span>Ride Alert Chime Ringtone</span>
                    <span className="font-bold text-xs text-emerald-600">Enabled (Polyphonic)</span>
                  </div>
                </div>
              )}

              {activeModal === 'support' && (
                <div className="space-y-2.5">
                  <p className="text-xs text-gray-600">Need urgent assistance or experiencing app issues?</p>
                  <a
                    href="tel:18001234567"
                    className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4" /> Call 24x7 Captain Helpline (Toll-Free)
                  </a>
                  <a
                    href="tel:112"
                    className="w-full py-3 bg-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" /> Emergency SOS (Police 112)
                  </a>
                </div>
              )}
            </div>

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-3 bg-black text-white font-bold rounded-2xl text-xs sm:text-sm hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── Document Rejection Reason & Re-upload Modal ── */}
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
                className="text-gray-400 hover:text-gray-600 text-sm font-bold p-1"
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
                  className="w-full mt-1.5 p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-[#FFC000] focus:outline-none"
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
