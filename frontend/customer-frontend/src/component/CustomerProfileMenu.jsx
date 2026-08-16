import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Coins,
  Bell,
  Shield,
  Settings,
  ChevronRight,
  Navigation,
  Train,
  Package,
  Luggage,
  User,
  LogOut,
  X,
  Clock,
  HelpCircle,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Phone,
  Mail,
  ChevronLeft,
  CreditCard,
  Wallet,
  Gift,
  Heart,
  MapPin,
  Ticket,
  Zap,
  Info,
  Share2,
  Lock,
  Headphones,
  FileText,
  AlertTriangle,
  Copy,
  Check,
  Plus,
  Loader2,
  RefreshCw,
  Receipt,
  Car,
  Star,
  CheckCheck
} from 'lucide-react';
import captainBannerImg from '../assets/captain_banner.jpg';
import { fetchWithAuth } from '../common/apiClient';

export default function CustomerProfileMenu({
  isOpen,
  onClose,
  user,
  onLogout,
  activeNav = 'profile',
  onSelectNav
}) {
  const navigate = useNavigate();
  const [activeSubModal, setActiveSubModal] = useState(null); // 'coins', 'payments', 'history', 'notifications', 'claims', 'places', 'refer', 'pass', 'safety', 'settings', 'help', 'about'
  const [copiedReferral, setCopiedReferral] = useState(false);
  
  // Rides History State
  const [rideHistory, setRideHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState('all'); // 'all', 'completed', 'cancelled', 'active'
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Notifications State
  const [notificationsList, setNotificationsList] = useState([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);

  // Saved Addresses State
  const [savedAddresses, setSavedAddresses] = useState([
    { id: 1, type: 'Home', address: 'B-402, Green Valley Apts, Sector 45, Gurgaon' },
    { id: 2, type: 'Work', address: 'Tower B, Cyber City, DLF Phase 2, Gurgaon' }
  ]);
  const [newAddrType, setNewAddrType] = useState('Home');
  const [newAddrText, setNewAddrText] = useState('');
  const [showAddAddr, setShowAddAddr] = useState(false);

  // Fetch real Ride History when history submodal is opened
  useEffect(() => {
    if (activeSubModal === 'history') {
      fetchRides();
    }
  }, [activeSubModal]);

  // Fetch real Notifications when notifications submodal is opened
  useEffect(() => {
    if (activeSubModal === 'notifications') {
      fetchNotifications();
    }
  }, [activeSubModal]);

  const fetchRides = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetchWithAuth('/api/v1/customer/rides/');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.results || []);
        setRideHistory(list);
      } else {
        // Fallback to bookings endpoint
        const fb = await fetchWithAuth('/api/v1/bookings/bookings/');
        if (fb.ok) {
          const data = await fb.json();
          setRideHistory(Array.isArray(data) ? data : (data.results || []));
        }
      }
    } catch (e) {
      console.log('Fetch customer rides notice:', e);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const fetchNotifications = async () => {
    setIsLoadingNotifs(true);
    try {
      const res = await fetchWithAuth('/api/v1/customer/notifications/');
      if (res.ok) {
        const data = await res.json();
        setNotificationsList(Array.isArray(data) ? data : (data.results || []));
      }
    } catch (e) {
      console.log('Fetch notifications notice:', e);
    } finally {
      setIsLoadingNotifs(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetchWithAuth('/api/v1/customer/notifications/read-all/read/', { method: 'POST' });
      setNotificationsList(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (e) {
      console.log('Mark all read notice:', e);
      setNotificationsList(prev => prev.map(n => ({ ...n, is_read: true })));
    }
  };

  const handleRebookRide = (ride) => {
    onClose();
    navigate('/book-ride', {
      state: {
        prefillPickup: ride.pickup_address,
        prefillDrop: ride.dropoff_address,
        pickupCoords: ride.pickup_latitude && ride.pickup_longitude ? { lat: parseFloat(ride.pickup_latitude), lng: parseFloat(ride.pickup_longitude) } : null,
        dropCoords: ride.dropoff_latitude && ride.dropoff_longitude ? { lat: parseFloat(ride.dropoff_latitude), lng: parseFloat(ride.dropoff_longitude) } : null,
        selectedRide: ride.vehicle_type_name?.toLowerCase() || 'bike'
      }
    });
  };

  if (!isOpen) return null;

  const handleNavClick = (tab) => {
    if (onSelectNav) {
      onSelectNav(tab);
    }
    if (tab === 'ride') {
      onClose();
      navigate('/home');
    } else if (tab === 'metro') {
      alert('Metro ticket booking is launching soon!');
    } else if (tab === 'parcel') {
      alert('Parcel express delivery is launching soon!');
    } else if (tab === 'travel') {
      alert('Outstation and hourly rental bookings coming soon!');
    }
  };

  const handleDriverPortalRedirect = () => {
    const host = window.location.hostname;
    const driverUrl = `http://${host}:5175`;
    window.open(driverUrl, '_blank');
  };

  const handleCopyReferral = () => {
    navigator.clipboard.writeText('RAAHGO100');
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleAddAddress = (e) => {
    e.preventDefault();
    if (!newAddrText.trim()) return;
    setSavedAddresses([
      ...savedAddresses,
      { id: Date.now(), type: newAddrType, address: newAddrText.trim() }
    ]);
    setNewAddrText('');
    setShowAddAddr(false);
  };

  // Filter rides based on active filter pill
  const filteredRides = rideHistory.filter(r => {
    if (historyFilter === 'completed') return r.status === 'Completed';
    if (historyFilter === 'cancelled') return r.status === 'Cancelled';
    if (historyFilter === 'active') return r.status === 'Searching' || r.status === 'Accepted' || r.status === 'In Trip' || r.status === 'Arrived';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center sm:p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      
      {/* Background backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Main Profile Container */}
      <div className="relative w-full sm:max-w-md bg-white sm:rounded-[36px] shadow-2xl overflow-hidden flex flex-col h-full sm:h-[92vh] sm:max-h-[820px] z-10 animate-slide-up border border-gray-100">
        
        {/* Top User Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#063B28] to-emerald-700 text-white font-black text-xl flex items-center justify-center shadow-md shadow-emerald-900/15">
              {user?.name ? user.name.charAt(0).toUpperCase() : (user?.first_name ? user.first_name.charAt(0).toUpperCase() : 'U')}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-extrabold text-gray-900 text-base leading-tight">
                  {user?.name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Customer User')}
                </h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2 py-0.5 rounded-full">
                  VIP Member
                </span>
              </div>
              <p className="text-xs font-semibold text-gray-400 mt-0.5">
                {user?.identifier || user?.phone_number || user?.email || '+91 98765 43210'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer border-none"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Body with ALL Menu Items */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4 scrollbar-none">
          
          {/* Quick Balance & Offers Strip */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div
              onClick={() => setActiveSubModal('coins')}
              className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-xs transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider">RaahGo Coins</span>
                <span className="text-lg">🪙</span>
              </div>
              <div className="mt-2">
                <span className="text-lg font-black text-amber-950">150</span>
                <span className="text-[10px] font-bold text-amber-700 block mt-0.5">₹150 Value</span>
              </div>
            </div>

            <div
              onClick={() => setActiveSubModal('payments')}
              className="bg-gradient-to-br from-emerald-50 to-teal-50/50 border border-emerald-200/80 rounded-2xl p-3.5 flex flex-col justify-between cursor-pointer hover:shadow-xs transition-all active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold text-emerald-900 uppercase tracking-wider">RaahGo Pay</span>
                <Wallet className="w-4 h-4 text-emerald-700" />
              </div>
              <div className="mt-2">
                <span className="text-lg font-black text-emerald-950">₹320.00</span>
                <span className="text-[10px] font-bold text-emerald-700 block mt-0.5">Wallet Balance</span>
              </div>
            </div>
          </div>

          {/* ALL Menu Items List */}
          <div className="divide-y divide-gray-100 text-gray-800">
            
            {/* 1. RaahGo Coins */}
            <div
              onClick={() => setActiveSubModal('coins')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                  <svg className="w-5 h-5 text-amber-700 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="9" cy="12" r="6" />
                    <circle cx="15" cy="12" r="6" />
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    RaahGo Coins & Rewards
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Cashback, scratch cards & rewards</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 2. Notifications */}
            <div
              onClick={() => setActiveSubModal('notifications')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-700">
                  <Bell className="w-4 h-4 text-purple-700 stroke-[2]" />
                </div>
                <div className="flex items-center gap-2">
                  <div>
                    <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                      Notifications
                    </span>
                    <p className="text-[11px] font-semibold text-gray-400">Ride updates, promo codes & news</p>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 3. My Rides History */}
            <div
              onClick={() => setActiveSubModal('history')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-700">
                  <Clock className="w-4 h-4 text-blue-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    My Rides & History
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Trip invoices, receipts & ride details</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 4. Claims & Insurance */}
            <div
              onClick={() => setActiveSubModal('claims')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center text-red-700">
                  <Shield className="w-4 h-4 text-red-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Claims & Insurance
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">₹5 Lakh complimentary accident cover</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 5. Payments & Wallets */}
            <div
              onClick={() => setActiveSubModal('payments')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <CreditCard className="w-4 h-4 text-emerald-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Payments & Wallets
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">UPI, Cards, RaahGo Wallet & NetBanking</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 6. Saved Places */}
            <div
              onClick={() => setActiveSubModal('places')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-700">
                  <Heart className="w-4 h-4 text-rose-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Saved Places
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Manage Home, Work & favorite locations</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 7. Refer & Earn */}
            <div
              onClick={() => setActiveSubModal('refer')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center text-amber-700">
                  <Gift className="w-4 h-4 text-amber-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Refer & Earn ₹100
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Invite friends & get free rides</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 8. Power Pass & Ride Packages */}
            <div
              onClick={() => setActiveSubModal('pass')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center text-teal-700">
                  <Ticket className="w-4 h-4 text-teal-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Power Pass
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Flat fare passes for daily commute</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 9. Safety Toolkit & Emergency SOS */}
            <div
              onClick={() => setActiveSubModal('safety')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Safety & Emergency SOS
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Live ride sharing & 24x7 emergency response</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 10. Help & Support */}
            <div
              onClick={() => setActiveSubModal('help')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-700">
                  <Headphones className="w-4 h-4 text-indigo-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Help & Support
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Customer care, disputes & ride assistance</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 11. Settings */}
            <div
              onClick={() => setActiveSubModal('settings')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                  <Settings className="w-4 h-4 text-gray-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    Settings
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Permissions, privacy, language & theme</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

            {/* 12. About & Legal */}
            <div
              onClick={() => setActiveSubModal('about')}
              className="py-3.5 flex items-center justify-between cursor-pointer hover:bg-gray-50/80 px-2 rounded-2xl transition-all group"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center text-gray-700">
                  <Info className="w-4 h-4 text-gray-700 stroke-[2]" />
                </div>
                <div>
                  <span className="text-sm font-bold text-gray-900 group-hover:text-emerald-800 transition-colors">
                    About RaahGo
                  </span>
                  <p className="text-[11px] font-semibold text-gray-400">Terms of service, privacy policy & licenses</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-900 group-hover:translate-x-0.5 transition-all" />
            </div>

          </div>

          {/* Promotional Banner Card: Earn money with RaahGo / Become a Captain */}
          <div
            onClick={handleDriverPortalRedirect}
            className="bg-[#FFF9EA] hover:bg-[#FFF3D6] border border-[#F8E7BE] rounded-[24px] overflow-hidden p-4 flex items-center justify-between gap-3 shadow-xs hover:shadow-md transition-all cursor-pointer group mt-2"
          >
            <div className="space-y-1 min-w-0 flex-1">
              <h4 className="text-base font-black text-gray-900 tracking-tight leading-snug">
                Earn money with RaahGo
              </h4>
              <p className="text-xs font-bold text-gray-600">
                Become a Captain!
              </p>
              <div className="pt-1 flex items-center gap-1 text-[11px] font-extrabold text-[#063B28]">
                <span>Register as Captain</span>
                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Captain Photo */}
            <div className="w-24 h-20 rounded-2xl overflow-hidden shrink-0 shadow-sm border border-amber-200/60 bg-amber-100">
              <img
                src={captainBannerImg}
                alt="RaahGo Captain"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

          {/* Logout Action Button */}
          {user && (
            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="w-full py-3.5 bg-red-50 hover:bg-red-100 active:scale-[0.98] text-red-600 font-extrabold text-sm rounded-2xl transition-all cursor-pointer border-none flex items-center justify-center gap-2 mt-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out Account</span>
            </button>
          )}

          <div className="text-center text-[10px] font-bold text-gray-400 py-2">
            RaahGo App Version 2.4.0 · Made with ❤️ for India
          </div>
        </div>

        {/* Bottom Navigation Bar exactly matching the 5 icons in screenshot */}
        <div className="border-t border-gray-100 bg-white px-2 py-2 flex items-center justify-around shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
          
          {/* 1. Ride */}
          <button
            onClick={() => handleNavClick('ride')}
            className={`flex flex-col items-center gap-1 w-16 py-1 cursor-pointer bg-transparent border-none transition-all ${
              activeNav === 'ride' ? 'text-[#063B28]' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Navigation className={`w-5 h-5 ${activeNav === 'ride' ? 'stroke-[2.5] text-[#063B28]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] font-bold">Ride</span>
          </button>

          {/* 2. Metro */}
          <button
            onClick={() => handleNavClick('metro')}
            className={`flex flex-col items-center gap-1 w-16 py-1 cursor-pointer bg-transparent border-none transition-all ${
              activeNav === 'metro' ? 'text-[#063B28]' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Train className={`w-5 h-5 ${activeNav === 'metro' ? 'stroke-[2.5] text-[#063B28]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] font-bold">Metro</span>
          </button>

          {/* 3. Parcel */}
          <button
            onClick={() => handleNavClick('parcel')}
            className={`flex flex-col items-center gap-1 w-16 py-1 cursor-pointer bg-transparent border-none transition-all ${
              activeNav === 'parcel' ? 'text-[#063B28]' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Package className={`w-5 h-5 ${activeNav === 'parcel' ? 'stroke-[2.5] text-[#063B28]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] font-bold">Parcel</span>
          </button>

          {/* 4. Travel */}
          <button
            onClick={() => handleNavClick('travel')}
            className={`flex flex-col items-center gap-1 w-16 py-1 cursor-pointer bg-transparent border-none transition-all ${
              activeNav === 'travel' ? 'text-[#063B28]' : 'text-gray-400 hover:text-gray-700'
            }`}
          >
            <Luggage className={`w-5 h-5 ${activeNav === 'travel' ? 'stroke-[2.5] text-[#063B28]' : 'stroke-[1.8]'}`} />
            <span className="text-[11px] font-bold">Travel</span>
          </button>

          {/* 5. Profile (Active) */}
          <button
            onClick={() => handleNavClick('profile')}
            className="flex flex-col items-center gap-1 w-16 py-1 cursor-pointer bg-transparent border-none text-gray-900"
          >
            <div className="w-7 h-7 rounded-full bg-gray-900 text-white flex items-center justify-center">
              <User className="w-4 h-4 fill-white text-white" />
            </div>
            <span className="text-[11px] font-black text-gray-900">Profile</span>
          </button>
        </div>

        {/* Interactive Sub-modals for every item */}
        {activeSubModal && (
          <div className="absolute inset-0 z-30 bg-white flex flex-col animate-slide-up">
            
            {/* Submodal Top Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/70 shrink-0">
              <button
                onClick={() => setActiveSubModal(null)}
                className="flex items-center gap-1 text-sm font-bold text-gray-700 hover:text-black bg-transparent border-none cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Back</span>
              </button>
              <h4 className="font-extrabold text-sm sm:text-base text-gray-900 capitalize truncate max-w-[200px]">
                {activeSubModal === 'history' && 'My Rides & History'}
                {activeSubModal === 'notifications' && 'Notifications'}
                {activeSubModal === 'coins' && 'RaahGo Coins & Rewards'}
                {activeSubModal === 'payments' && 'Payments & Wallets'}
                {activeSubModal === 'claims' && 'Claims & Insurance'}
                {activeSubModal === 'places' && 'Saved Places'}
                {activeSubModal === 'refer' && 'Refer & Earn'}
                {activeSubModal === 'pass' && 'Power Pass'}
                {activeSubModal === 'safety' && 'Safety Toolkit & SOS'}
                {activeSubModal === 'settings' && 'App Settings'}
                {activeSubModal === 'help' && 'Help & Support'}
                {activeSubModal === 'about' && 'About RaahGo'}
              </h4>
              <button
                onClick={() => setActiveSubModal(null)}
                className="w-7 h-7 rounded-full bg-gray-200/80 text-gray-700 flex items-center justify-center border-none cursor-pointer text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Submodal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-none">
              
              {/* ========================================================= */}
              {/* 1. MY RIDES & HISTORY VIEW                                */}
              {/* ========================================================= */}
              {activeSubModal === 'history' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Status Filter Tabs */}
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                    {[
                      { key: 'all', label: 'All Trips' },
                      { key: 'completed', label: 'Completed' },
                      { key: 'active', label: 'In Progress' },
                      { key: 'cancelled', label: 'Cancelled' }
                    ].map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setHistoryFilter(tab.key)}
                        className={`px-3.5 py-1.5 rounded-full text-xs font-black shrink-0 transition-all border cursor-pointer ${
                          historyFilter === tab.key
                            ? 'bg-[#063B28] text-white border-[#063B28] shadow-xs'
                            : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Loading Spinner */}
                  {isLoadingHistory ? (
                    <div className="py-12 text-center space-y-2">
                      <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
                      <p className="text-xs font-bold text-gray-500">Loading your trip history...</p>
                    </div>
                  ) : filteredRides.length > 0 ? (
                    <div className="space-y-3">
                      {filteredRides.map((ride) => {
                        const vName = (ride.vehicle_type_name || '').toLowerCase();
                        const isComp = ride.status === 'Completed';
                        const isCanc = ride.status === 'Cancelled';
                        const isActive = !isComp && !isCanc;

                        return (
                          <div
                            key={ride.id}
                            className="bg-white rounded-2xl p-4 border border-gray-200 shadow-xs hover:shadow-md transition-all space-y-3"
                          >
                            {/* Card Top: Vehicle Type, Booking No & Price */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-center text-xl shrink-0">
                                  {vName.includes('bike') ? '🏍️' : vName.includes('auto') ? '🛺' : vName.includes('suv') ? '🚙' : '🚗'}
                                </div>
                                <div>
                                  <h5 className="font-black text-sm text-gray-900 capitalize">
                                    {ride.vehicle_type_name || 'City Ride'}
                                  </h5>
                                  <span className="text-[10px] font-bold text-gray-400">
                                    #{ride.booking_number || 'RG12345'} · {new Date(ride.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-base font-black text-gray-900">
                                  ₹{ride.total_fare || ride.base_fare || '65'}
                                </span>
                                <div className="mt-0.5">
                                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full inline-block ${
                                    isComp ? 'bg-emerald-100 text-emerald-800' :
                                    isCanc ? 'bg-red-100 text-red-700' :
                                    'bg-blue-100 text-blue-800 animate-pulse'
                                  }`}>
                                    {ride.status}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Route: Pickup & Drop */}
                            <div className="bg-gray-50/80 rounded-xl p-2.5 space-y-2 text-xs border border-gray-100">
                              <div className="flex items-start gap-2">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                <p className="text-gray-700 font-semibold truncate flex-1">{ride.pickup_address || 'Pickup Location'}</p>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0" />
                                <p className="text-gray-700 font-semibold truncate flex-1">{ride.dropoff_address || 'Drop Location'}</p>
                              </div>
                            </div>

                            {/* Driver info if assigned */}
                            {ride.driver_details && (
                              <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100">
                                <span className="text-gray-500 font-semibold">
                                  Captain: <strong className="text-gray-900">{ride.driver_details.captain_name || 'Captain Partner'}</strong>
                                </span>
                                <span className="text-amber-600 font-black flex items-center gap-0.5">
                                  ★ {ride.driver_details.driver_rating || '4.9'}
                                </span>
                              </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => setSelectedInvoice(ride)}
                                className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold text-xs rounded-xl transition-colors border-none cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <Receipt className="w-3.5 h-3.5 text-gray-600" />
                                <span>View Receipt</span>
                              </button>

                              <button
                                onClick={() => handleRebookRide(ride)}
                                className="flex-1 py-2 bg-[#063B28] hover:bg-[#084A33] text-white font-extrabold text-xs rounded-xl transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Rebook</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="py-12 text-center space-y-3 bg-gray-50 rounded-3xl border border-gray-200/60 p-6">
                      <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center mx-auto text-2xl shadow-xs">
                        🚗
                      </div>
                      <h4 className="text-base font-black text-gray-900">No Rides Found</h4>
                      <p className="text-xs text-gray-500 font-medium max-w-xs mx-auto">
                        You haven't taken any {historyFilter !== 'all' ? historyFilter : ''} rides yet. Book your first ride now!
                      </p>
                      <button
                        onClick={() => {
                          onClose();
                          navigate('/book-ride');
                        }}
                        className="px-6 py-2.5 bg-[#063B28] text-white font-extrabold text-xs rounded-full shadow-md cursor-pointer border-none"
                      >
                        Book a Ride
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================= */}
              {/* 2. NOTIFICATIONS INBOX VIEW                               */}
              {/* ========================================================= */}
              {activeSubModal === 'notifications' && (
                <div className="space-y-4 animate-fade-in">
                  
                  {/* Top Bar with Mark All Read Action */}
                  <div className="flex items-center justify-between pb-1">
                    <span className="text-xs font-black text-gray-500 uppercase tracking-wider">
                      Inbox ({notificationsList.length})
                    </span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-extrabold text-emerald-700 hover:text-emerald-900 bg-transparent border-none cursor-pointer flex items-center gap-1"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      <span>Mark All Read</span>
                    </button>
                  </div>

                  {isLoadingNotifs ? (
                    <div className="py-12 text-center space-y-2">
                      <Loader2 className="w-7 h-7 text-emerald-600 animate-spin mx-auto" />
                      <p className="text-xs font-bold text-gray-500">Loading notifications...</p>
                    </div>
                  ) : notificationsList.length > 0 ? (
                    <div className="space-y-2.5">
                      {notificationsList.map((n, idx) => (
                        <div
                          key={n.id || idx}
                          className={`p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                            n.is_read ? 'bg-white border-gray-200' : 'bg-emerald-50/70 border-emerald-200 shadow-2xs'
                          }`}
                        >
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${n.is_read ? 'bg-gray-300' : 'bg-emerald-500 animate-pulse'}`} />
                          
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <div className="flex items-center justify-between gap-2">
                              <h5 className="font-extrabold text-xs text-gray-900 truncate">{n.title}</h5>
                              <span className="text-[10px] font-semibold text-gray-400 shrink-0">
                                {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                              </span>
                            </div>
                            <p className="text-xs text-gray-600 leading-relaxed font-medium">{n.message || n.body}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center space-y-2 bg-gray-50 rounded-3xl border border-gray-100 p-6">
                      <Bell className="w-10 h-10 text-gray-300 mx-auto" />
                      <h4 className="text-sm font-black text-gray-900">No New Notifications</h4>
                      <p className="text-xs text-gray-500">You are all caught up with your rides and promo updates!</p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. Coins */}
              {activeSubModal === 'coins' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-amber-400 to-amber-600 rounded-3xl p-6 text-white text-center shadow-lg shadow-amber-500/20 space-y-2">
                    <span className="text-4xl">🪙</span>
                    <h3 className="text-3xl font-black">150 Coins</h3>
                    <p className="text-xs font-bold text-amber-100">1 Coin = ₹1 Instant Discount on Any Ride</p>
                    <button className="px-6 py-2.5 bg-white text-amber-800 font-extrabold text-xs rounded-full shadow-md mt-2 cursor-pointer border-none">
                      Redeem 150 Coins
                    </button>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 space-y-2 border border-gray-100">
                    <h5 className="font-bold text-xs text-gray-700 uppercase tracking-wide">Coin History</h5>
                    <div className="flex justify-between items-center text-xs py-2 border-b border-gray-200">
                      <div>
                        <p className="font-bold text-gray-900">Welcome Bonus</p>
                        <p className="text-gray-400 text-[10px]">Today</p>
                      </div>
                      <span className="text-emerald-600 font-black">+100 Coins</span>
                    </div>
                    <div className="flex justify-between items-center text-xs py-2">
                      <div>
                        <p className="font-bold text-gray-900">First Ride Completed</p>
                        <p className="text-gray-400 text-[10px]">Yesterday</p>
                      </div>
                      <span className="text-emerald-600 font-black">+50 Coins</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Payments */}
              {activeSubModal === 'payments' && (
                <div className="space-y-4">
                  <div className="bg-[#063B28] rounded-3xl p-5 text-white flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-emerald-200 uppercase">RaahGo Wallet</p>
                      <h3 className="text-2xl font-black mt-0.5">₹320.00</h3>
                    </div>
                    <button className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-[#063B28] font-extrabold text-xs rounded-xl border-none cursor-pointer">
                      + Add Money
                    </button>
                  </div>
                  <div className="space-y-2">
                    <h5 className="text-xs font-black text-gray-400 uppercase tracking-wider">Payment Options</h5>
                    <div className="p-3.5 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">⚡</span>
                        <div>
                          <p className="font-bold text-xs text-gray-900">Google Pay / PhonePe UPI</p>
                          <p className="text-[10px] text-emerald-600 font-bold">Default Payment Method</p>
                        </div>
                      </div>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="p-3.5 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">💳</span>
                        <div>
                          <p className="font-bold text-xs text-gray-900">Credit / Debit Cards</p>
                          <p className="text-[10px] text-gray-400">Visa, Mastercard, RuPay</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="p-3.5 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">💵</span>
                        <div>
                          <p className="font-bold text-xs text-gray-900">Cash on Delivery</p>
                          <p className="text-[10px] text-gray-400">Pay directly to captain</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">Enabled</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Claims */}
              {activeSubModal === 'claims' && (
                <div className="space-y-4">
                  <div className="bg-[#063B28] text-white rounded-3xl p-5 space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                    <h4 className="font-extrabold text-base">₹5,00,000 Complimentary Ride Insurance</h4>
                    <p className="text-xs text-emerald-100 leading-relaxed font-medium">
                      Every ride booked with RaahGo is covered with round-the-clock accident, medical expenses & third-party insurance at zero extra charge.
                    </p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 space-y-2 text-xs">
                    <h5 className="font-bold text-gray-900 uppercase">Coverage Summary</h5>
                    <div className="flex justify-between text-gray-600">
                      <span>Accidental Medical Expenses:</span>
                      <span className="font-bold text-gray-900">Up to ₹1,00,000</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Emergency Ambulance Cover:</span>
                      <span className="font-bold text-gray-900">Up to ₹10,000</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Permanent Disability:</span>
                      <span className="font-bold text-gray-900">Up to ₹5,00,000</span>
                    </div>
                  </div>
                  <button className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl border-none cursor-pointer">
                    File an Insurance Claim
                  </button>
                </div>
              )}

              {/* 6. Saved Places */}
              {activeSubModal === 'places' && (
                <div className="space-y-3">
                  {savedAddresses.map((addr) => (
                    <div key={addr.id} className="p-3.5 bg-gray-50 rounded-2xl flex items-start gap-3 border border-gray-100">
                      <div className="w-8 h-8 rounded-xl bg-white border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                        {addr.type === 'Home' ? '🏠' : addr.type === 'Work' ? '💼' : '📍'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-bold text-xs text-gray-900">{addr.type}</h5>
                        <p className="text-xs text-gray-600 truncate mt-0.5">{addr.address}</p>
                      </div>
                    </div>
                  ))}

                  {showAddAddr ? (
                    <form onSubmit={handleAddAddress} className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-emerald-200 animate-fade-in">
                      <h5 className="font-bold text-xs text-gray-900">Add New Place</h5>
                      <div className="flex gap-2">
                        {['Home', 'Work', 'Favorite'].map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewAddrType(t)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border-none cursor-pointer ${
                              newAddrType === t ? 'bg-[#063B28] text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        placeholder="Enter full address..."
                        value={newAddrText}
                        onChange={(e) => setNewAddrText(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-500"
                        required
                      />
                      <div className="flex gap-2">
                        <button type="submit" className="flex-1 py-2 bg-emerald-600 text-white font-bold text-xs rounded-xl border-none cursor-pointer">
                          Save Place
                        </button>
                        <button type="button" onClick={() => setShowAddAddr(false)} className="px-3 py-2 bg-gray-200 text-gray-700 font-bold text-xs rounded-xl border-none cursor-pointer">
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      onClick={() => setShowAddAddr(true)}
                      className="w-full py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs rounded-2xl border border-emerald-200 flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Favorite Place</span>
                    </button>
                  )}
                </div>
              )}

              {/* 7. Refer & Earn */}
              {activeSubModal === 'refer' && (
                <div className="space-y-4 text-center">
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-3xl p-6 text-white space-y-2 shadow-lg shadow-amber-500/20">
                    <span className="text-4xl">🎁</span>
                    <h3 className="text-2xl font-black">Invite Friends, Get ₹100</h3>
                    <p className="text-xs font-bold text-amber-100">
                      Your friend gets ₹50 off on their first ride, and you get ₹100 RaahGo Coins when they complete their trip!
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-black text-gray-400">Your Referral Code</span>
                      <p className="text-lg font-black text-[#063B28] tracking-wider">RAAHGO100</p>
                    </div>
                    <button
                      onClick={handleCopyReferral}
                      className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-900 border border-gray-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                    >
                      {copiedReferral ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedReferral ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'Join RaahGo',
                          text: 'Use my code RAAHGO100 to get ₹50 off on your first RaahGo ride!',
                          url: window.location.origin
                        });
                      } else {
                        handleCopyReferral();
                      }
                    }}
                    className="w-full py-3.5 bg-[#063B28] hover:bg-[#084A33] text-white font-extrabold text-xs rounded-2xl border-none cursor-pointer flex items-center justify-center gap-2 shadow-md"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share Referral Link</span>
                  </button>
                </div>
              )}

              {/* 8. Power Pass */}
              {activeSubModal === 'pass' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-teal-700 to-[#063B28] rounded-3xl p-5 text-white space-y-1.5 shadow-md">
                    <div className="flex items-center gap-1 text-teal-300 text-xs font-black uppercase">
                      <Zap className="w-4 h-4" />
                      <span>Daily Commute Super Saver</span>
                    </div>
                    <h3 className="text-xl font-black">RaahGo Power Pass</h3>
                    <p className="text-xs text-teal-100 font-medium">
                      Save up to 40% on every ride with guaranteed flat fares during peak office hours.
                    </p>
                  </div>
                  
                  <div className="space-y-2.5">
                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">Popular</span>
                        <h5 className="font-extrabold text-sm text-gray-900 mt-1">Bike Pass (10 Rides)</h5>
                        <p className="text-xs text-gray-500">Flat ₹25 per ride up to 5 km</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-gray-900">₹199</span>
                        <button className="block mt-1 px-3 py-1.5 bg-[#063B28] text-white font-bold text-[10px] rounded-lg border-none cursor-pointer">
                          Buy Now
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl flex items-center justify-between">
                      <div>
                        <h5 className="font-extrabold text-sm text-gray-900">Auto Pass (10 Rides)</h5>
                        <p className="text-xs text-gray-500">Flat ₹45 per ride up to 5 km</p>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-gray-900">₹349</span>
                        <button className="block mt-1 px-3 py-1.5 bg-[#063B28] text-white font-bold text-[10px] rounded-lg border-none cursor-pointer">
                          Buy Now
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 9. Safety & Emergency SOS */}
              {activeSubModal === 'safety' && (
                <div className="space-y-4">
                  <div className="bg-red-500 rounded-3xl p-5 text-white space-y-2 shadow-lg shadow-red-500/20">
                    <AlertTriangle className="w-8 h-8 text-white" />
                    <h4 className="font-black text-lg">Emergency SOS & 24x7 Safety</h4>
                    <p className="text-xs text-red-100 font-medium leading-relaxed">
                      Instant connection with local police (112) and RaahGo Emergency Rapid Response Team.
                    </p>
                    <button 
                      onClick={() => window.open('tel:112', '_blank')}
                      className="w-full py-3 bg-white text-red-600 font-black text-xs rounded-2xl border-none cursor-pointer mt-2"
                    >
                      🚨 Call Emergency 112
                    </button>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-2xl space-y-2 border border-gray-100 text-xs">
                    <h5 className="font-bold text-gray-900 uppercase">Safety Features Enabled</h5>
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Live GPS ride tracking with friends & family</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>4-Digit ride PIN authentication before trip start</span>
                    </div>
                    <div className="flex items-center gap-2 text-emerald-700 font-semibold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>100% verified and police background-checked captains</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 10. Help & Support */}
              {activeSubModal === 'help' && (
                <div className="space-y-3">
                  <div className="bg-emerald-50 rounded-2xl p-4 space-y-1 border border-emerald-100">
                    <h5 className="font-extrabold text-xs text-[#063B28]">24x7 Customer Support</h5>
                    <p className="text-xs text-gray-600">Need help with a ride, lost item, or refund? We are here round the clock.</p>
                  </div>
                  <button 
                    onClick={() => window.open('tel:1800123456', '_blank')}
                    className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-extrabold text-xs rounded-2xl border-none cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Phone className="w-4 h-4 text-emerald-600" />
                    <span>Call Helpline: 1800-123-456</span>
                  </button>
                  <button 
                    onClick={() => window.open('mailto:support@raahgo.com', '_blank')}
                    className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-900 font-extrabold text-xs rounded-2xl border-none cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Mail className="w-4 h-4 text-emerald-600" />
                    <span>Email: support@raahgo.com</span>
                  </button>
                </div>
              )}

              {/* 11. Settings */}
              {activeSubModal === 'settings' && (
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between border border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-gray-900">Push Notifications</p>
                      <p className="text-[10px] text-gray-400">Receive live trip alerts & driver status</p>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-emerald-600 w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between border border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-gray-900">SMS Alerts & Receipts</p>
                      <p className="text-[10px] text-gray-400">Receive trip summaries via SMS</p>
                    </div>
                    <input type="checkbox" defaultChecked className="accent-emerald-600 w-4 h-4 cursor-pointer" />
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 flex items-center justify-between border border-gray-100">
                    <div>
                      <p className="text-xs font-bold text-gray-900">App Language</p>
                      <p className="text-[10px] text-gray-400">English (India)</p>
                    </div>
                    <span className="text-xs font-bold text-emerald-700">Change</span>
                  </div>
                </div>
              )}

              {/* 12. About & Legal */}
              {activeSubModal === 'about' && (
                <div className="space-y-3 text-xs text-gray-600">
                  <div className="text-center py-4 space-y-1">
                    <div className="w-12 h-12 rounded-2xl bg-[#063B28] text-white flex items-center justify-center mx-auto font-black text-xl">
                      RG
                    </div>
                    <h4 className="font-black text-base text-gray-900 mt-2">RaahGo Rides Pvt. Ltd.</h4>
                    <p className="text-[11px] text-gray-400">Version 2.4.0 (Build 890)</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="font-bold text-gray-900 mb-1">Terms of Service</p>
                    <p>All rides are subject to RaahGo Passenger Safety & Service Terms.</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                    <p className="font-bold text-gray-900 mb-1">Privacy Policy</p>
                    <p>We respect your privacy. Location and contact data are strictly encrypted.</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Invoice / Receipt Popup Modal */}
        {selectedInvoice && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 space-y-4 shadow-2xl border border-gray-200 animate-slide-up">
              
              {/* Receipt Header */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                    RG
                  </div>
                  <div>
                    <h4 className="font-black text-sm text-gray-900">Trip Receipt</h4>
                    <span className="text-[10px] font-bold text-gray-400">#{selectedInvoice.booking_number}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedInvoice(null)}
                  className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center border-none cursor-pointer text-xs"
                >
                  ✕
                </button>
              </div>

              {/* Fare Summary */}
              <div className="text-center py-2 bg-gray-50 rounded-2xl space-y-0.5 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Total Paid</span>
                <h3 className="text-2xl font-black text-emerald-800">
                  ₹{selectedInvoice.total_fare || selectedInvoice.base_fare || '65.00'}
                </h3>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/60 px-2 py-0.5 rounded-full inline-block">
                  Paid via {selectedInvoice.payment_method || 'Cash'}
                </span>
              </div>

              {/* Line Items */}
              <div className="space-y-2 text-xs border-y border-gray-100 py-3">
                <div className="flex justify-between text-gray-600">
                  <span>Base Fare</span>
                  <span className="font-bold text-gray-900">₹{(parseFloat(selectedInvoice.total_fare || 65) * 0.75).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Distance & Time Charge</span>
                  <span className="font-bold text-gray-900">₹{(parseFloat(selectedInvoice.total_fare || 65) * 0.20).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Taxes & Service Fee (5%)</span>
                  <span className="font-bold text-gray-900">₹{(parseFloat(selectedInvoice.total_fare || 65) * 0.05).toFixed(2)}</span>
                </div>
              </div>

              {/* Locations */}
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold">🟢 Pickup:</span>
                  <span className="text-gray-800 truncate font-semibold">{selectedInvoice.pickup_address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-600 font-bold">🔴 Drop:</span>
                  <span className="text-gray-800 truncate font-semibold">{selectedInvoice.dropoff_address}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedInvoice(null)}
                className="w-full py-3 bg-[#063B28] text-white font-extrabold text-xs rounded-xl border-none cursor-pointer shadow-md"
              >
                Close Receipt
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
