import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Navigation, Car, ShieldCheck, Clock, Search, ArrowRight, Star,
  CreditCard, Tag, CheckCircle2, ChevronRight, LogOut, User, RefreshCw, Zap,
  LocateFixed, Loader2, KeyRound, Lock, Unlock
} from 'lucide-react';
import { fetchLocationSuggestions, getDeviceGpsLocation } from '../common/locationService';
import RealtimeMap from './RealtimeMap';

// Import vehicle fare rates dynamically from .env
const VEHICLE_RATES = {
  bike: {
    rate: Number(import.meta.env.VITE_BIKE_RATE_PER_KM) || 10,
    minFare: Number(import.meta.env.VITE_BIKE_MIN_FARE) || 25
  },
  auto: {
    rate: Number(import.meta.env.VITE_AUTO_RATE_PER_KM) || 12,
    minFare: Number(import.meta.env.VITE_AUTO_MIN_FARE) || 40
  },
  sedan: {
    rate: Number(import.meta.env.VITE_TAXI_RATE_PER_KM) || 20,
    minFare: Number(import.meta.env.VITE_TAXI_MIN_FARE) || 80
  },
  suv: {
    rate: Number(import.meta.env.VITE_CAR_RATE_PER_KM) || 40,
    minFare: Number(import.meta.env.VITE_CAR_MIN_FARE) || 120
  }
};

export default function HomePage({ user, onLogout }) {
  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedRide, setSelectedRide] = useState('sedan');
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [activeBookingData, setActiveBookingData] = useState(null);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [rideNotification, setRideNotification] = useState(null);
  const [tripCompletedModal, setTripCompletedModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  
  const navigate = useNavigate();
  const location = useLocation();

  // Mobile Dashboard & Navigation States
  const [activeTab, setActiveTab] = useState('home');
  const [isBookingFlowActive, setIsBookingFlowActive] = useState(location.pathname === '/book-ride');
  const [rideHistory, setRideHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Sync state with URL route on navigation/mount
  useEffect(() => {
    const isBookPath = location.pathname === '/book-ride';
    if (isBookingFlowActive !== isBookPath) {
      setIsBookingFlowActive(isBookPath);
    }
  }, [location.pathname]);

  // Sync URL route with isBookingFlowActive state changes
  useEffect(() => {
    if (isBookingFlowActive) {
      if (location.pathname !== '/book-ride') {
        navigate('/book-ride');
      }
    } else {
      if (location.pathname !== '/home') {
        navigate('/home');
      }
    }
  }, [isBookingFlowActive, navigate, location.pathname]);

  // Animated Progress bar when searching for Captain
  useEffect(() => {
    let timer = null;
    if (isSearchingDriver) {
      setSearchProgress(8);
      timer = setInterval(() => {
        setSearchProgress((prev) => (prev >= 96 ? 12 : prev + 4));
      }, 400);
    } else {
      setSearchProgress(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSearchingDriver]);

  // Auto-dismiss floating ride notifications after 5 seconds
  useEffect(() => {
    let notifTimer = null;
    if (rideNotification) {
      notifTimer = setTimeout(() => {
        setRideNotification(null);
      }, 5000); // Dismiss notification after 5 seconds
    }
    return () => {
      if (notifTimer) clearTimeout(notifTimer);
    };
  }, [rideNotification]);

  // Customer Ride Verification PIN (derived from user profile or assigned)
  const userPin = user?.ride_pin || user?.user?.ride_pin || '4829';

  // Captain PIN Verification simulation state
  const [showCaptainModal, setShowCaptainModal] = useState(false);
  const [captainEnteredPin, setCaptainEnteredPin] = useState(['', '', '', '']);
  const [pinAuthStatus, setPinAuthStatus] = useState(null); // 'success' | 'error'

  // Map & Coordinates State
  const [pickupCoords, setPickupCoords] = useState({ lat: 28.6139, lng: 77.2090 });
  const [destCoords, setDestCoords] = useState(null);
  const [calculatedRouteInfo, setCalculatedRouteInfo] = useState(null);

  // GPS Location state
  const [isLocating, setIsLocating] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');
  const [gpsVerified, setGpsVerified] = useState(false);

  // Autocomplete Suggestions State
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);

  const pickupContainerRef = useRef(null);
  const destContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);

  // Calculate dynamic fare based on backend rates and formulas
  const calculateFare = (rideId, distKm) => {
    const vt = backendVehicleTypes.find(t => t.name.toLowerCase() === rideId.toLowerCase());
    if (vt) {
      const base = Number(vt.base_fare) || 0;
      const perKm = Number(vt.per_km_rate) || 0;
      const perMin = Number(vt.per_minute_rate) || 0;
      const duration = calculatedRouteInfo?.rideType === rideId.toLowerCase()
        ? calculatedRouteInfo.durationMins
        : Math.max(3, Math.round(distKm * 2.0));
      
      const baseFare = base + (distKm * perKm) + (duration * perMin);
      const tax = baseFare * 0.05;
      const total = baseFare + tax;
      return Math.round(total);
    }

    const cfg = VEHICLE_RATES[rideId] || { rate: 15, minFare: 50 };
    if (!distKm || distKm <= 0) return cfg.minFare;
    const rawFare = distKm * cfg.rate;
    return Math.max(cfg.minFare, Math.round(rawFare));
  };

  // Compute active trip distance for pricing
  const currentDist = calculatedRouteInfo?.distanceKm
    ? parseFloat(calculatedRouteInfo.distanceKm)
    : (destCoords && pickupCoords
      ? (() => {
        const R = 6371;
        const dLat = (destCoords.lat - pickupCoords.lat) * (Math.PI / 180);
        const dLon = (destCoords.lng - pickupCoords.lng) * (Math.PI / 180);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(pickupCoords.lat * (Math.PI / 180)) *
          Math.cos(destCoords.lat * (Math.PI / 180)) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return parseFloat((R * c).toFixed(1));
      })()
      : 5);

  const [backendVehicleTypes, setBackendVehicleTypes] = useState([]);

  // Fetch Vehicle Types dynamically from Django REST API
  useEffect(() => {
    const fetchVehicleTypes = async () => {
      try {
        const res = await fetch('/api/v1/vehicles/types/');
        if (res.ok) {
          const data = await res.json();
          const typesList = Array.isArray(data) ? data : (data.results || []);
          if (typesList.length > 0) {
            setBackendVehicleTypes(typesList);
          }
        }
      } catch (err) {
        console.log('Vehicle types API fetch notice:', err);
      }
    };
    fetchVehicleTypes();
  }, []);

  const getIconForType = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('bike') || n.includes('moto')) return '🏍️';
    if (n.includes('auto') || n.includes('rickshaw')) return '🛺';
    if (n.includes('suv') || n.includes('xl')) return '🚙';
    return '🚗';
  };

  const rideTypes = backendVehicleTypes.length > 0
    ? backendVehicleTypes.map((vt) => {
      const typeKey = vt.name.toLowerCase();
      const fare = calculateFare(typeKey, currentDist);
      return {
        id: typeKey,
        name: vt.name.toLowerCase().includes('raahgo') ? vt.name : `RaahGo ${vt.name}`,
        price: `₹ ${fare}`,
        eta: `${calculatedRouteInfo?.rideType === typeKey ? calculatedRouteInfo.durationMins : Math.max(3, Math.round(currentDist * 2.0))} mins`,
        desc: vt.description || `${vt.capacity_passengers || 4}-seater city transit`,
        icon: getIconForType(vt.name),
        capacity: `${vt.capacity_passengers || 4} seat${(vt.capacity_passengers || 4) > 1 ? 's' : ''}`
      };
    })
    : [
      { id: 'bike', name: 'RaahGo Bike', price: `₹ ${calculateFare('bike', currentDist)}`, eta: `${Math.max(2, Math.round(currentDist * 1.8))} mins`, desc: 'Fast solo bike taxi', icon: '🏍️', capacity: '1 seat' },
      { id: 'auto', name: 'RaahGo Auto', price: `₹ ${calculateFare('auto', currentDist)}`, eta: `${Math.max(3, Math.round(currentDist * 2.4))} mins`, desc: 'Affordable 3-wheeler auto', icon: '🛺', capacity: '3 seats' },
      { id: 'sedan', name: 'Prime Taxi', price: `₹ ${calculateFare('sedan', currentDist)}`, eta: `${Math.max(4, Math.round(currentDist * 2.0))} mins`, desc: 'Comfortable air-conditioned sedan', icon: '🚗', capacity: '4 seats', popular: true },
      { id: 'suv', name: 'XL SUV Car', price: `₹ ${calculateFare('suv', currentDist)}`, eta: `${Math.max(5, Math.round(currentDist * 2.2))} mins`, desc: 'Spacious 6-seater SUV', icon: '🚙', capacity: '6 seats' }
    ];

  // Auto-detect GPS Location and restore active booking state on mount
  useEffect(() => {
    handleDetectGpsLocation();

    const restoreActiveBookingOnMount = async () => {
      try {
        const res = await fetch('/api/v1/bookings/bookings/');
        if (res.ok) {
          const bData = await res.json();
          const bList = Array.isArray(bData) ? bData : (bData.results || []);
          const active = bList.find(b => b.status !== 'Completed' && b.status !== 'Cancelled');
          if (active) {
            setActiveBookingData(active);
            setIsBookingFlowActive(true);
            if (active.status === 'Searching') {
              setIsSearchingDriver(true);
              setBookingSuccess(false);
            } else if (active.status === 'Accepted' || active.status === 'In Trip') {
              setIsSearchingDriver(false);
              setBookingSuccess(true);
            }
          }
        }
      } catch (err) {
        console.log('Restore active booking notice:', err);
      }
    };

    restoreActiveBookingOnMount();
  }, []);

  // Poll for Captain status updates (Accepted, Cancelled, Completed)
  useEffect(() => {
    let interval = null;
    const bookingId = activeBookingData?.id;

    if (bookingId && activeBookingData?.status !== 'Completed' && activeBookingData?.status !== 'Cancelled') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/v1/bookings/bookings/${bookingId}/`);
          if (res.ok) {
            const data = await res.json();
            setActiveBookingData(data);

            if (data.status !== 'Searching') {
              setIsSearchingDriver(false);
            }

            if (data.status === 'Accepted' && activeBookingData?.status === 'Searching') {
              setIsSearchingDriver(false);
              setBookingSuccess(true);
              setRideNotification({
                type: 'accepted',
                title: 'Captain Accepted Your Ride! 🎉',
                message: `Captain ${data.driver_details?.captain_name || 'Partner'} accepted your ride request. Driver is en route!`
              });
            } else if (data.status === 'Cancelled' && activeBookingData?.status !== 'Cancelled') {
              setIsSearchingDriver(false);
              setBookingSuccess(false);
              setRideNotification({
                type: 'declined',
                title: 'Sorry No Captain Available',
                message: 'We could not find a captain nearby for your ride. Please try again or choose a different pickup location.'
              });
            } else if (data.status === 'Completed') {
              setIsSearchingDriver(false);
              setBookingSuccess(false);
              setTripCompletedModal(true);
              setRideNotification({
                type: 'accepted',
                title: 'Trip Completed! 🏁',
                message: 'Your trip has ended. Thank you for riding with RaahGo!'
              });
            }
          }
        } catch (err) {
          console.log('Poll booking notice:', err);
        }
      }, 2000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeBookingData?.id, activeBookingData?.status, isSearchingDriver]);

  // Close suggestion dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickupContainerRef.current && !pickupContainerRef.current.contains(e.target)) {
        setShowPickupDropdown(false);
      }
      if (destContainerRef.current && !destContainerRef.current.contains(e.target)) {
        setShowDestDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Detect Device GPS Location via locationService
  const handleDetectGpsLocation = async () => {
    setIsLocating(true);
    setLocationStatus('Accessing device GPS location...');

    try {
      const loc = await getDeviceGpsLocation();
      setPickup(loc.address);
      setPickupCoords({ lat: loc.lat, lng: loc.lon });
      setGpsVerified(true);
      setLocationStatus(loc.displayStatus);
    } catch (err) {
      setPickup('Connaught Place, New Delhi');
      setPickupCoords({ lat: 28.6139, lng: 77.2090 });
      setLocationStatus('GPS permission denied or weak. Using default location.');
    } finally {
      setIsLocating(false);
    }
  };

  // Live Location Autocomplete via OpenStreetMap + Komoot Photon API
  const handlePickupChange = (e) => {
    const val = e.target.value;
    setPickup(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length < 1) {
      setPickupSuggestions([]);
      setShowPickupDropdown(false);
      return;
    }

    setIsSearchingPickup(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const userCoords = pickupCoords ? { lat: pickupCoords.lat, lon: pickupCoords.lng } : null;
      const results = await fetchLocationSuggestions(val, userCoords);
      setPickupSuggestions(results);
      setShowPickupDropdown(results.length > 0);
      setIsSearchingPickup(false);
    }, 200);
  };

  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestination(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length < 1) {
      setDestSuggestions([]);
      setShowDestDropdown(false);
      return;
    }

    setIsSearchingDest(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const userCoords = pickupCoords ? { lat: pickupCoords.lat, lon: pickupCoords.lng } : null;
      const results = await fetchLocationSuggestions(val, userCoords);
      setDestSuggestions(results);
      setShowDestDropdown(results.length > 0);
      setIsSearchingDest(false);
    }, 250);
  };

  const selectPickupSuggestion = (loc) => {
    setPickup(`${loc.title}, ${loc.subtitle}`);
    if (loc.coordinates) {
      setPickupCoords({ lat: parseFloat(loc.coordinates[1]), lng: parseFloat(loc.coordinates[0]) });
    }
    setShowPickupDropdown(false);
  };

  const selectDestSuggestion = (loc) => {
    setDestination(`${loc.title}, ${loc.subtitle}`);
    if (loc.coordinates) {
      setDestCoords({ lat: parseFloat(loc.coordinates[1]), lng: parseFloat(loc.coordinates[0]) });
    }
    setShowDestDropdown(false);
  };

  const handleBookRide = async (e) => {
    e.preventDefault();

    if (activeBookingData && activeBookingData.status !== 'Completed' && activeBookingData.status !== 'Cancelled') {
      alert(`Active Ride In Progress! You cannot request another ride while your current trip is ${activeBookingData.status}.`);
      return;
    }

    if (!destination.trim()) {
      alert('Please enter your destination location');
      return;
    }

    setIsBooking(true);
    setBookingSuccess(false);
    setIsSearchingDriver(false);
    const fareNum = calculateFare(selectedRide, currentDist);

    const pLat = pickupCoords ? parseFloat(Number(pickupCoords.lat).toFixed(6)) : 28.613900;
    const pLng = pickupCoords ? parseFloat(Number(pickupCoords.lng).toFixed(6)) : 77.209000;
    const dLat = destCoords ? parseFloat(Number(destCoords.lat).toFixed(6)) : 28.535500;
    const dLng = destCoords ? parseFloat(Number(destCoords.lng).toFixed(6)) : 77.391000;
    const distClean = currentDist ? parseFloat(Number(currentDist).toFixed(2)) : 5.00;

    const payload = {
      selected_ride: selectedRide,
      pickup_address: pickup || 'Current Location',
      dropoff_address: destination,
      pickup_latitude: pLat,
      pickup_longitude: pLng,
      dropoff_latitude: dLat,
      dropoff_longitude: dLng,
      distance_km: distClean,
      estimated_duration_mins: Math.round(calculatedRouteInfo?.durationMins || (distClean * 2)),
      base_fare: fareNum,
      total_fare: fareNum,
      status: 'Searching'
    };

    try {
      const res = await fetch('/api/v1/bookings/bookings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setActiveBookingData(data);
        setIsSearchingDriver(true);
      }
    } catch (err) {
      console.log('Book ride API notice:', err);
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelBooking = async () => {
    if (activeBookingData?.id) {
      try {
        await fetch(`/api/v1/bookings/bookings/${activeBookingData.id}/cancel/`, { method: 'POST' });
      } catch (err) {
        console.log(err);
      }
    }
    setIsSearchingDriver(false);
    setBookingSuccess(false);
    setActiveBookingData(null);
  };

  const fetchRideHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/v1/bookings/bookings/');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.results || []);
        setRideHistory(list);
      }
    } catch (err) {
      console.log('Error fetching history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#1C1C1E] flex justify-center font-sans relative overflow-x-hidden p-0 sm:p-4">
      {/* Centered Mobile Device Mockup Container */}
      <div className="w-full max-w-md bg-[#F8F9FA] min-h-screen sm:min-h-[850px] sm:max-h-[900px] sm:my-auto sm:rounded-[40px] sm:border-[8px] sm:border-[#2C2C2E] shadow-2xl flex flex-col relative overflow-y-auto overflow-x-hidden scrollbar-none pb-20">
        
        {/* Floating Notification */}
        {rideNotification && (
          <div className={`absolute top-4 left-4 right-4 z-[9999] p-3 rounded-2xl shadow-xl border transition-all transform animate-bounce-short bg-white ${
            rideNotification.type === 'accepted' ? 'border-[#34C759] text-black' : 'border-[#FF3B30] text-black'
          }`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${rideNotification.type === 'accepted' ? 'bg-[#34C759]' : 'bg-[#FF3B30]'}`} />
                <span className="text-xs font-black">{rideNotification.title}</span>
              </div>
              <button onClick={() => setRideNotification(null)} className="text-xs font-bold text-gray-400 bg-transparent border-none">✕</button>
            </div>
            <p className="text-[10px] text-gray-500 font-semibold mt-1">{rideNotification.message}</p>
          </div>
        )}

        {/* Searching for Driver Loader */}
        {isSearchingDriver && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md z-[80] flex items-center justify-center p-5">
            <div className="bg-white rounded-3xl p-6 w-full max-w-xs shadow-2xl space-y-5 border border-[#FFC000]/60 relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#FFC000]"></div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFF9E6] flex items-center justify-center relative shrink-0">
                  <span className="w-full h-full absolute rounded-xl bg-[#FFC000]/30 animate-ping"></span>
                  <Loader2 className="w-6 h-6 text-[#8A6500] animate-spin relative z-10" />
                </div>
                <div>
                  <span className="text-[9px] font-black text-[#8A6500] uppercase block">SAVED IN DB: SEARCHING</span>
                  <h3 className="text-sm font-black text-[#1C1C1E]">Finding Captain...</h3>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold">
                  <span className="text-gray-500">Connecting...</span>
                  <span>{searchProgress}%</span>
                </div>
                <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                  <div className="h-full bg-[#FFC000] rounded-full transition-all duration-300" style={{ width: `${searchProgress}%` }}></div>
                </div>
              </div>

              {/* Booking Locations */}
              <div className="space-y-2 bg-[#F8F9FA] p-3 rounded-xl border border-[#E5E5EA] text-[10px]">
                <div className="flex gap-2">
                  <span className="text-[#34C759]">🟢</span>
                  <p className="font-bold text-gray-700 truncate">{pickup}</p>
                </div>
                <div className="flex gap-2 border-t border-gray-200/50 pt-2">
                  <span className="text-[#FF3B30]">🔴</span>
                  <p className="font-bold text-gray-700 truncate">{destination}</p>
                </div>
              </div>

              <button
                onClick={handleCancelBooking}
                className="w-full py-3 bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] font-black text-xs rounded-xl border border-[#FF3B30]/20 transition-all cursor-pointer shadow-none"
              >
                Cancel Request
              </button>
            </div>
          </div>
        )}

        {/* Home, Activity, Profile Views */}
        {!isBookingFlowActive && (
          <div className="flex-1 flex flex-col">
            {activeTab === 'home' && (
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-6 pb-4">
                  <div>
                    <span className="text-xs text-[#8E8E93] font-bold">Hi, {user?.name || 'axcsdc'} 👋</span>
                    <h2 className="text-2xl font-black text-[#1C1C1E] tracking-tight">Where to today?</h2>
                  </div>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="w-10 h-10 rounded-full bg-[#FFC000] text-black font-extrabold flex items-center justify-center shadow-md cursor-pointer border-none"
                  >
                    <User className="w-5 h-5 text-black" />
                  </button>
                </div>

                {/* Search Bar */}
                <div className="px-5 mb-5">
                  <div
                    onClick={() => setIsBookingFlowActive(true)}
                    className="flex items-center gap-3 bg-[#F2F2F7] border border-[#E5E5EA] px-4 py-3.5 rounded-2xl cursor-pointer hover:border-[#C7C7CC] transition-all"
                  >
                    <Search className="w-5 h-5 text-[#8E8E93]" />
                    <span className="text-[#8E8E93] font-bold text-sm">Enter destination</span>
                  </div>
                </div>

                {/* Map Preview card */}
                <div className="px-5 mb-6">
                  <div
                    onClick={() => setIsBookingFlowActive(true)}
                    className="relative h-32 rounded-3xl overflow-hidden border border-[#E5E5EA] shadow-xs bg-[#E5E5EA] cursor-pointer"
                  >
                    <div className="absolute inset-0 opacity-40 bg-cover bg-center" style={{ backgroundImage: "url('https://maps.wikimedia.org/osm-intl/12/28.6139/77.2090.png')" }}></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-full bg-[#FFC000] text-black flex items-center justify-center animate-bounce shadow-md">
                          <MapPin className="w-4 h-4 text-black" />
                        </div>
                        <span className="text-xs font-black text-white drop-shadow-md">Discover rides near you</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Services Section */}
                <div className="px-5 mb-6">
                  <h3 className="text-base font-black text-[#1C1C1E] mb-3">Services</h3>
                  <div className="space-y-3">
                    {/* Book Ride */}
                    <div
                      onClick={() => setIsBookingFlowActive(true)}
                      className="bg-[#FFF9E6] border border-[#FFC000]/40 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-[#FFC000] transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#FFC000]/20 flex items-center justify-center shrink-0">
                          <Car className="w-6 h-6 text-[#8A6500]" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#1C1C1E]">Book Ride</h4>
                          <p className="text-[11px] text-[#8A6500] font-semibold mt-0.5">Bike, Auto, Car, Taxi, E-Rickshaw</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#8A6500]" />
                    </div>

                    {/* Porter */}
                    <div
                      onClick={() => alert('Porter delivery is coming soon!')}
                      className="bg-[#E8F8EE] border border-[#34C759]/20 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-[#34C759]/40 transition-all opacity-95"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#34C759]/15 flex items-center justify-center shrink-0">
                          <Navigation className="w-6 h-6 text-[#248A3D]" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#1C1C1E]">Porter</h4>
                          <p className="text-[11px] text-[#248A3D] font-semibold mt-0.5">Move goods, mini-truck</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#248A3D]" />
                    </div>

                    {/* Parcel */}
                    <div
                      onClick={() => alert('Parcel dispatch is coming soon!')}
                      className="bg-[#E8F2FF] border border-[#007AFF]/20 rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:border-[#007AFF]/40 transition-all opacity-95"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-[#007AFF]/10 flex items-center justify-center shrink-0">
                          <ShieldCheck className="w-6 h-6 text-[#0056b3]" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-sm text-[#1C1C1E]">Parcel</h4>
                          <p className="text-[11px] text-[#0056b3] font-semibold mt-0.5">Send packages across city</p>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-[#007AFF]" />
                    </div>
                  </div>
                </div>

                {/* Quick book */}
                <div className="px-5 mb-6">
                  <h3 className="text-base font-black text-[#1C1C1E] mb-3">Quick book</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedRide('bike');
                        setIsBookingFlowActive(true);
                      }}
                      className="flex-1 py-2.5 px-4 bg-white border border-[#E5E5EA] rounded-full text-xs font-extrabold text-[#1C1C1E] hover:border-[#C7C7CC] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>🏍️</span> Bike
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRide('auto');
                        setIsBookingFlowActive(true);
                      }}
                      className="flex-1 py-2.5 px-4 bg-white border border-[#E5E5EA] rounded-full text-xs font-extrabold text-[#1C1C1E] hover:border-[#C7C7CC] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>🛺</span> Auto
                    </button>
                    <button
                      onClick={() => {
                        setSelectedRide('sedan');
                        setIsBookingFlowActive(true);
                      }}
                      className="flex-1 py-2.5 px-4 bg-white border border-[#E5E5EA] rounded-full text-xs font-extrabold text-[#1C1C1E] hover:border-[#C7C7CC] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <span>🚗</span> Car
                    </button>
                  </div>
                </div>

                {/* Promo card */}
                <div className="px-5 mb-10">
                  <div className="bg-[#FFC000] rounded-2xl p-4 flex items-center justify-between text-black shadow-md shadow-[#FFC000]/25 relative overflow-hidden">
                    <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-20 h-20 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
                    <div className="space-y-1 z-10">
                      <h4 className="text-base font-black">50% OFF first ride</h4>
                      <p className="text-xs font-bold text-black/80">Use code: <span className="bg-white/40 px-2 py-0.5 rounded border border-black/10">WELCOME50</span></p>
                    </div>
                    <Tag className="w-8 h-8 text-black/80 shrink-0" />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'activity' && (
              <div className="p-5 space-y-4">
                <h3 className="text-xl font-black text-[#1C1C1E]">My Activity</h3>
                {isLoadingHistory ? (
                  <div className="flex flex-col items-center justify-center py-10 space-y-2">
                    <Loader2 className="w-8 h-8 text-[#FFC000] animate-spin" />
                    <span className="text-xs text-[#8E8E93] font-bold">Loading rides...</span>
                  </div>
                ) : rideHistory.length === 0 ? (
                  <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-[#E5E5EA]">
                    <Clock className="w-10 h-10 text-[#C7C7CC] mx-auto mb-2" />
                    <p className="text-sm font-extrabold text-[#636366]">No rides found</p>
                    <p className="text-xs text-[#8E8E93] mt-1">Book your first ride on the Home tab!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {rideHistory.map((ride) => (
                      <div key={ride.id} className="bg-white border border-[#E5E5EA] rounded-2xl p-4 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-black text-white bg-[#1C1C1E] px-2 py-0.5 rounded">
                            {ride.booking_number || 'Ride'}
                          </span>
                          <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${
                            ride.status === 'Completed' ? 'bg-[#34C759]/10 text-[#34C759]' :
                            ride.status === 'Cancelled' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
                            'bg-[#FFC000]/10 text-[#FF9F0A]'
                          }`}>
                            {ride.status}
                          </span>
                        </div>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-start gap-2">
                            <span className="text-[#34C759]">🟢</span>
                            <p className="font-bold text-[#1C1C1E] truncate">{ride.pickup_address}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-[#FF3B30]">🔴</span>
                            <p className="font-bold text-[#636366] truncate">{ride.dropoff_address}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between border-t border-[#E5E5EA] pt-2 text-xs">
                          <span className="text-[#8E8E93] font-bold">
                            {new Date(ride.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <span className="font-black text-[#1C1C1E]">₹{ride.total_fare}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="p-5 space-y-6">
                <div className="text-center space-y-3 py-6 bg-white rounded-3xl border border-[#E5E5EA] shadow-2xs">
                  <div className="w-16 h-16 rounded-full bg-[#FFC000] text-black font-black text-2xl flex items-center justify-center mx-auto shadow-md">
                    {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-[#1C1C1E]">{user?.name || 'Customer Rider'}</h3>
                    <p className="text-xs text-[#8E8E93] font-bold">{user?.email || 'rider@raahgo.com'}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-[#FFF9E6] border border-[#FFC000]/40 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold text-[#8A6500] uppercase tracking-wider block">Security Verification PIN</span>
                      <span className="text-[11px] text-[#8E8E93] font-semibold mt-0.5">Use this PIN to verify yourself to the Captain</span>
                    </div>
                    <span className="text-lg font-black text-black bg-white px-3 py-1 rounded-xl border border-[#FFC000] shadow-sm">
                      {userPin}
                    </span>
                  </div>

                  <button
                    onClick={onLogout}
                    className="w-full py-4 bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] font-extrabold text-sm rounded-2xl border border-[#FF3B30]/30 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Log Out of RaahGo</span>
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Tab Bar */}
            <nav className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#E5E5EA] py-3 px-6 flex items-center justify-around z-40 shadow-lg">
              <button
                onClick={() => {
                  setActiveTab('home');
                  setIsBookingFlowActive(false);
                }}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none ${
                  activeTab === 'home' && !isBookingFlowActive ? 'text-[#FFC000] scale-105' : 'text-[#8E8E93]'
                }`}
              >
                <Car className="w-5 h-5" />
                <span className="text-[10px] font-bold">Home</span>
              </button>
              
              <button
                onClick={() => {
                  setActiveTab('activity');
                  setIsBookingFlowActive(false);
                }}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none ${
                  activeTab === 'activity' ? 'text-[#FFC000] scale-105' : 'text-[#8E8E93]'
                }`}
              >
                <Clock className="w-5 h-5" />
                <span className="text-[10px] font-bold">Activity</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('profile');
                  setIsBookingFlowActive(false);
                }}
                className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none ${
                  activeTab === 'profile' ? 'text-[#FFC000] scale-105' : 'text-[#8E8E93]'
                }`}
              >
                <User className="w-5 h-5" />
                <span className="text-[10px] font-bold">Profile</span>
              </button>
            </nav>
          </div>
        )}

        {/* Booking Planner Flow Panel */}
        {isBookingFlowActive && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E5E5EA] pb-3">
              <div className="flex items-center gap-2">
                {activeBookingData && activeBookingData.status !== 'Completed' && activeBookingData.status !== 'Cancelled' ? (
                  <div className="p-2 bg-[#FFF9E6] border border-[#FFC000]/40 rounded-full text-[#8A6500]">
                    <Lock className="w-4 h-4" />
                  </div>
                ) : (
                  <button
                    onClick={() => setIsBookingFlowActive(false)}
                    className="p-1.5 rounded-full hover:bg-gray-100 transition-all text-[#1C1C1E] cursor-pointer bg-transparent border-none"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                )}
                <h2 className="text-base font-extrabold text-[#1C1C1E]">
                  {activeBookingData && activeBookingData.status !== 'Completed' && activeBookingData.status !== 'Cancelled' ? 'Active Trip Progress' : 'Book a Ride'}
                </h2>
              </div>

              {activeBookingData && activeBookingData.status !== 'Completed' && activeBookingData.status !== 'Cancelled' && (
                <span className="text-[10px] uppercase font-black px-2 py-0.5 bg-[#FFC000]/15 text-[#FF9F0A] rounded-full">
                  Status: {activeBookingData.status}
                </span>
              )}
            </div>

            {/* Inputs (Only editable when no active booking) */}
            {(!activeBookingData || activeBookingData.status === 'Completed' || activeBookingData.status === 'Cancelled') && (
              <form onSubmit={handleBookRide} className="space-y-3">
                {/* Pickup Location */}
                <div className="relative" ref={pickupContainerRef}>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Pickup Point</label>
                    <button
                      type="button"
                      onClick={handleDetectGpsLocation}
                      disabled={isLocating}
                      className="text-[10px] font-bold text-[#007AFF] hover:underline flex items-center gap-0.5 bg-transparent border-none cursor-pointer"
                    >
                      {isLocating ? 'Locating...' : 'Use Current GPS'}
                    </button>
                  </div>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#34C759]" />
                    <input
                      type="text"
                      value={pickup}
                      onChange={handlePickupChange}
                      onFocus={() => pickupSuggestions.length > 0 && setShowPickupDropdown(true)}
                      placeholder="Search pickup point..."
                      className="w-full bg-[#F2F2F7] text-sm font-bold rounded-xl py-2.5 pl-10 pr-4 border border-[#E5E5EA] focus:border-[#FFC000] focus:ring-0 focus:outline-none"
                    />
                  </div>
                  {showPickupDropdown && pickupSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 bg-white border border-[#E5E5EA] mt-1 rounded-xl shadow-lg z-[90] max-h-40 overflow-y-auto text-left">
                      {pickupSuggestions.map((loc, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectPickupSuggestion(loc)}
                          className="px-3.5 py-2 hover:bg-[#F2F2F7] cursor-pointer text-xs font-semibold border-b border-gray-100/50"
                        >
                          <p className="text-[#1C1C1E] font-bold truncate">{loc.title}</p>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{loc.subtitle}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Destination Location */}
                <div className="relative" ref={destContainerRef}>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Dropoff Destination</label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#FF3B30]" />
                    <input
                      type="text"
                      value={destination}
                      onChange={handleDestChange}
                      onFocus={() => destSuggestions.length > 0 && setShowDestDropdown(true)}
                      placeholder="Search destination point..."
                      className="w-full bg-[#F2F2F7] text-sm font-bold rounded-xl py-2.5 pl-10 pr-4 border border-[#E5E5EA] focus:border-[#FFC000] focus:ring-0 focus:outline-none"
                    />
                  </div>
                  {showDestDropdown && destSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 bg-white border border-[#E5E5EA] mt-1 rounded-xl shadow-lg z-[90] max-h-40 overflow-y-auto text-left">
                      {destSuggestions.map((loc, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectDestSuggestion(loc)}
                          className="px-3.5 py-2 hover:bg-[#F2F2F7] cursor-pointer text-xs font-semibold border-b border-gray-100/50"
                        >
                          <p className="text-[#1C1C1E] font-bold truncate">{loc.title}</p>
                          <p className="text-[10px] text-gray-500 truncate mt-0.5">{loc.subtitle}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Select Vehicle Category */}
                <div className="pt-2">
                  <div className="flex justify-between mb-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase">Select Ride Category</label>
                    <span className="text-[9px] font-black text-[#8A6500] bg-[#FFF3D1] px-2 py-0.5 rounded border border-[#FFC000]/20">
                      Distance: {currentDist} km
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {rideTypes.map((ride) => (
                      <button
                        key={ride.id}
                        type="button"
                        onClick={() => setSelectedRide(ride.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all bg-white relative cursor-pointer ${
                          selectedRide === ride.id ? 'border-[#FFC000] bg-[#FFF9E6] ring-1 ring-[#FFC000]/30 shadow-xs' : 'border-[#E5E5EA] hover:border-[#C7C7CC]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xl">{ride.icon}</span>
                          <span className="text-xs font-black text-[#1C1C1E]">{ride.price}</span>
                        </div>
                        <h4 className="text-[10px] font-extrabold text-[#1C1C1E] truncate mt-1">{ride.name}</h4>
                        <p className="text-[9px] text-[#8E8E93] mt-0.5">{ride.eta}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isBooking}
                  className="w-full py-3 px-4 bg-gradient-to-r from-[#FFC000] to-[#FF9F0A] hover:from-[#e6ad00] hover:from-[#e68f00] text-black font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1 border-none"
                >
                  {isBooking ? 'Confirming Booking...' : `Confirm & Book (${rideTypes.find(r => r.id === selectedRide)?.price})`}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

            {/* Active Driver Details Banner */}
            {bookingSuccess && activeBookingData?.status === 'Accepted' && (
              <div className="bg-[#E8F8EE] border border-[#34C759]/40 p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#FFC000] text-black font-black flex items-center justify-center text-xs shadow-sm">
                      {activeBookingData?.driver_details?.captain_name ? activeBookingData.driver_details.captain_name.charAt(0) : 'S'}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-[#1C1C1E]">
                        Captain {activeBookingData?.driver_details?.captain_name || 'Sanjay Soni'}
                      </h4>
                      <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Vehicle: {activeBookingData?.driver_details?.vehicle_name || 'Dzire'} ({activeBookingData?.driver_details?.vehicle_number || 'DL 01 AB 1234'})</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setCaptainEnteredPin(['', '', '', '']);
                      setPinAuthStatus(null);
                      setShowCaptainModal(true);
                    }}
                    className="py-1.5 px-2 bg-[#007AFF] text-white font-extrabold text-[10px] rounded-lg cursor-pointer border-none"
                  >
                    Verify PIN
                  </button>
                </div>

                <div className="flex items-center justify-between border-t border-[#34C759]/20 pt-2 text-[11px] font-bold">
                  <span>Fare: <span className="font-black text-black">₹{activeBookingData.total_fare}</span></span>
                  <a href={`tel:${activeBookingData?.driver_details?.captain_phone || '9876543210'}`} className="text-[#34C759] no-underline">📞 Call Captain</a>
                </div>

                {/* Ride PIN block */}
                <div className="bg-white p-2.5 rounded-xl border border-[#34C759]/20 flex items-center justify-between">
                  <span className="text-[9px] font-black text-[#8E8E93] uppercase block">Ride PIN:</span>
                  <div className="flex gap-1">
                    {userPin.split('').map((digit, idx) => (
                      <span key={idx} className="w-5 text-center font-extrabold text-sm text-black font-mono bg-gray-50 border border-gray-200 rounded">{digit}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* In Trip / Started State */}
            {activeBookingData && activeBookingData.status === 'In Trip' && (
              <div className="bg-[#E8F2FF] border border-[#007AFF]/20 p-4 rounded-2xl text-center space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs font-black text-[#007AFF] uppercase">
                  <span>🚀 Trip In Progress</span>
                </div>
                <p className="text-[11px] text-gray-600 font-bold">
                  You are traveling with Captain {activeBookingData?.driver_details?.captain_name || 'Partner'}. Enjoy your ride!
                </p>
              </div>
            )}

            {/* Cancel Active Booking Button */}
            {activeBookingData && activeBookingData.status !== 'Completed' && activeBookingData.status !== 'Cancelled' && (
              <button
                onClick={handleCancelBooking}
                className="w-full py-3 bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] font-black text-xs rounded-xl border border-[#FF3B30]/20 transition-all cursor-pointer"
              >
                Cancel Current Ride
              </button>
            )}

            {/* Leaflet Routing Map */}
            <div className="flex-grow min-h-[300px] h-0 rounded-2xl overflow-hidden border border-[#E5E5EA] shadow-xs relative z-10">
              <RealtimeMap
                pickup={activeBookingData?.status === 'Accepted' ? `Captain ${activeBookingData?.driver_details?.captain_name || 'Partner'}` : pickup}
                destination={activeBookingData?.status === 'Accepted' ? (pickup || 'Passenger Pickup Point') : destination}
                pickupCoords={
                  activeBookingData?.status === 'Accepted'
                    ? (activeBookingData?.driver_details?.latitude && activeBookingData?.driver_details?.longitude
                        ? { lat: Number(activeBookingData.driver_details.latitude), lng: Number(activeBookingData.driver_details.longitude) }
                        : { lat: 28.4415, lng: 77.0395 })
                    : pickupCoords
                }
                destCoords={
                  activeBookingData?.status === 'Accepted'
                    ? pickupCoords
                    : destCoords
                }
                mode={activeBookingData?.status === 'Accepted' ? 'pickup' : (activeBookingData?.status === 'In Trip' ? 'in_trip' : 'booking')}
                selectedRide={selectedRide}
                onRouteCalculated={(info) => setCalculatedRouteInfo(info)}
              />
            </div>
          </div>
        )}

      </div>

      {/* Captain PIN Modal */}
      {showCaptainModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E5E5EA] rounded-3xl p-5 max-w-xs w-full shadow-2xl space-y-4 text-center">
            <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/10 text-[#007AFF] flex items-center justify-center mx-auto">
              <KeyRound className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-[#1C1C1E]">Captain PIN Verification</h3>
              <p className="text-[10px] text-gray-500 mt-1 font-semibold">
                Captain Rajesh asks for your 4-digit Ride PIN to authenticate & start the trip.
              </p>
            </div>
            <div className="flex justify-center gap-1.5 py-1">
              {captainEnteredPin.map((digit, idx) => (
                <input
                  key={idx}
                  id={`capt-pin-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    const newArr = [...captainEnteredPin];
                    newArr[idx] = val;
                    setCaptainEnteredPin(newArr);
                    setPinAuthStatus(null);
                    if (val && idx < 3) {
                      document.getElementById(`capt-pin-${idx + 1}`)?.focus();
                    }
                  }}
                  className="w-10 h-10 text-center text-lg font-extrabold bg-[#F8F9FA] border border-[#E5E5EA] rounded-lg focus:border-[#007AFF] focus:outline-none"
                />
              ))}
            </div>
            {pinAuthStatus === 'success' && <div className="text-[10px] text-[#34C759] font-black">PIN Verified! Enjoy your trip!</div>}
            {pinAuthStatus === 'error' && <div className="text-[10px] text-[#FF3B30] font-black">Incorrect PIN. Correct PIN: {userPin}</div>}
            <div className="flex gap-2">
              <button onClick={() => setShowCaptainModal(false)} className="flex-grow py-2 bg-gray-100 hover:bg-gray-200 text-xs font-bold rounded-lg border-none cursor-pointer">Close</button>
              <button onClick={handleVerifyCaptainPin} className="flex-grow py-2 bg-[#007AFF] text-white text-xs font-bold rounded-lg border-none cursor-pointer">Submit</button>
            </div>
          </div>
        </div>
      )}

      {/* Trip Completed Celebration Rating Modal */}
      {tripCompletedModal && (
        <div className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full shadow-2xl text-center space-y-4 border border-[#34C759]">
            <div className="w-12 h-12 rounded-full bg-[#34C759]/20 text-[#34C759] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-[#34C759]" />
            </div>
            <div>
              <span className="text-[9px] font-black uppercase text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-full">Arrived Safely</span>
              <h3 className="text-base font-black mt-2 text-black">Trip Completed!</h3>
            </div>
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-left space-y-1.5 text-[10px] font-semibold text-gray-600">
              <div className="flex justify-between">
                <span>Fare Paid:</span>
                <span className="font-extrabold text-black">₹{activeBookingData?.total_fare || '350'}</span>
              </div>
              <div className="flex justify-between">
                <span>Captain:</span>
                <span className="font-extrabold text-black">{activeBookingData?.driver_details?.captain_name || 'Captain Partner'}</span>
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-gray-500 mb-1.5">Rate Your Captain</label>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setSelectedRating(star)} className="p-0.5 bg-transparent border-none cursor-pointer">
                    <Star className={`w-6 h-6 ${star <= selectedRating ? 'fill-[#FFC000] text-[#FFC000]' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => {
                setTripCompletedModal(false);
                setBookingSuccess(false);
                setIsSearchingDriver(false);
                setActiveBookingData(null);
                setIsBookingFlowActive(false);
              }}
              className="w-full py-3 bg-[#FFC000] text-black font-extrabold text-xs rounded-xl shadow-md cursor-pointer border-none"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
