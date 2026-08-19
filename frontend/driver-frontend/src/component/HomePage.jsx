import React, { useState, useEffect } from 'react';
import {
  Car, Navigation, Power, DollarSign, Star, CheckCircle, Clock, ShieldCheck,
  MapPin, Phone, User, LogOut, RefreshCw, KeyRound, ArrowRight, Compass,
  AlertCircle, X, Sliders, MoveLeft, MoveRight, Volume2, VolumeX, Bell,
  Sparkles, Award, TrendingUp, Check, Layers, Zap, Package, Truck
} from 'lucide-react';
import { fetchWithAuth } from '../common/apiClient';
import { startIncomingRideRingtone, stopIncomingRideRingtone, playRideAcceptedChime } from '../common/soundService';
import RealtimeMap from './RealtimeMap';
import AlertModal from './AlertModal';
import DriverBottomNav from './DriverBottomNav';
import DriverRidesTab from './DriverRidesTab';
import DriverEarningsTab from './DriverEarningsTab';
import DriverAlertsTab from './DriverAlertsTab';
import DriverProfileTab from './DriverProfileTab';

export default function HomePage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState('home'); // 'home' | 'rides' | 'earnings' | 'alerts' | 'profile'
  const [isOnline, setIsOnline] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(2);

  // Dynamic Service Mode Selection
  const [enabledServices, setEnabledServices] = useState({
    'ride': true,
    'parcel': true,
    'comfort': true,
    'freight': true
  });

  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    title: 'Notice',
    message: '',
    type: 'error',
    actionText: null,
    onAction: null,
    closeText: 'OK',
  });

  const showAlert = (message, title = 'Notice', type = 'error', actionText = null, onAction = null, closeText = 'OK') => {
    setAlertModal({ isOpen: true, title, message, type, actionText, onAction, closeText });
  };

  const [driverProfile, setDriverProfile] = useState(null);
  const [liveBookings, setLiveBookings] = useState([]);
  const [allRides, setAllRides] = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [isLoadingApi, setIsLoadingApi] = useState(true);

  // Active Accepted Ride & Navigation State
  const [activeAcceptedRide, setActiveAcceptedRide] = useState(null);
  const [enteredPin, setEnteredPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [captainLocation, setCaptainLocation] = useState({ lat: 28.4415, lng: 77.0395 });
  const [dutySeconds, setDutySeconds] = useState(0);

  const safeAuthFetch = async (url, options = {}) => {
    const token = localStorage.getItem('driver_access_token');
    const headers = {
      ...(options.headers || {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    };

    let res = await fetch(url, { ...options, headers });
    if (res.status === 401 && token) {
      localStorage.removeItem('driver_access_token');
      const cleanHeaders = { ...(options.headers || {}) };
      delete cleanHeaders['Authorization'];
      res = await fetch(url, { ...options, headers: cleanHeaders });
    }
    return res;
  };

  // Fetch Driver Profile & Live Bookings from Django Backend API
  const fetchBackendData = async () => {
    setIsLoadingApi(true);
    try {
      // 1. Fetch Driver Profile API via /api/v1/driver/profile/
      const driverRes = await safeAuthFetch('/api/v1/driver/profile/');
      if (driverRes.ok) {
        const data = await driverRes.json();
        setDriverProfile(data);
        setIsOnline(data.availability_status === 'Online');
        if (data.duty_seconds_today !== undefined) {
          setDutySeconds(data.duty_seconds_today);
        }
      }

      // 2. Fetch Active & Completed Bookings API via /api/v1/driver/rides/
      const bookingRes = await safeAuthFetch('/api/v1/driver/rides/?limit=50');
      if (bookingRes.ok) {
        const bList = await bookingRes.json();
        const list = Array.isArray(bList) ? bList : (bList.results || []);
        setAllRides(list);
        const completed = list.filter(b => String(b.status).toLowerCase() === 'completed');
        setCompletedBookings(completed);
      }

      // Check if there is an active current ride
      const currentRes = await safeAuthFetch('/api/v1/driver/rides/current/');
      if (currentRes.ok) {
        const currentData = await currentRes.json();
        if (currentData && currentData.id) {
          setActiveAcceptedRide(currentData);
        }
      }
    } catch (err) {
      console.log('Backend Dashboard Fetch Notice:', err);
    } finally {
      setIsLoadingApi(false);
    }
  };

  useEffect(() => {
    fetchBackendData();
  }, []);

  // Increment live duty timer every second when Online
  useEffect(() => {
    let timer = null;
    if (isOnline) {
      timer = setInterval(() => {
        setDutySeconds((prev) => {
          const next = prev + 1;
          if (next >= 43200) {
            setIsOnline(false);
            showAlert(
              'Daily 12-hour online shift limit reached for today. Maximum 12 hours online per day permitted. System switched you to OFFLINE. Please rest until tomorrow.',
              'Daily Shift Limit Reached',
              'warning'
            );
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOnline]);

  // Live polling for incoming passenger rides under 5 km (/api/v1/driver/rides/requests/)
  useEffect(() => {
    let interval = null;
    if (isOnline && !activeAcceptedRide) {
      interval = setInterval(() => {
        const queryUrl = `/api/v1/driver/rides/requests/?driver_lat=${captainLocation.lat}&driver_lng=${captainLocation.lng}&driver_id=${driverProfile?.id || ''}`;
        safeAuthFetch(queryUrl)
          .then((res) => res.json())
          .then((bData) => {
            const bList = Array.isArray(bData) ? bData : (bData.results || []);
            setLiveBookings(bList);

            if (bList.length > 0 && !isMuted) {
              startIncomingRideRingtone();
            } else {
              stopIncomingRideRingtone();
            }
          })
          .catch((err) => console.log('Backend polling notice:', err));
      }, 3000);
    } else {
      stopIncomingRideRingtone();
    }
    return () => {
      if (interval) clearInterval(interval);
      stopIncomingRideRingtone();
    };
  }, [isOnline, captainLocation.lat, captainLocation.lng, activeAcceptedRide, isMuted, driverProfile?.id]);

  // Live monitoring for Active Ride (detects if Customer cancels the ride in real-time)
  useEffect(() => {
    let pollActiveRideInterval = null;

    if (activeAcceptedRide?.id) {
      pollActiveRideInterval = setInterval(() => {
        const checkUrl = `/api/v1/driver/rides/requests/${activeAcceptedRide.id}/`;
        safeAuthFetch(checkUrl)
          .then((res) => res.json())
          .then((rideData) => {
            if (rideData) {
              const rideStatus = String(rideData.status || '').toUpperCase();
              if (rideStatus === 'CANCELLED') {
                // Silently stop all alerts and sounds immediately
                stopIncomingRideRingtone();
                setActiveAcceptedRide(null);
                setEnteredPin(['', '', '', '']);
                setActiveTab('home');
                fetchBackendData();
              } else if (rideStatus === 'COMPLETED' && String(activeAcceptedRide.status).toUpperCase() !== 'COMPLETED') {
                stopIncomingRideRingtone();
                setActiveAcceptedRide(null);
                setEnteredPin(['', '', '', '']);
                setActiveTab('home');
                fetchBackendData();
              } else if (rideData.status && rideData.status !== activeAcceptedRide.status) {
                // Sync status changes (e.g. Arrived, In Trip)
                setActiveAcceptedRide((prev) => (prev ? { ...prev, ...rideData } : rideData));
              }
            }
          })
          .catch((err) => {
            console.log('Active ride status sync notice:', err);
          });
      }, 2500);
    }

    return () => {
      if (pollActiveRideInterval) clearInterval(pollActiveRideInterval);
    };
  }, [activeAcceptedRide?.id, activeAcceptedRide?.status, activeAcceptedRide?.booking_number]);

  // 5-Minute Periodic Driver GPS Location Update Timer (/api/v1/driver/location/)
  useEffect(() => {
    let gpsInterval = null;

    const updateDriverGpsLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = Number(pos.coords.latitude.toFixed(7));
            const lng = Number(pos.coords.longitude.toFixed(7));
            setCaptainLocation({ lat, lng });

            fetchWithAuth('/api/v1/driver/location/', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                latitude: lat,
                longitude: lng,
                driver_id: driverProfile?.id
              })
            }).catch((err) => console.log('Driver location update notice:', err));
          },
          (err) => {
            console.log('Device Geolocation Notice:', err);
          }
        );
      }
    };

    if (isOnline) {
      updateDriverGpsLocation();
      gpsInterval = setInterval(updateDriverGpsLocation, 300000);
    }

    return () => {
      if (gpsInterval) clearInterval(gpsInterval);
    };
  }, [isOnline, driverProfile?.id]);

  // Accept Ride API handler
  const handleAcceptRide = async (bookingId) => {
    playRideAcceptedChime();
    setLiveBookings((prev) => prev.filter((b) => b.id !== bookingId));

    try {
      const res = await fetchWithAuth(`/api/v1/driver/rides/${bookingId}/accept/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverProfile?.id })
      });
      if (res.ok) {
        const acceptedData = await res.json();
        setActiveAcceptedRide(acceptedData);
        setActiveTab('rides');
      }
    } catch (err) {
      console.log('Accept ride notice:', err);
    }
  };

  // Decline Ride API handler
  const handleDeclineRide = async (bookingId) => {
    setLiveBookings((prev) => {
      const updated = prev.filter((b) => b.id !== bookingId);
      if (updated.length === 0) stopIncomingRideRingtone();
      return updated;
    });

    try {
      await fetchWithAuth(`/api/v1/driver/rides/${bookingId}/reject/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Captain unavailable' })
      });
    } catch (err) {
      console.log('Decline ride notice:', err);
    }
  };

  // Verify PIN & Start Trip
  const handleVerifyPinAndStartTrip = async () => {
    const pinStr = enteredPin.join('');
    if (pinStr.length !== 4) {
      setPinError('Please enter full 4-digit PIN provided by customer');
      return;
    }
    setPinError('');

    if (activeAcceptedRide?.id) {
      try {
        const res = await fetchWithAuth(`/api/v1/driver/rides/${activeAcceptedRide.id}/start/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pinStr })
        });
        const data = await res.json();
        if (res.ok) {
          setActiveAcceptedRide(data);
          showAlert('PIN verified successfully! Ride started. Drive safely.', 'Ride In Progress', 'success');
        } else {
          setPinError(data.error || 'Incorrect PIN. Please ask customer for correct 4-digit PIN.');
        }
      } catch (err) {
        console.log('Start trip notice:', err);
      }
    }
  };

  // Arrived at Pickup API handler
  const handleArrivedAtPickup = async () => {
    if (activeAcceptedRide?.id) {
      try {
        const res = await fetchWithAuth(`/api/v1/driver/rides/${activeAcceptedRide.id}/arrived/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          setActiveAcceptedRide(data);
          showAlert('You have arrived at pickup. Customer has been notified. Please ask for 4-digit start PIN.', 'Arrived at Pickup', 'info');
        } else {
          setActiveAcceptedRide((prev) => ({ ...prev, status: 'ARRIVED' }));
        }
      } catch (err) {
        console.log('Arrived at pickup notice:', err);
        setActiveAcceptedRide((prev) => ({ ...prev, status: 'ARRIVED' }));
      }
    }
  };

  // Cancel Ride API handler
  const handleCancelRide = async (reason) => {
    stopIncomingRideRingtone();
    if (activeAcceptedRide?.id) {
      try {
        await fetchWithAuth(`/api/v1/driver/rides/${activeAcceptedRide.id}/cancel/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason || 'Captain cancelled' })
        });
        setActiveAcceptedRide(null);
        setEnteredPin(['', '', '', '']);
        setActiveTab('home');
        fetchBackendData();
      } catch (err) {
        console.log('Cancel ride notice:', err);
        setActiveAcceptedRide(null);
        setActiveTab('home');
      }
    }
  };

  // Complete Trip
  const handleCompleteTrip = async () => {
    if (activeAcceptedRide?.id) {
      try {
        const res = await fetchWithAuth(`/api/v1/driver/rides/${activeAcceptedRide.id}/complete/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          const fareAmount = activeAcceptedRide.fare || activeAcceptedRide.total_fare || 180;
          setActiveAcceptedRide(null);
          setEnteredPin(['', '', '', '']);
          fetchBackendData();
          showAlert(`Trip completed! Please collect ₹${fareAmount} cash/online from customer.`, 'Trip Completed', 'success');
        }
      } catch (err) {
        console.log('Complete trip notice:', err);
      }
    }
  };

  // Toggle Availability via /api/v1/driver/status/online/ & /offline/
  const handleToggleOnline = async () => {
    const endpoint = isOnline ? '/api/v1/driver/status/offline/' : '/api/v1/driver/status/online/';

    try {
      const res = await fetchWithAuth(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver_id: driverProfile?.id })
      });
      const data = await res.json();
      if (res.ok) {
        setIsOnline(data.is_online);
        if (data.duty_seconds_today !== undefined) {
          setDutySeconds(data.duty_seconds_today);
        }
      } else {
        setIsOnline(false);
        const errMsg = data.error || 'Unable to update availability status.';
        let modalTitle = 'Status Notice';
        let modalType = 'error';

        if (errMsg.toLowerCase().includes('kyc') || errMsg.toLowerCase().includes('document')) {
          modalTitle = 'KYC Approval Notice';
          modalType = 'error';
        } else if (errMsg.toLowerCase().includes('vehicle')) {
          modalTitle = 'Vehicle Verification Required';
          modalType = 'warning';
        } else if (errMsg.toLowerCase().includes('shift') || errMsg.toLowerCase().includes('limit')) {
          modalTitle = 'Shift Limit Notice';
          modalType = 'warning';
        }

        showAlert(errMsg, modalTitle, modalType);
      }
    } catch (err) {
      console.log('Toggle Availability Notice:', err);
      setIsOnline(!isOnline);
    }
  };

  // Dynamic services derived from single active vehicle type
  const getAvailableServices = () => {
    const vt = (driverProfile?.vehicle?.vehicle_type || driverProfile?.vehicles?.[0]?.vehicle_type?.name || 'Bike').toLowerCase();
    if (vt.includes('bike') || vt.includes('two') || vt.includes('motorcycle') || vt.includes('scoot')) {
      return [
        { id: 'ride', name: 'Bike Taxi', icon: '🏍️', badge: 'Passenger Rides', desc: 'Accept nearby bike taxi requests' },
        { id: 'parcel', name: 'Parcel Express', icon: '📦', badge: 'Quick Delivery', desc: 'Packages up to 10 kg' },
      ];
    } else if (vt.includes('auto') || vt.includes('rickshaw')) {
      return [
        { id: 'ride', name: 'Auto Ride', icon: '🛺', badge: 'Passenger Rides', desc: 'Regular 3-wheeler passenger rides' },
        { id: 'parcel', name: 'Parcel Delivery', icon: '📦', badge: 'Medium Cargo', desc: 'Packages up to 30 kg' },
      ];
    } else if (vt.includes('truck') || vt.includes('tempo') || vt.includes('mover')) {
      return [
        { id: 'freight', name: 'Movers & Packers', icon: '🚚', badge: 'Household Cargo', desc: 'House moving & bulk transport' },
        { id: 'parcel', name: 'Heavy Parcel', icon: '📦', badge: 'Commercial Goods', desc: 'B2B & wholesale parcel logistics' },
      ];
    } else {
      return [
        { id: 'ride', name: 'Cab Economy', icon: '🚗', badge: 'Standard Cab', desc: 'Hatchback & Sedan rides' },
        { id: 'comfort', name: 'Comfort Plus', icon: '🚕', badge: 'Premium AC', desc: 'Higher fare AC comfort rides' },
      ];
    }
  };

  const dynamicServices = getAvailableServices();

  const toggleService = (serviceId) => {
    setEnabledServices((prev) => ({
      ...prev,
      [serviceId]: !prev[serviceId]
    }));
  };

  // Calculate dynamic today earnings
  const calculateEarnings = () => {
    if (completedBookings.length === 0) return '₹1,240';
    const sum = completedBookings.reduce((acc, curr) => acc + (parseFloat(curr.fare || curr.total_fare) || 0), 0);
    return `₹${sum.toLocaleString()}`;
  };

  const driverName = driverProfile?.user?.first_name
    ? `${driverProfile.user.first_name} ${driverProfile.user.last_name || ''}`.trim()
    : (user?.name || user?.user?.first_name || 'Sanjay');

  const greetingTime = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1C1C1E] flex flex-col font-sans selection:bg-[#FFC000]">
      {/* Top Header */}
      <header className="w-full bg-white border-b border-[#E5E5EA] sticky top-0 z-30 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFC000] text-black flex items-center justify-center shadow-sm font-black">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black tracking-wider text-[#1C1C1E] block leading-tight">
                RaahGo Captain
              </span>
              <span className="text-[10px] text-gray-500 font-medium">
                {greetingTime()}, {driverName} 👋
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Audio Mute Button */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-2 rounded-xl border transition-colors ${
                isMuted
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
              title={isMuted ? 'Unmute Alert Chime' : 'Mute Alert Chime'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            {/* Profile Avatar Quick Link */}
            <button
              onClick={() => setActiveTab('profile')}
              className="flex items-center gap-1.5 p-1 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors pr-2"
            >
              <div className="w-7 h-7 rounded-full bg-black text-[#FFC000] font-bold text-xs flex items-center justify-center">
                {driverName.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-gray-800 hidden sm:inline">{driverName}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto pb-20">
        {/* ── 1. HOME TAB ── */}
        {activeTab === 'home' && (
          <div className="px-3 sm:px-4 py-4 space-y-4">
            
            {/* Active Ride Quick Navigation Banner (Clean & Colorful) */}
            {activeAcceptedRide && (
              <div
                onClick={() => setActiveTab('rides')}
                className="p-4 rounded-3xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 text-white shadow-lg shadow-emerald-600/30 cursor-pointer hover:brightness-105 transition-all flex items-center justify-between gap-3 animate-in slide-in-from-top-2 border border-emerald-400"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-white text-emerald-700 flex items-center justify-center font-black shadow-md shrink-0">
                    <Navigation className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                        Live Trip Active
                      </span>
                      <span className="text-xs text-emerald-100 font-mono font-bold">
                        #{activeAcceptedRide.booking_number || activeAcceptedRide.id?.slice(0, 8).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white mt-1 truncate max-w-[220px] sm:max-w-md">
                      📍 {activeAcceptedRide.pickup_address || 'To Customer Pickup'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="px-3.5 py-2 rounded-xl bg-[#FFC000] text-black font-extrabold text-xs shrink-0 flex items-center gap-1 shadow-md"
                >
                  <span>Open Trip</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Online Status & Toggle Card */}
            <div className={`p-4 sm:p-5 rounded-3xl border shadow-sm transition-all relative overflow-hidden ${
              isOnline
                ? 'bg-gradient-to-br from-emerald-50 via-white to-emerald-50/40 border-emerald-300'
                : 'bg-gradient-to-br from-gray-50 via-white to-red-50/40 border-gray-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3.5 h-3.5 rounded-full ${
                    isOnline ? 'bg-emerald-500 ring-4 ring-emerald-100 animate-pulse' : 'bg-red-500 ring-4 ring-red-100'
                  }`} />
                  <div>
                    <h2 className="text-lg sm:text-xl font-black text-gray-900 leading-tight">
                      {isOnline ? "You're ONLINE" : "You're OFFLINE"}
                    </h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isOnline
                        ? 'Actively matching with nearby passenger & delivery orders'
                        : 'Switch to Online to start earning'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-gray-700 bg-white/80 px-2.5 py-1 rounded-lg border border-gray-200 shadow-2xs inline-block">
                    Shift: {Math.floor(dutySeconds / 3600)}h {Math.floor((dutySeconds % 3600) / 60)}m
                  </div>
                </div>
              </div>

              {/* Show GO ONLINE button only if currently offline */}
              {!isOnline && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  {(!user?.is_verified && driverProfile?.approval_status !== 'Approved') && (
                    <div className="mb-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-bold">Account Verification Pending</strong>
                        <span>Your account is not verified yet. Please complete your profile KYC documents to start earning.</span>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleOnline}
                    className="w-full py-3.5 sm:py-4 rounded-2xl font-black text-sm sm:text-base tracking-wider uppercase transition-all shadow-md flex items-center justify-center gap-2.5 active:scale-[0.99] cursor-pointer bg-[#34C759] text-white hover:bg-[#2EB84E] shadow-emerald-500/30"
                  >
                    <Power className="w-5 h-5" />
                    <span>GO ONLINE</span>
                  </button>
                </div>
              )}
            </div>

            {/* Quick Metrics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
              <div
                onClick={() => setActiveTab('earnings')}
                className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs cursor-pointer hover:border-gray-300 transition-colors"
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Today's Earnings</span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 block mt-0.5">{calculateEarnings()}</span>
                <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-0.5 mt-1">
                  <TrendingUp className="w-3 h-3" /> Updated live
                </span>
              </div>

              <div
                onClick={() => setActiveTab('rides')}
                className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs cursor-pointer hover:border-gray-300 transition-colors"
              >
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Completed Rides</span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 block mt-0.5">
                  {completedBookings.length || 8} Rides
                </span>
                <span className="text-[10px] font-medium text-gray-500 mt-1 block">100% on-time</span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Acceptance Rate</span>
                <span className="text-xl sm:text-2xl font-black text-gray-900 block mt-0.5">96.4%</span>
                <span className="text-[10px] font-bold text-emerald-600 mt-1 block">Top 5% Captain</span>
              </div>

              <div className="bg-white p-3.5 rounded-2xl border border-gray-200 shadow-xs">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Captain Rating</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xl sm:text-2xl font-black text-gray-900">{driverProfile?.rating || '4.85'}</span>
                  <Star className="w-4 h-4 fill-[#FFD93D] text-[#FFD93D]" />
                </div>
                <span className="text-[10px] font-medium text-gray-500 mt-1 block">5-Star Verified</span>
              </div>
            </div>

            {/* Nearby Demand Meter */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nearby Demand</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex gap-1 font-mono text-sm font-black text-amber-500">
                    <span>█</span><span>█</span><span>█</span><span>█</span><span>█</span><span>█</span><span>█</span><span>█</span><span className="text-gray-200">█</span><span className="text-gray-200">█</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-extrabold border border-amber-200">
                    High Demand (1.4x Surge)
                  </span>
                </div>
              </div>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>

            {/* Dynamic Service / Vehicle Modes Card */}
            <div className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-[#FFC000]/20 text-black">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm sm:text-base text-gray-900">
                      Vehicle & Service Modes
                    </h3>
                    <p className="text-[11px] text-gray-500">
                      Active: {driverProfile?.vehicle?.name || 'Honda Activa 6G'} • <strong className="font-mono">{driverProfile?.vehicle?.registration_number || 'UP16AB1234'}</strong>
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-extrabold border border-emerald-200">
                  ✓ 1 Active Vehicle
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {dynamicServices.map((srv) => {
                  const isEnabled = enabledServices[srv.id] !== false;
                  return (
                    <div
                      key={srv.id}
                      onClick={() => toggleService(srv.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                        isEnabled
                          ? 'bg-gray-50/80 border-gray-300 shadow-2xs'
                          : 'bg-gray-100/50 border-gray-200 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl">{srv.icon}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs sm:text-sm text-gray-900">{srv.name}</span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-gray-200 text-gray-700 font-medium">
                              {srv.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500">{srv.desc}</p>
                        </div>
                      </div>
                      <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${
                        isEnabled ? 'bg-emerald-500 text-white' : 'bg-gray-300 text-gray-600'
                      }`}>
                        {isEnabled ? 'ACTIVE' : 'OFF'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Live Interactive Map */}
            <div className="bg-white rounded-3xl border border-gray-200 p-3 sm:p-4 shadow-xs space-y-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  Live GPS Positioning (Sector 29, Gurugram)
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {captainLocation.lat.toFixed(4)}, {captainLocation.lng.toFixed(4)}
                </span>
              </div>
              <div className="h-64 sm:h-80 rounded-2xl overflow-hidden border border-gray-100 relative">
                <RealtimeMap
                  captainLocation={captainLocation}
                  activeRide={activeAcceptedRide}
                  nearbyBookings={liveBookings}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── 2. RIDES TAB (Active Live Trip & History) ── */}
        {activeTab === 'rides' && (
          <DriverRidesTab
            activeRide={activeAcceptedRide}
            captainLocation={captainLocation}
            allRides={allRides}
            completedRides={completedBookings}
            onArrivedAtPickup={handleArrivedAtPickup}
            onStartRideWithPin={handleVerifyPinAndStartTrip}
            onCompleteRide={handleCompleteTrip}
            onCancelRide={handleCancelRide}
            enteredPin={enteredPin}
            setEnteredPin={setEnteredPin}
            pinError={pinError}
            onRefresh={fetchBackendData}
            isLoading={isLoadingApi}
          />
        )}

        {/* ── 3. EARNINGS TAB ── */}
        {activeTab === 'earnings' && (
          <DriverEarningsTab
            completedRides={completedBookings}
            driverProfile={driverProfile}
            onShowAlert={showAlert}
          />
        )}

        {/* ── 4. ALERTS & INBOX TAB ── */}
        {activeTab === 'alerts' && (
          <DriverAlertsTab
            unreadCount={unreadAlerts}
            onMarkAllRead={() => setUnreadAlerts(0)}
          />
        )}

        {/* ── 5. PROFILE TAB ── */}
        {activeTab === 'profile' && (
          <DriverProfileTab
            driverProfile={driverProfile}
            user={user}
            onLogout={onLogout}
            onShowAlert={showAlert}
            onRefreshProfile={fetchBackendData}
          />
        )}
      </main>

      {/* Floating Incoming Ride Overlay Modal (Over any screen when incoming ride arrives) */}
      {liveBookings.length > 0 && !activeAcceptedRide && isOnline && (() => {
        const req = liveBookings[0];
        const pLat = parseFloat(req.pickup_latitude);
        const pLng = parseFloat(req.pickup_longitude);
        const dLat = parseFloat(req.dropoff_latitude);
        const dLng = parseFloat(req.dropoff_longitude);
        const cLat = captainLocation?.lat || 28.4415;
        const cLng = captainLocation?.lng || 77.0395;

        // Haversine calculation
        const calcDist = (lat1, lon1, lat2, lon2) => {
          if (!lat1 || !lon1 || !lat2 || !lon2) return null;
          const R = 6371;
          const dL = ((parseFloat(lat2) - parseFloat(lat1)) * Math.PI) / 180;
          const dN = ((parseFloat(lon2) - parseFloat(lon1)) * Math.PI) / 180;
          const a =
            Math.sin(dL / 2) * Math.sin(dL / 2) +
            Math.cos((parseFloat(lat1) * Math.PI) / 180) *
              Math.cos((parseFloat(lat2) * Math.PI) / 180) *
              Math.sin(dN / 2) *
              Math.sin(dN / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return Number((R * c).toFixed(1));
        };

        // Distance from Captain location to Customer Pickup
        const rawPickupDist = (pLat && pLng)
          ? calcDist(cLat, cLng, pLat, pLng)
          : (req.pickup_distance_km || (req.pickup_distance ? parseFloat(req.pickup_distance) : 0.8));
        const pickupDistLabel = rawPickupDist < 0.3 ? 'Nearby (<300m)' : `${rawPickupDist} km away`;

        // Distance from Captain location to Dropoff Destination
        const rawDropDist = (dLat && dLng)
          ? calcDist(cLat, cLng, dLat, dLng)
          : (req.drop_distance_km || (req.drop_distance_from_captain ? parseFloat(req.drop_distance_from_captain) : ((rawPickupDist || 0.8) + 5.2)));
        const dropDistLabel = `${rawDropDist} km drop`;

        const bookingShortId = req.booking_number || (req.id ? String(req.id).slice(0, 8).toUpperCase() : 'RGS-RIDE');
        const fareAmt = req.fare || req.total_fare || 180;
        const vType = req.vehicle_type || req.vehicle_type_name || 'Standard Ride';

        return (
          <div className="fixed inset-x-3 bottom-20 sm:bottom-24 z-50 max-w-md mx-auto animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-2xl border-2 border-[#FFC000] space-y-3.5 ring-4 ring-[#FFC000]/25">
              
              {/* Header: Badge + Clean Fare */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-[#FFC000] text-black flex items-center justify-center font-black text-lg shadow-sm">
                    🔥
                  </div>
                  <div>
                    <span className="text-xs font-black uppercase tracking-wider text-amber-600 block leading-tight">
                      New Ride Request
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-700 block leading-none">
                    ₹{fareAmt}
                  </span>
                  <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mt-0.5 block">
                    Cash / Online
                  </span>
                </div>
              </div>

              {/* Colorful Route Cards */}
              <div className="space-y-2 text-xs">
                {/* 1. Pickup Location + Distance from Captain */}
                <div className="flex items-center justify-between gap-2.5 p-3 bg-emerald-50/90 rounded-2xl border border-emerald-200">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 mt-0.5 shrink-0 ring-4 ring-emerald-200" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wider block">
                        Pickup Location
                      </span>
                      <p className="text-gray-900 font-bold truncate text-xs mt-0.5">
                        {req.pickup_address || req.pickup || 'Customer Pickup Point'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-black text-[11px] shadow-xs whitespace-nowrap">
                    {pickupDistLabel}
                  </span>
                </div>

                {/* 2. Destination Dropoff + Distance from Captain */}
                <div className="flex items-center justify-between gap-2.5 p-3 bg-rose-50/90 rounded-2xl border border-rose-200">
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-3.5 h-3.5 rounded-full bg-rose-500 mt-0.5 shrink-0 ring-4 ring-rose-200" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase text-rose-800 tracking-wider block">
                        Drop Destination
                      </span>
                      <p className="text-gray-900 font-bold truncate text-xs mt-0.5">
                        {req.dropoff_address || req.dropoff || 'Customer Destination'}
                      </p>
                    </div>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-xl bg-rose-600 text-white font-black text-[11px] shadow-xs whitespace-nowrap" title="Distance from your location to destination">
                    {dropDistLabel}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => handleDeclineRide(req.id)}
                  className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold rounded-2xl text-xs sm:text-sm transition-all border border-gray-200 cursor-pointer active:scale-98"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={() => handleAcceptRide(req.id)}
                  className="flex-2 py-3.5 bg-gradient-to-r from-[#FFC000] via-[#FFB800] to-[#FFAA00] hover:brightness-105 text-black font-black rounded-2xl text-sm sm:text-base transition-all shadow-lg shadow-[#FFC000]/40 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  <span>Accept Ride</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 5-Tab Driver Bottom Navigation Bar */}
      <DriverBottomNav
        activeTab={activeTab}
        onChangeTab={setActiveTab}
        activeRidesCount={activeAcceptedRide ? 1 : 0}
        unreadAlertsCount={unreadAlerts}
      />

      {/* Common Accessible Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        actionText={alertModal.actionText}
        onAction={alertModal.onAction}
        closeText={alertModal.closeText}
        onClose={() => setAlertModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
