import React, { useState, useEffect } from 'react';
import { Car, Navigation, Power, DollarSign, Star, CheckCircle, Clock, ShieldCheck, MapPin, Phone, User, LogOut, RefreshCw, KeyRound, ArrowRight, Compass, AlertCircle, X, Sliders, MoveLeft, MoveRight, Volume2, VolumeX, Bell } from 'lucide-react';
import { fetchWithAuth } from '../common/apiClient';
import { startIncomingRideRingtone, stopIncomingRideRingtone, playRideAcceptedChime } from '../common/soundService';
import RealtimeMap from './RealtimeMap';

export default function HomePage({ user, onLogout }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  // Live Touch/Mouse Floating Drag & Snap Handling
  const [floatingPos, setFloatingPos] = useState({
    side: 'right', // 'right' | 'left'
    topY: 280,     // vertical position in px when snapped
    currX: null,   // live drag X
    currY: null,   // live drag Y
  });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = React.useRef({ x: 0, y: 0 });
  const initialPos = React.useRef({ x: 0, y: 280 });

  const handleDragStart = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    if (clientX === undefined || clientY === undefined) return;

    setIsDragging(false);
    dragStartPos.current = { x: clientX, y: clientY };

    // Calculate starting button top-left position
    const startX = floatingPos.currX !== null
      ? floatingPos.currX
      : (floatingPos.side === 'right' ? window.innerWidth - 60 : 0);
    const startY = floatingPos.currY !== null ? floatingPos.currY : floatingPos.topY;
    initialPos.current = { x: startX, y: startY };

    let moved = false;
    let latestX = startX;
    let latestY = startY;

    const onPointerMove = (moveEvt) => {
      const moveX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
      const moveY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;
      if (moveX === undefined || moveY === undefined) return;

      const deltaX = moveX - dragStartPos.current.x;
      const deltaY = moveY - dragStartPos.current.y;

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        moved = true;
        setIsDragging(true);
      }

      if (moved) {
        latestX = Math.max(0, Math.min(window.innerWidth - 56, initialPos.current.x + deltaX));
        latestY = Math.max(60, Math.min(window.innerHeight - 80, initialPos.current.y + deltaY));
        setFloatingPos((prev) => ({
          ...prev,
          currX: latestX,
          currY: latestY,
        }));
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);

      if (moved) {
        // Snap to nearest side (Left or Right) upon release
        const snapSide = latestX < window.innerWidth / 2 ? 'left' : 'right';
        setFloatingPos({
          side: snapSide,
          topY: latestY,
          currX: null,
          currY: null,
        });
      }

      setTimeout(() => setIsDragging(false), 150);
    };

    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchmove', onPointerMove, { passive: false });
    window.addEventListener('touchend', onPointerUp);
  };

  const [driverProfile, setDriverProfile] = useState(null);
  const [liveBookings, setLiveBookings] = useState([]);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [isLoadingApi, setIsLoadingApi] = useState(true);

  // Active Accepted Ride & Navigation State
  const [activeAcceptedRide, setActiveAcceptedRide] = useState(null);
  const [enteredPin, setEnteredPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [captainLocation, setCaptainLocation] = useState({ lat: 28.4415, lng: 77.0395 });

  const driverName = driverProfile?.user?.first_name
    ? `${driverProfile.user.first_name} ${driverProfile.user.last_name || ''}`.trim()
    : (user?.name || user?.user?.first_name || (user?.phone_number ? `Captain ${user.phone_number}` : 'Captain Partner'));

  const vehicleInfo = driverProfile?.vehicles?.[0]
    ? `${driverProfile.vehicles[0].make} ${driverProfile.vehicles[0].model} (${driverProfile.vehicles[0].registration_number})`
    : (user?.vehicle_number ? `${user.vehicle_model || 'Vehicle'} (${user.vehicle_number})` : 'Vehicle Registered');

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

  const [dutySeconds, setDutySeconds] = useState(0);

  // Fetch Driver Profile & Live Bookings from Django Backend API
  useEffect(() => {
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
        const bookingRes = await safeAuthFetch('/api/v1/driver/rides/?limit=30');
        if (bookingRes.ok) {
          const bList = await bookingRes.json();
          const list = Array.isArray(bList) ? bList : (bList.results || []);
          
          const completed = list.filter(b => b.status === 'Completed');
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
            alert('Daily 12-hour online shift limit reached for today. Maximum 12 hours online per day permitted. System switched you to OFFLINE. Please rest until tomorrow.');
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

            // Post location to /api/v1/driver/location/
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
      gpsInterval = setInterval(updateDriverGpsLocation, 300000); // Every 5 minutes (300,000 ms)
    }

    return () => {
      if (gpsInterval) clearInterval(gpsInterval);
    };
  }, [isOnline, driverProfile?.id]);

  // Accept Ride API handler (/api/v1/driver/rides/{id}/accept/)
  const handleAcceptRide = async (bookingId) => {
    // Immediately stop ringtone and play accept confirmation chime
    playRideAcceptedChime();

    // Immediately remove from incoming list UI
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
      }
    } catch (err) {
      console.log('Accept ride notice:', err);
    }
  };

  // Decline Ride API handler (/api/v1/driver/rides/{id}/reject/)
  const handleDeclineRide = async (bookingId) => {
    // Immediately remove from incoming list UI
    setLiveBookings((prev) => {
      const updated = prev.filter((b) => b.id !== bookingId);
      if (updated.length === 0) {
        stopIncomingRideRingtone();
      }
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

  // Verify PIN & Start Trip API Handler (/api/v1/driver/rides/{id}/start/)
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
        } else {
          setPinError(data.error || 'Incorrect PIN. Please ask customer for correct 4-digit PIN.');
        }
      } catch (err) {
        console.log('Start trip notice:', err);
      }
    }
  };

  // Complete Trip API Handler (/api/v1/driver/rides/{id}/complete/)
  const handleCompleteTrip = async () => {
    if (activeAcceptedRide?.id) {
      try {
        const res = await fetchWithAuth(`/api/v1/driver/rides/${activeAcceptedRide.id}/complete/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        if (res.ok) {
          setActiveAcceptedRide(null);
          setEnteredPin(['', '', '', '']);
          const bRes = await fetchWithAuth('/api/v1/driver/rides/?status=Completed');
          if (bRes.ok) {
            const bData = await bRes.json();
            const bList = Array.isArray(bData) ? bData : (bData.results || []);
            setCompletedBookings(bList);
          }
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
        alert(data.error || 'Shift limit reached or unable to change status.');
      }
    } catch (err) {
      console.log('Toggle Availability Notice:', err);
      setIsOnline(!isOnline);
    }
  };

  // Calculate dynamic today earnings from completed bookings
  const calculateEarnings = () => {
    if (completedBookings.length === 0) return '₹0';
    const sum = completedBookings.reduce((acc, curr) => acc + (parseFloat(curr.fare) || 0), 0);
    return `₹${sum}`;
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#1C1C1E] flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="w-full bg-white border-b border-[#E5E5EA] sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3.5 flex items-center justify-between">
          {/* Logo Brand */}
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#FFC000] text-black flex items-center justify-center shadow-md shadow-[#FFC000]/25 shrink-0">
              <Car className="w-4 h-4 sm:w-6 sm:h-6 text-black" />
            </div>
            <div>
              <span className="text-base sm:text-xl font-extrabold tracking-wider text-[#1C1C1E] block leading-tight">
                RaahGo
              </span>
              <span className="text-[9px] sm:text-[10px] font-extrabold uppercase tracking-widest text-[#636366] hidden sm:flex items-center gap-1">
                <span className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full ${isOnline ? 'bg-[#34C759] animate-pulse' : 'bg-[#8E8E93]'}`}></span>
                Captain Portal
              </span>
            </div>
          </div>



          {/* Profile & Logout */}
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-2 bg-[#F8F9FA] border border-[#E5E5EA] px-2 sm:px-3 py-1 sm:py-1.5 rounded-full">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#FFC000] text-black font-extrabold flex items-center justify-center text-xs shrink-0">
                {driverName.charAt(0).toUpperCase()}
              </div>
              <span className="font-extrabold text-[#1C1C1E] hidden sm:inline truncate max-w-[120px]">
                {driverName}
              </span>
              <button
                type="button"
                onClick={onLogout}
                className="text-[#636366] hover:text-[#FF3B30] font-bold transition-colors ml-0.5 cursor-pointer p-0.5"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* Status Alert Banner */}
        <div className={`rounded-2xl p-4 border flex items-center justify-between transition-all ${isOnline
            ? 'bg-[#E8F8EE] border-[#34C759]/30 text-[#1C1C1E]'
            : 'bg-[#FFF3D6] border-[#FFC000]/40 text-[#1C1C1E]'
          }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isOnline ? 'bg-[#34C759] text-white' : 'bg-[#FFC000] text-black'}`}>
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <span>{isOnline ? 'You are Online & Ready for Rides!' : 'You are currently Offline'}</span>
                {isLoadingApi && <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#636366]" />}
              </h3>
              <p className="text-xs text-[#636366] mt-0.5">
                {isOnline ? 'Matching with nearby passenger pickup requests in real-time.' : 'Switch to ONLINE state to start receiving new ride requests.'}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-white border border-[#E5E5EA] hidden sm:inline">
            {vehicleInfo}
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#636366]">Today's Earnings</span>
              <div className="p-1.5 rounded-lg bg-[#FFC000]/20 text-black">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-[#1C1C1E]">{calculateEarnings()}</span>
            <span className="text-[11px] text-[#34C759] font-bold block mt-1">Live from Backend</span>
          </div>

          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#636366]">Trips Completed</span>
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-600">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-[#1C1C1E]">{driverProfile?.total_trips || completedBookings.length}</span>
            <span className="text-[11px] text-[#636366] font-medium block mt-1">Verified Captain Trips</span>
          </div>

          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#636366]">Captain Rating</span>
              <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600">
                <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
              </div>
            </div>
            <span className="text-2xl font-black text-[#1C1C1E]">{driverProfile?.rating || '5.00'} ★</span>
            <span className="text-[11px] text-[#636366] font-medium block mt-1">Backend Database Rating</span>
          </div>

          <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#636366]">Duty Shift Today</span>
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <span className="text-2xl font-black text-[#1C1C1E]">
              {Math.floor(dutySeconds / 3600)}h {Math.floor((dutySeconds % 3600) / 60)}m
            </span>
            <span className="text-[11px] text-[#636366] font-bold block mt-1">
              Max 12h per day ({Math.min(100, Math.round((dutySeconds / 43200) * 100))}% used)
            </span>
          </div>
        </div>

        {/* ACTIVE ACCEPTED RIDE MAP NAVIGATION SECTION */}
        {activeAcceptedRide && (
          <div className="bg-white border border-[#34C759] rounded-3xl p-6 shadow-2xl space-y-6 animate-fade-in text-left">
            <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-white shadow-md ${activeAcceptedRide.status === 'In Trip' ? 'bg-[#007AFF]' : 'bg-[#34C759]'
                  }`}>
                  <Navigation className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider block text-[#34C759]">
                    {activeAcceptedRide.status === 'In Trip' ? '🚗 Trip In Progress' : '🛺 Driving to Pickup Point'}
                  </span>
                  <h3 className="text-base font-black text-[#1C1C1E]">
                    {activeAcceptedRide.status === 'In Trip' ? 'Navigating to Customer Dropoff' : 'En Route to Passenger Pickup'}
                  </h3>
                </div>
              </div>
              <span className="text-xs font-black text-[#1C1C1E] bg-[#FFF9E6] px-3 py-1.5 rounded-xl border border-[#FFC000]">
                Fare: ₹{activeAcceptedRide.total_fare || '350'}
              </span>
            </div>

            {/* Real-time Map Display */}
            <div className="w-full h-[400px]">
              <RealtimeMap
                pickup={activeAcceptedRide.pickup_address}
                destination={activeAcceptedRide.dropoff_address}
                pickupCoords={
                  activeAcceptedRide.status === 'In Trip'
                    ? { lat: activeAcceptedRide.pickup_latitude || 28.6139, lng: activeAcceptedRide.pickup_longitude || 77.2090 }
                    : captainLocation
                }
                destCoords={
                  activeAcceptedRide.status === 'In Trip'
                    ? { lat: activeAcceptedRide.dropoff_latitude || 28.5355, lng: activeAcceptedRide.dropoff_longitude || 77.3910 }
                    : { lat: activeAcceptedRide.pickup_latitude || 28.6139, lng: activeAcceptedRide.pickup_longitude || 77.2090 }
                }
                mode={activeAcceptedRide.status === 'In Trip' ? 'in_trip' : 'pickup'}
              />
            </div>

            {/* Trip Action Controls */}
            {activeAcceptedRide.status !== 'In Trip' ? (
              /* STAGE 1: ENTER 4-DIGIT PIN & START TRIP */
              <div className="bg-[#FFF9E6] border border-[#FFC000] p-4 sm:p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-[#8A6500] uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="w-4 h-4 text-[#8A6500]" /> Enter Passenger 4-Digit Security PIN
                    </h4>
                    <p className="text-xs text-[#1C1C1E] mt-0.5 font-medium">
                      Ask customer for their 4-digit verification PIN to start the trip.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex justify-center sm:justify-start gap-2.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <input
                        key={idx}
                        type="text"
                        maxLength="1"
                        value={enteredPin[idx]}
                        onChange={(e) => {
                          const val = e.target.value;
                          const newArr = [...enteredPin];
                          newArr[idx] = val;
                          setEnteredPin(newArr);
                          if (val && e.target.nextSibling) {
                            e.target.nextSibling.focus();
                          }
                        }}
                        className="w-11 h-11 sm:w-12 sm:h-12 text-center font-extrabold text-xl bg-white border border-[#FFC000] rounded-xl focus:ring-2 focus:ring-[#FFC000] focus:outline-none shadow-xs text-[#1C1C1E]"
                      />
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleVerifyPinAndStartTrip}
                    className="w-full sm:flex-1 py-3 px-4 bg-[#34C759] hover:bg-[#2fb350] active:scale-[0.99] text-white font-extrabold text-xs sm:text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Verify PIN & Start Trip</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

                {pinError && (
                  <p className="text-xs text-[#FF3B30] font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {pinError}
                  </p>
                )}
              </div>
            ) : (
              /* STAGE 2: IN TRIP -> COMPLETE TRIP & COLLECT FARE */
              <div className="bg-[#007AFF]/10 border border-[#007AFF] p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-[#1C1C1E]">
                    Arrived at Dropoff Destination
                  </h4>
                  <p className="text-xs text-[#636366] mt-0.5">
                    Click complete when passenger steps out safely.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCompleteTrip}
                  className="w-full sm:w-auto py-3.5 px-6 bg-gradient-to-r from-[#FFC000] to-[#FF9F0A] hover:from-[#e6ad00] hover:to-[#e68f00] active:scale-[0.99] text-black font-extrabold text-sm rounded-xl shadow-lg shadow-[#FFC000]/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <CheckCircle className="w-5 h-5 text-black" />
                  <span>Complete Trip (Collect ₹{activeAcceptedRide.total_fare || '350'})</span>
                </button>
              </div>
            )}
          </div>
        )}
        {isOnline && (
          liveBookings.length > 0 ? (
            <div className="bg-white border-2 border-[#FFC000] rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden animate-fade-in">
              <div className="absolute top-0 right-0 bg-[#FFC000] text-black font-extrabold text-[10px] uppercase px-4 py-1.5 rounded-bl-2xl flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 animate-ping"></span>
                <span>Incoming Alert</span>
              </div>

              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-lg font-extrabold text-[#1C1C1E] flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#FFF9E6] border border-[#FFC000] flex items-center justify-center">
                    <Car className="w-4 h-4 text-black" />
                  </div>
                  <span>Incoming Ride Request</span>
                </h2>

                {/* Sound Indicator & Mute Toggle */}
                <button
                  type="button"
                  onClick={() => {
                    if (!isMuted) {
                      stopIncomingRideRingtone();
                      setIsMuted(true);
                    } else {
                      setIsMuted(false);
                      startIncomingRideRingtone();
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${!isMuted
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-2xs'
                    : 'bg-gray-100 text-gray-500 border-gray-200'
                  }`}
                  title={!isMuted ? 'Mute Alert Sound' : 'Unmute Alert Sound'}
                >
                  {!isMuted ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
                      <span>Ringtone Active</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5 text-gray-500" />
                      <span>Muted</span>
                    </>
                  )}
                </button>
              </div>

              {liveBookings.map((b) => (
                <div key={b.id} className="space-y-4 border-b border-[#E5E5EA] pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-center justify-between bg-[#F8F9FA] p-3.5 rounded-2xl border border-[#E5E5EA]">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#1C1C1E] text-white flex items-center justify-center font-bold text-sm">
                        {b.customer_details?.name ? b.customer_details.name.charAt(0) : 'P'}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-sm text-[#1C1C1E]">{b.customer_details?.name || b.customer_name || 'Passenger'}</h4>
                        <span className="text-xs text-[#34C759] font-bold flex items-center gap-1">
                          📍 Captain Distance to Pickup: {b.pickup_distance || '1.8 km away (5 mins)'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-black text-[#1C1C1E]">₹{b.total_fare || b.fare || '350'}</span>
                      <span className="text-xs text-[#636366] block">Trip: {b.distance_km ? `${b.distance_km} km` : '12.5 km'}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5 text-xs bg-white p-3 rounded-2xl border border-[#E5E5EA]">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#34C759] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#636366] block text-[10px] uppercase">Pickup Point</span>
                        <span className="font-extrabold text-[#1C1C1E] text-sm">{b.pickup_address || 'Pickup Location Address'}</span>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5 border-t border-[#F8F9FA] pt-2">
                      <MapPin className="w-4 h-4 text-[#FF3B30] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-[#636366] block text-[10px] uppercase">Destination Address</span>
                        <span className="font-extrabold text-[#1C1C1E] text-sm">{b.dropoff_address || 'Destination Location Address'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => handleDeclineRide(b.id)}
                      className="py-3 bg-[#F8F9FA] hover:bg-[#E5E5EA] text-[#FF3B30] font-extrabold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Decline Request
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAcceptRide(b.id)}
                      className="py-3 bg-[#FFC000] hover:bg-[#e6ad00] text-black font-extrabold text-xs rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Accept Ride (₹{b.total_fare || b.fare || '350'})</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-[#E5E5EA] rounded-3xl p-8 text-center space-y-2 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF9E6] text-[#FFC000] flex items-center justify-center mx-auto border border-[#FFC000]/40">
                <Car className="w-6 h-6 text-black" />
              </div>
              <h3 className="font-extrabold text-sm text-[#1C1C1E]">No Active Ride Requests</h3>
              <p className="text-xs text-[#636366] max-w-sm mx-auto">
                You are Online! Real passenger ride requests from Django backend will appear here live when requested.
              </p>
            </div>
          )
        )}

        {/* Recent Completed Trips Table */}
        <div className="bg-white border border-[#E5E5EA] rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-extrabold text-[#1C1C1E]">Recent Completed Rides</h3>
              <p className="text-[11px] text-[#8E8E93] font-medium">Showing last {Math.min(10, completedBookings.length)} completed trips</p>
            </div>
            <span className="text-xs bg-[#F2F2F7] text-[#1C1C1E] font-bold px-2.5 py-1 rounded-full border border-[#E5E5EA]">
              {completedBookings.length} Total
            </span>
          </div>

          {completedBookings.length > 0 ? (
            <div className="divide-y divide-[#E5E5EA]">
              {completedBookings.slice(0, 10).map((trip) => {
                const customerName = trip.customer_details?.name || trip.customer_name || 'Passenger';
                const fareAmount = trip.total_fare || trip.fare || 0;
                const distanceKm = trip.distance_km ? `${trip.distance_km} km` : 'Standard trip';
                const bookingRef = trip.booking_number ? `#${trip.booking_number}` : '';
                const timeFormatted = trip.updated_at ? new Date(trip.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

                return (
                  <div key={trip.id} className="py-3.5 flex items-center justify-between first:pt-0 last:pb-0 hover:bg-[#F9F9FB] rounded-xl px-2 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-[#E8F8F0] text-[#34C759] font-bold flex items-center justify-center text-xs border border-[#34C759]/30 shrink-0">
                        <CheckCircle className="w-5 h-5 text-[#34C759]" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-extrabold text-xs text-[#1C1C1E] truncate">{customerName}</h4>
                          {bookingRef && <span className="text-[10px] bg-[#F2F2F7] text-[#636366] px-1.5 py-0.5 rounded font-mono">{bookingRef}</span>}
                        </div>
                        <p className="text-[11px] text-[#636366] truncate max-w-[200px] sm:max-w-[280px]">
                          {trip.pickup_address ? `${trip.pickup_address.split(',')[0]} → ${trip.dropoff_address ? trip.dropoff_address.split(',')[0] : 'Dropoff'}` : distanceKm}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-[#8E8E93] mt-0.5">
                          <span>{distanceKm}</span>
                          {timeFormatted && <span>• {timeFormatted}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0 pl-2">
                      <span className="font-extrabold text-sm text-[#1C1C1E]">₹{Number(fareAmount).toFixed(0)}</span>
                      <span className="text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded border border-amber-200 block mt-0.5">★ 5.0 Paid</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 space-y-2">
              <div className="w-10 h-10 rounded-xl bg-[#F8F9FA] text-[#636366] flex items-center justify-center mx-auto border border-[#E5E5EA]">
                <CheckCircle className="w-5 h-5" />
              </div>
              <p className="text-xs font-bold text-[#636366]">No completed ride history in database yet</p>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 border-t border-[#E5E5EA] text-[11px] text-[#636366] bg-white mt-auto">
        &copy; {new Date().getFullYear()} RaahGo Driver Partner Network. All rights reserved.
      </footer>

      {/* Mobile Accessibility Style Floating Duty Icon Button (Live Drag & Edge Snap) */}
      <div
        style={
          floatingPos.currX !== null && floatingPos.currY !== null
            ? { left: `${floatingPos.currX}px`, top: `${floatingPos.currY}px` }
            : { top: `${floatingPos.topY}px` }
        }
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        className={`fixed ${
          floatingPos.currX !== null
            ? ''
            : floatingPos.side === 'right'
            ? 'right-0'
            : 'left-0'
        } z-50 transition-all duration-75 select-none touch-none shadow-2xl`}
      >
        <button
          type="button"
          onClick={() => {
            if (!isDragging) handleToggleOnline();
          }}
          className={`p-3.5 ${
            floatingPos.currX !== null
              ? 'rounded-full border shadow-2xl scale-110'
              : floatingPos.side === 'right'
              ? 'rounded-l-full border-l border-y'
              : 'rounded-r-full border-r border-y'
          } border-white/40 text-white shadow-2xl backdrop-blur-md cursor-grab active:cursor-grabbing transition-transform duration-150 active:scale-95 flex items-center justify-center ${
            isOnline
              ? 'bg-[#34C759] text-white shadow-emerald-500/60 ring-4 ring-emerald-500/30 hover:bg-[#2fb350]'
              : 'bg-[#FF3B30] text-white shadow-red-500/60 ring-4 ring-red-500/30 hover:bg-[#e03126]'
          }`}
          title={isOnline ? 'ONLINE - Tap to go Offline (Hold & drag to move)' : 'OFFLINE - Tap to go Online (Hold & drag to move)'}
        >
          <Power className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
        </button>
      </div>
    </div>
  );
}
