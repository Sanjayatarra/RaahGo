import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Navigation, Car, ShieldCheck, Clock, Search, ArrowRight, ArrowLeft, Star,
  CreditCard, Tag, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, LogOut, User, RefreshCw, Zap,
  LocateFixed, Loader2, KeyRound, Lock, Unlock, AlertCircle, X, Info
} from 'lucide-react';
import { fetchLocationSuggestions, getDeviceGpsLocation } from '../common/locationService';
import { fetchWithAuth } from '../common/apiClient';
import RealtimeMap from './RealtimeMap';
import Navbar from './Navbar';
import Footer from './Footer';
import CustomerProfileMenu from './CustomerProfileMenu';
// Vehicle fare rates dynamically from .env
const VEHICLE_RATES = {
  bike: {
    rate: Number(import.meta.env.VITE_BIKE_RATE_PER_KM) || 10,
    minFare: Number(import.meta.env.VITE_BIKE_MIN_FARE) || 25
  },
  auto: {
    rate: Number(import.meta.env.VITE_AUTO_RATE_PER_KM) || 15,
    minFare: Number(import.meta.env.VITE_AUTO_MIN_FARE) || 40
  },
  'e-rickshaw': {
    rate: Number(import.meta.env.VITE_AUTO_RATE_PER_KM) || 12,
    minFare: Number(import.meta.env.VITE_AUTO_MIN_FARE) || 30
  },
  cab: {
    rate: Number(import.meta.env.VITE_CAB_RATE_PER_KM) || 20,
    minFare: Number(import.meta.env.VITE_CAB_MIN_FARE) || 70
  },
  suv: {
    rate: Number(import.meta.env.VITE_SUV_RATE_PER_KM) || 25,
    minFare: Number(import.meta.env.VITE_SUV_MIN_FARE) || 100
  }
};

export default function BookRidePage({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Selected ride passed via state or default
  const initialRide = location.state?.selectedRide || 'bike';

  const [pickup, setPickup] = useState(location.state?.prefillPickup || '');
  const [destination, setDestination] = useState(location.state?.prefillDrop || '');
  const [pickupError, setPickupError] = useState('');
  const [destError, setDestError] = useState('');
  const [selectedRide, setSelectedRide] = useState(initialRide);
  const [showFares, setShowFares] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [activeBookingData, setActiveBookingData] = useState(null);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [showTripDetailsInSearch, setShowTripDetailsInSearch] = useState(false);
  const [rideNotification, setRideNotification] = useState(null);
  const [tripCompletedModal, setTripCompletedModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [activeRideRef] = useState(() => React.createRef());
  const [searchTimeLeft, setSearchTimeLeft] = useState(null); // seconds remaining before auto-cancel
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [pickupCoords, setPickupCoords] = useState(location.state?.pickupCoords || null);
  const [destCoords, setDestCoords] = useState(location.state?.dropCoords || null);
  const [calculatedRouteInfo, setCalculatedRouteInfo] = useState(null);
  const [notes, setNotes] = useState('');

  const [isLocating, setIsLocating] = useState(false);
  const [gpsVerified, setGpsVerified] = useState(false);
  const [locationStatus, setLocationStatus] = useState('');

  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDest, setIsSearchingDest] = useState(false);
  const [showPickupDropdown, setShowPickupDropdown] = useState(false);
  const [showDestDropdown, setShowDestDropdown] = useState(false);

  const pickupContainerRef = useRef(null);
  const destContainerRef = useRef(null);
  const searchTimeoutRef = useRef(null);
  const fareEstimatesRef = useRef(null);

  const [backendVehicleTypes, setBackendVehicleTypes] = useState([]);

  // Clear field errors as soon as input values are populated
  useEffect(() => {
    if (pickup && pickup.trim()) {
      setPickupError('');
    }
  }, [pickup]);

  useEffect(() => {
    if (destination && destination.trim()) {
      setDestError('');
    }
  }, [destination]);

  // Fetch Vehicle Types dynamically from Django REST API
  useEffect(() => {
    const fetchVehicleTypes = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/vehicles/types/');
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

  // Auto-detect GPS Location and restore active booking state on mount
  useEffect(() => {
    if (!location.state?.prefillPickup) {
      handleDetectGpsLocation();
    }

    const restoreActiveBookingOnMount = async () => {
      if (!user) return;
      try {
        // Use the dedicated /active endpoint which also auto-cancels stale rides
        const res = await fetchWithAuth('/api/v1/bookings/bookings/active/');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.auto_cancelled && data.id) {
            setActiveBookingData(data);
            if (data.status === 'Searching') {
              setIsSearchingDriver(true);
              setBookingSuccess(false);
              // Calculate remaining search time
              const created = new Date(data.created_at).getTime();
              const elapsed = Math.floor((Date.now() - created) / 1000);
              const remaining = Math.max(0, 15 * 60 - elapsed);
              setSearchTimeLeft(remaining);
            } else if (data.status === 'Accepted' || data.status === 'Arrived' || data.status === 'In Trip') {
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
  }, [user]);

  // Auto-geocode pickup address text to coordinates if pickupCoords is null
  useEffect(() => {
    if (pickup && pickup.trim().length > 2 && !pickupCoords) {
      const autoGeocodePickup = async () => {
        const results = await fetchLocationSuggestions(pickup);
        if (results && results.length > 0 && results[0].coordinates) {
          setPickupCoords({
            lat: parseFloat(results[0].coordinates[1]),
            lng: parseFloat(results[0].coordinates[0])
          });
        }
      };
      autoGeocodePickup();
    }
  }, [pickup, pickupCoords]);

  // Animated Progress bar when searching for Captain
  useEffect(() => {
    let timer = null;
    if (isSearchingDriver) {
      setSearchProgress(8);
      timer = setInterval(() => {
        setSearchProgress((prev) => (prev >= 92 ? 92 : prev + Math.floor(Math.random() * 8) + 4));
      }, 700);
    } else {
      setSearchProgress(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isSearchingDriver]);

  // Scroll fare estimates into view when revealed
  useEffect(() => {
    if (showFares && fareEstimatesRef.current) {
      setTimeout(() => {
        fareEstimatesRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [showFares]);

  // Restore and perform pending booking after user logs in
  useEffect(() => {
    const pendingDataStr = localStorage.getItem('pending_booking');
    if (pendingDataStr && user) {
      const pending = JSON.parse(pendingDataStr);
      localStorage.removeItem('pending_booking');

      setPickup(pending.pickup);
      setDestination(pending.destination);
      setPickupCoords(pending.pickupCoords);
      setDestCoords(pending.destCoords);
      setCalculatedRouteInfo(pending.calculatedRouteInfo);
      setSelectedRide(pending.selectedRide);

      const autoBook = async () => {
        setIsBooking(true);
        setBookingSuccess(false);
        setIsSearchingDriver(false);
        const fareNum = calculateFare(pending.selectedRide, pending.calculatedRouteInfo?.distanceKm || 5);

        const pLat = pending.pickupCoords ? parseFloat(Number(pending.pickupCoords.lat).toFixed(6)) : 28.613900;
        const pLng = pending.pickupCoords ? parseFloat(Number(pending.pickupCoords.lng).toFixed(6)) : 77.209000;
        const dLat = pending.destCoords ? parseFloat(Number(pending.destCoords.lat).toFixed(6)) : 28.535500;
        const dLng = pending.destCoords ? parseFloat(Number(pending.destCoords.lng).toFixed(6)) : 77.391000;
        const distClean = pending.calculatedRouteInfo?.distanceKm ? parseFloat(Number(pending.calculatedRouteInfo.distanceKm).toFixed(2)) : 5.00;

        const payload = {
          selected_ride: pending.selectedRide,
          pickup_address: pending.pickup || 'Current Location',
          dropoff_address: pending.destination,
          pickup_latitude: pLat,
          pickup_longitude: pLng,
          dropoff_latitude: dLat,
          dropoff_longitude: dLng,
          distance_km: distClean,
          estimated_duration_mins: Math.round(pending.calculatedRouteInfo?.durationMins || (distClean * 2)),
          base_fare: fareNum,
          total_fare: fareNum,
          notes_for_driver: pending.notes || '',
          status: 'Searching'
        };

        try {
          const res = await fetchWithAuth('/api/v1/bookings/bookings/', {
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

      autoBook();
    }
  }, [user]);

  // Poll for Captain status updates + 15-min auto-cancel countdown
  useEffect(() => {
    let interval = null;
    let countdownInterval = null;
    const bookingId = activeBookingData?.id;

    if (bookingId && activeBookingData?.status !== 'Completed' && activeBookingData?.status !== 'Cancelled') {
      // ── Booking status polling (every 2s) ──────────────────────────────
      interval = setInterval(async () => {
        try {
          const res = await fetchWithAuth(`/api/v1/bookings/bookings/${bookingId}/`);
          if (res.ok) {
            const data = await res.json();
            setActiveBookingData(data);

            if (data.status !== 'Searching') {
              setIsSearchingDriver(false);
              setSearchTimeLeft(null);
            }

            if (data.status === 'Accepted' && activeBookingData?.status === 'Searching') {
              setIsSearchingDriver(false);
              setBookingSuccess(true);
              setSearchTimeLeft(null);
              setRideNotification({
                type: 'accepted',
                title: 'Captain Accepted Your Ride! 🎉',
                message: `Captain ${data.driver_details?.captain_name || 'Partner'} accepted your ride request. Driver is en route!`
              });
            } else if (data.status === 'Cancelled' && activeBookingData?.status !== 'Cancelled') {
              setIsSearchingDriver(false);
              setBookingSuccess(false);
              setSearchTimeLeft(null);
              const isAutoCancelled = data.status === 'Cancelled' &&
                activeBookingData?.status === 'Searching';
              setRideNotification({
                type: 'declined',
                title: isAutoCancelled ? 'No Driver Found ⏱️' : 'Sorry No Captain Available',
                message: isAutoCancelled
                  ? 'Your ride was automatically cancelled after 15 minutes with no driver response. Please try again.'
                  : 'We could not find a captain nearby. Please try again or choose a different pickup.'
              });
              setActiveBookingData(null);
            } else if (data.status === 'Completed') {
              setIsSearchingDriver(false);
              setBookingSuccess(false);
              setSearchTimeLeft(null);
              setTripCompletedModal(true);
            }
          }
        } catch (err) {
          console.log('Poll booking notice:', err);
        }
      }, 2000);

      // ── 15-minute countdown timer (every 1s, only while Searching) ────
      if (activeBookingData?.status === 'Searching') {
        const created = new Date(activeBookingData.created_at).getTime();
        countdownInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - created) / 1000);
          const remaining = Math.max(0, 15 * 60 - elapsed);
          setSearchTimeLeft(remaining);

          if (remaining === 0) {
            // Time's up — cancel the ride via API
            clearInterval(countdownInterval);
            fetchWithAuth(`/api/v1/bookings/bookings/${bookingId}/cancel/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: 'Auto-cancelled: no driver found within 15 minutes.' })
            }).then(() => {
              setIsSearchingDriver(false);
              setBookingSuccess(false);
              setSearchTimeLeft(null);
              setActiveBookingData(null);
              setRideNotification({
                type: 'declined',
                title: 'No Driver Found ⏱️',
                message: 'Your ride was automatically cancelled after 15 minutes with no driver response. Please try again.'
              });
            }).catch(() => {});
          }
        }, 1000);
      }
    }

    return () => {
      if (interval) clearInterval(interval);
      if (countdownInterval) clearInterval(countdownInterval);
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
      setPickupError('');
      setGpsVerified(true);
      setLocationStatus(loc.displayStatus);
    } catch (err) {
      setGpsVerified(false);
      const errMsg = err.message || 'Unable to access GPS location. Please enable location permissions or search your pickup point.';
      setLocationStatus(errMsg);
    } finally {
      setIsLocating(false);
    }
  };

  // Live Location Autocomplete via OpenStreetMap API
  const handlePickupChange = (e) => {
    const val = e.target.value;
    setPickup(val);
    setPickupError('');

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length < 1) {
      setPickupSuggestions([]);
      setShowPickupDropdown(true);
      return;
    }

    setIsSearchingPickup(true);
    searchTimeoutRef.current = setTimeout(async () => {
      const userCoords = pickupCoords ? { lat: pickupCoords.lat, lon: pickupCoords.lng } : null;
      const results = await fetchLocationSuggestions(val, userCoords);
      setPickupSuggestions(results);
      setShowPickupDropdown(true);
      setIsSearchingPickup(false);
    }, 600);
  };

  const handleDestChange = (e) => {
    const val = e.target.value;
    setDestination(val);
    setDestError('');

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
    }, 600);
  };

  const selectPickupSuggestion = (loc) => {
    setPickup(`${loc.title}, ${loc.subtitle}`);
    setPickupError('');
    if (loc.coordinates) {
      setPickupCoords({ lat: parseFloat(loc.coordinates[1]), lng: parseFloat(loc.coordinates[0]) });
    }
    setShowPickupDropdown(false);
  };

  const selectDestSuggestion = (loc) => {
    setDestination(`${loc.title}, ${loc.subtitle}`);
    setDestError('');
    if (loc.coordinates) {
      setDestCoords({ lat: parseFloat(loc.coordinates[1]), lng: parseFloat(loc.coordinates[0]) });
    }
    setShowDestDropdown(false);
  };

  const calculateFare = (rideId, distKm = 5) => {
    const config = VEHICLE_RATES[rideId.toLowerCase()] || { rate: 20, minFare: 50 };

    if (calculatedRouteInfo && calculatedRouteInfo.distanceKm) {
      const realDist = calculatedRouteInfo.distanceKm;
      const perKm = config.rate;
      const perMin = 1.5;

      const duration = calculatedRouteInfo.rideType === rideId.toLowerCase()
        ? calculatedRouteInfo.durationMins
        : Math.max(3, Math.round(realDist * 2.0));

      const baseFare = (realDist * perKm) + (duration * perMin);
      const tax = baseFare * 0.05;
      const total = baseFare + tax;
      return Math.max(config.minFare, Math.round(total));
    }

    const rate = config.rate;
    const baseFare = distKm * rate;
    return Math.max(config.minFare, Math.round(baseFare));
  };

  const currentDist = calculatedRouteInfo?.distanceKm
    ? calculatedRouteInfo.distanceKm
    : ((pickupCoords && destCoords)
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

  const getIconForType = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('bike') || n.includes('moto')) return '🏍️';
    if (n.includes('rickshaw') || n.includes('e-rickshaw')) return '🛺';
    if (n.includes('auto')) return '🛺';
    if (n.includes('taxi')) return '🚕';
    return '🚗';
  };

  const getCapacityForType = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('bike')) return '1 seats';
    if (n.includes('auto') || n.includes('rickshaw')) return '3 seats';
    return '4 seats';
  };

  const getEtaForType = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('bike')) return '3 min';
    if (n.includes('rickshaw') || n.includes('e-rickshaw')) return '6 min';
    return '5 min';
  };

  const rideTypes = backendVehicleTypes.length > 0
    ? backendVehicleTypes.map((vt) => {
      const typeKey = vt.name.toLowerCase();
      const fare = calculateFare(typeKey, currentDist);
      return {
        id: typeKey,
        name: vt.name,
        price: `₹${fare}`,
        eta: getEtaForType(vt.name),
        desc: vt.description || `${vt.capacity_passengers || 4}-seater city transit`,
        icon: getIconForType(vt.name),
        capacity: getCapacityForType(vt.name)
      };
    })
    : [
      { id: 'bike', name: 'Bike', price: `₹${calculateFare('bike', currentDist)}`, eta: '3 min', desc: 'Fast solo bike taxi', icon: '🏍️', capacity: '1 seats' },
      { id: 'auto', name: 'Auto', price: `₹${calculateFare('auto', currentDist)}`, eta: '5 min', desc: 'Affordable 3-wheeler auto', icon: '🛺', capacity: '3 seats' },
      { id: 'e-rickshaw', name: 'E-Rickshaw', price: `₹${calculateFare('e-rickshaw', currentDist)}`, eta: '6 min', desc: 'Eco-friendly rickshaw', icon: '🛺', capacity: '3 seats' },
      { id: 'car', name: 'Car', price: `₹${calculateFare('car', currentDist)}`, eta: '5 min', desc: 'Comfortable city car', icon: '🚗', capacity: '4 seats' },
      { id: 'taxi', name: 'Taxi', price: `₹${calculateFare('taxi', currentDist)}`, eta: '5 min', desc: 'Standard street taxi', icon: '🚕', capacity: '4 seats' }
    ];

  const handleBookRide = async (e) => {
    e.preventDefault();

    if (!user) {
      const pendingBooking = {
        selectedRide,
        pickup,
        destination,
        pickupCoords,
        destCoords,
        calculatedRouteInfo,
        notes
      };
      localStorage.setItem('pending_booking', JSON.stringify(pendingBooking));
      navigate('/login');
      return;
    }

    if (activeBookingData && activeBookingData.status !== 'Completed' && activeBookingData.status !== 'Cancelled') {
      // Scroll to / highlight the active ride panel instead of blocking with an alert
      if (activeRideRef.current) {
        activeRideRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        activeRideRef.current.classList.add('ring-4', 'ring-yellow-400', 'ring-offset-2');
        setTimeout(() => activeRideRef.current?.classList.remove('ring-4', 'ring-yellow-400', 'ring-offset-2'), 2000);
      }
      return;
    }

    let hasErr = false;

    if (!pickup || !pickup.trim()) {
      setPickupError('Please enter pickup location');
      hasErr = true;
    } else {
      setPickupError('');
    }

    if (!destination || !destination.trim()) {
      setDestError('Please enter destination location');
      hasErr = true;
    } else {
      setDestError('');
    }

    if (hasErr) return;

    setIsBooking(true);
    setBookingSuccess(false);
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
      notes_for_driver: notes,
      status: 'Searching'
    };

    // ── Optimistic UI: show searching screen immediately ─────────────────
    setIsSearchingDriver(true);
    setSearchTimeLeft(15 * 60);
    // ─────────────────────────────────────────────────────────────────────

    try {
      const res = await fetchWithAuth('/api/v1/bookings/bookings/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        setActiveBookingData(data);
      } else {
        // Revert optimistic UI on API error
        setIsSearchingDriver(false);
        setSearchTimeLeft(null);
        const errMsg = data?.detail || data?.error || data?.non_field_errors?.[0] || 'Failed to create booking. Please try again.';
        setRideNotification({ type: 'declined', title: 'Booking Failed', message: errMsg });
      }
    } catch (err) {
      // Revert on network error
      setIsSearchingDriver(false);
      setSearchTimeLeft(null);
      setRideNotification({ type: 'declined', title: 'Network Error', message: 'Could not reach server. Check your connection and try again.' });
    } finally {
      setIsBooking(false);
    }
  };


  const handleCancelBooking = async () => {
    if (activeBookingData?.id) {
      try {
        await fetchWithAuth(`/api/v1/bookings/bookings/${activeBookingData.id}/cancel/`, { method: 'POST' });
      } catch (err) {
        console.log(err);
      }
    }
    setIsSearchingDriver(false);
    setBookingSuccess(false);
    setSearchTimeLeft(null);
    setActiveBookingData(null);
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col font-sans relative overflow-x-hidden">

      {/* Desktop Header */}
      <div className="hidden lg:block shrink-0">
        <Navbar user={user} onLogout={onLogout} />
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-0 lg:gap-6 p-0 lg:p-6 relative">

        {/* Left Sidebar (Mobile Layout) */}
        <div className="w-full lg:w-[450px] bg-white h-screen lg:h-[calc(100vh-140px)] lg:rounded-3xl lg:shadow-xl lg:border lg:border-gray-200 flex flex-col relative overflow-hidden shrink-0 z-10 lg:mt-0">

          {/* Floating Notification */}
          {rideNotification && (
            <div className={`absolute top-4 left-4 right-4 z-50 p-3 rounded-2xl shadow-xl border transition-all transform animate-bounce-short bg-white ${rideNotification.type === 'accepted' ? 'border-green-500 text-black' : 'border-red-500 text-black'
              }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${rideNotification.type === 'accepted' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <div>
                    <h4 className="text-xs font-black text-gray-900">{rideNotification.title}</h4>
                    <p className="text-xs font-semibold text-gray-500 mt-0.5">{rideNotification.message}</p>
                  </div>
                </div>
                <button
                  onClick={() => setRideNotification(null)}
                  className="text-gray-400 hover:text-black font-bold p-1 bg-transparent border-none cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Searching for Captain Animated Screen */}
          {isSearchingDriver && (
            <div ref={activeRideRef} className="absolute inset-0 z-50 flex flex-col justify-between overflow-hidden animate-fade-in">
              {/* Full Background Map */}
              <div className="absolute inset-0 w-full h-full z-0">
                <RealtimeMap
                  pickup={pickup}
                  destination={destination}
                  pickupCoords={pickupCoords}
                  destCoords={destCoords}
                  mode="searching"
                  selectedRide={selectedRide}
                />
              </div>

              {/* Floating Transparent Overlays */}
              <div className="relative z-10 w-full h-full pointer-events-none flex flex-col justify-between p-4 sm:p-5">
                {/* Top Radar Status Badge */}
                <div className="pt-2 flex justify-center pointer-events-auto">
                  <div className="bg-[#063B28] px-5 py-3 rounded-full shadow-[0_10px_30px_rgba(6,59,40,0.35)] flex items-center justify-between gap-4 text-white max-w-sm w-full border border-white/20">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="relative flex h-3 w-3 shrink-0">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-[#22C55E]"></span>
                      </span>
                      <span className="text-xs font-bold tracking-tight text-white truncate">
                        Radar Active · Finding nearest
                      </span>
                    </div>
                    <div className="text-xs font-bold shrink-0 flex items-center gap-1.5">
                      <span className="text-[#22C55E] font-black uppercase">{selectedRide}</span>
                      <span className="text-white font-bold">Captains</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Floating Clean White Card */}
                <div className="space-y-3 max-w-md w-full mx-auto pointer-events-auto">
                  <div className="bg-white rounded-[32px] p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] border border-gray-100 text-gray-900 space-y-4">
                    {/* Header with Mint Green Vehicle Box */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-[#EEF8F2] border border-[#D2EDD9] flex items-center justify-center shrink-0 shadow-xs">
                        <span className="text-2xl animate-bounce">
                          {selectedRide === 'bike' ? '🏍️' : (selectedRide === 'auto' || selectedRide === 'e-rickshaw') ? '🛺' : selectedRide === 'suv' ? '🚙' : '🚗'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-snug">
                          Connecting <span className="text-[#16A34A] font-extrabold uppercase">{selectedRide}</span> Captain...
                        </h3>
                        <p className="text-xs text-gray-500 font-medium truncate mt-0.5">
                          Notifying verified drivers near your pickup
                        </p>
                      </div>
                    </div>

                    {/* Clean Emerald Progress Bar */}
                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#16A34A] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${searchProgress}%` }}
                      ></div>
                    </div>

                    {/* 15-min Auto-cancel Countdown */}
                    {searchTimeLeft !== null && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 font-semibold flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Auto-cancel in
                        </span>
                        <span className={`font-black tabular-nums ${
                          searchTimeLeft < 60 ? 'text-red-500' : searchTimeLeft < 180 ? 'text-orange-500' : 'text-gray-700'
                        }`}>
                          {String(Math.floor(searchTimeLeft / 60)).padStart(2, '0')}:{String(searchTimeLeft % 60).padStart(2, '0')}
                        </span>
                      </div>
                    )}

                    {/* Total Fare & Option Button Row */}
                    <div className="bg-[#F8FAF9] rounded-2xl p-3.5 border border-[#E6EFE9] flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* <span className="bg-white border-2 border-[#16A34A] text-[#16A34A] font-black px-2.5 py-1 rounded-xl text-xs uppercase tracking-wide">
                          {selectedRide}
                        </span> */}
                        <div className="flex flex-col">
                          <span className="text-gray-500 font-semibold text-[10px] uppercase">Total Fare</span>
                          <span className="text-[#16A34A] text-lg font-black tracking-tight leading-none">
                            ₹{calculateFare(selectedRide, currentDist)}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Option Button to View/Hide Route Details */}
                      <button
                        type="button"
                        onClick={() => setShowTripDetailsInSearch(!showTripDetailsInSearch)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D2EDD9] text-[#063B28] font-black text-xs hover:bg-[#EEF8F2] active:scale-95 transition-all shadow-2xs cursor-pointer"
                        title="Toggle Route & Distance Details"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>{showTripDetailsInSearch ? 'Hide Details' : 'Route Details'}</span>
                        <ChevronDown className={`w-4 h-4 text-[#16A34A] transition-transform duration-200 ${showTripDetailsInSearch ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {/* Expandable Route & Distance Details Panel */}
                    {showTripDetailsInSearch && (
                      <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-[#E6EFE9] space-y-3.5 animate-fade-in">
                        {/* Pickup Row */}
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-[#16A34A] flex items-center justify-center shrink-0 mt-0.5 bg-white p-0.5 shadow-xs">
                            <div className="w-2 h-2 rounded-full bg-[#16A34A]"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase text-[#16A34A] tracking-wider">Pickup Point</p>
                            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate mt-0.5">{pickup || 'Current Location'}</p>
                          </div>
                        </div>

                        {/* Drop Row */}
                        <div className="flex items-start gap-3 border-t border-[#E6EFE9] pt-3">
                          <div className="w-5 h-5 rounded-full border-2 border-[#EF4444] flex items-center justify-center shrink-0 mt-0.5 bg-white p-0.5 shadow-xs">
                            <div className="w-2 h-2 rounded-full bg-[#EF4444]"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase text-[#EF4444] tracking-wider">Drop Point</p>
                            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate mt-0.5">{destination || 'Selected Drop Location'}</p>
                          </div>
                        </div>

                        {/* Distance to Travel Row */}
                        <div className="border-t border-[#E6EFE9] pt-3 flex items-center justify-between text-xs">
                          <span className="text-gray-500 font-bold">Distance:</span>
                          <span className="text-gray-900 font-black flex items-center gap-1.5 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                            <span>🛣️ {currentDist} km</span>
                            <span className="text-gray-400">·</span>
                            <span className="text-emerald-700">~{calculatedRouteInfo?.durationMins || Math.max(3, Math.round(currentDist * 2.5))} mins</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Dark Forest Green Cancel Request Button */}
                    <button
                      onClick={handleCancelBooking}
                      className="w-full py-4 bg-[#063B28] hover:bg-[#084A33] active:scale-[0.98] text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-[#063B28]/25 transition-all border-none cursor-pointer text-center"
                    >
                      Cancel Request
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Header Bar */}
          <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-gray-200 bg-white shrink-0 z-30">
            <button
              type="button"
              onClick={() => navigate('/home')}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 flex items-center justify-center transition-colors cursor-pointer border-none"
            >
              <ArrowLeft className="w-5 h-5 text-gray-900" />
            </button>
            <div className="text-center">
              <h1 className="text-base font-black text-gray-900">Book Ride</h1>
              <span className="text-xs text-gray-400 font-bold block">RaahGo Express</span>
            </div>
            <button
              type="button"
              onClick={() => setShowProfileMenu(true)}
              className="w-9 h-9 rounded-full bg-[#063B28] text-white flex items-center justify-center font-bold text-xs shadow-xs cursor-pointer border-none"
              title="Open Profile"
            >
              {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
            </button>
          </div>

          {/* Scrollable Content Area */}
          <div className={`flex-1 overflow-y-auto px-4 pt-4 pb-6 space-y-4 scrollbar-none ${showFares ? 'pb-6' : 'pb-6'}`}>
            <div className="space-y-4">
              {/* Map View at Top (Mobile Only) */}
              <div className="block lg:hidden h-56 sm:h-64 rounded-[24px] overflow-hidden border border-gray-200 relative z-10 shrink-0 shadow-sm">
                <RealtimeMap
                  pickup={pickup}
                  destination={destination}
                  pickupCoords={pickupCoords}
                  destCoords={destCoords}
                  mode="booking"
                  selectedRide={selectedRide}
                  onRouteCalculated={(info) => setCalculatedRouteInfo(info)}
                  onLocateMe={handleDetectGpsLocation}
                  onPickupChange={(address, coords) => {
                    setPickup(address);
                    setPickupCoords(coords);
                    setPickupError('');
                  }}
                />
              </div>

              {/* GPS Status / Error Alert Banner */}
              {locationStatus && (locationStatus.includes('Unable') || locationStatus.includes('unavailable') || locationStatus.includes('denied') || locationStatus.includes('Please enable')) && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center gap-2.5 text-xs text-red-500 font-bold animate-fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span className="flex-1">{locationStatus}</span>
                </div>
              )}

              {/* Inputs Group Card */}
              <div className="glass-card rounded-[28px] p-4 space-y-3 relative border border-emerald-500/15 shadow-sm">
                {/* Pickup Location Row */}
                <div className="relative" ref={pickupContainerRef}>
                  <div className={`flex items-center gap-3 bg-white/90 p-3 rounded-2xl border transition-all ${pickupError ? 'border-red-500 bg-red-500/5 ring-1 ring-red-500' : 'border-gray-200/80'
                    }`}>
                    <span className="text-emerald-500 text-base shrink-0">🟢</span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={pickup}
                        onChange={handlePickupChange}
                        onFocus={() => {
                          setShowPickupDropdown(true);
                          setPickupError('');
                        }}
                        placeholder="Pickup location"
                        className="w-full bg-transparent text-sm font-bold text-gray-900 focus:outline-none border-none p-0"
                      />
                    </div>
                    {pickup && (
                      <button
                        type="button"
                        onClick={() => {
                          setPickup('');
                          setPickupCoords(null);
                          setPickupSuggestions([]);
                          setCalculatedRouteInfo(null);
                        }}
                        className="w-6 h-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center shrink-0"
                        title="Clear pickup location"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}

                  </div>

                  {/* Inline Error Message */}
                  {pickupError && (
                    <p className="text-xs font-extrabold text-red-500 mt-1.5 flex items-center gap-1.5 animate-fade-in pl-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                      <span>{pickupError}</span>
                    </p>
                  )}

                  {showPickupDropdown && (
                    <div className="absolute left-0 right-0 glass-panel border border-white/80 mt-2 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto text-left p-1.5 divide-y divide-gray-100/60">
                      {/* 1-Tap Current Location Shortcut */}
                      <div
                        onClick={handleDetectGpsLocation}
                        className="p-2.5 hover:bg-emerald-50 cursor-pointer rounded-xl flex items-center gap-3 transition-colors text-xs font-bold text-[#16A34A] bg-emerald-50/60 mb-1"
                      >
                        <div className="w-7 h-7 rounded-full bg-emerald-500/15 flex items-center justify-center shrink-0">
                          <LocateFixed className="w-4 h-4 text-emerald-600 animate-pulse" />
                        </div>
                        <div className="flex-1">
                          <p className="font-extrabold text-[#16A34A] text-xs">Use Current GPS Location</p>
                          <p className="text-xs text-gray-500 font-medium">Detect address via live device GPS</p>
                        </div>
                      </div>

                      {/* Autocomplete Search Suggestions */}
                      {pickupSuggestions.map((loc, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectPickupSuggestion(loc)}
                          className="p-2.5 hover:bg-emerald-50/60 cursor-pointer text-xs font-semibold flex items-center gap-3 rounded-xl transition-colors"
                        >
                          <span className="text-base shrink-0">{loc.icon || '📍'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-gray-900 font-extrabold truncate">{loc.title}</p>
                              {loc.distanceKm < 999 && (
                                <span className="text-xs text-gray-500 font-bold shrink-0 ml-1">{loc.distanceKm.toFixed(1)} km</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5 font-medium">{loc.subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Divider line */}
                <div className="border-t border-gray-100"></div>

                {/* Destination Row */}
                <div className="relative" ref={destContainerRef}>
                  <div className={`flex items-center gap-3 bg-white/90 p-3 rounded-2xl border transition-all ${destError ? 'border-red-500 bg-red-500/5 ring-1 ring-red-500' : 'border-gray-200/80'
                    }`}>
                    <span className="text-red-500 text-base shrink-0">📍</span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={destination}
                        onChange={handleDestChange}
                        onFocus={() => {
                          destSuggestions.length > 0 && setShowDestDropdown(true);
                          setDestError('');
                        }}
                        placeholder="Drop location"
                        className="w-full bg-transparent text-sm font-bold text-gray-900 focus:outline-none border-none p-0"
                      />
                    </div>
                    {destination && (
                      <button
                        type="button"
                        onClick={() => {
                          setDestination('');
                          setDestCoords(null);
                          setDestSuggestions([]);
                          setCalculatedRouteInfo(null);
                        }}
                        className="w-6 h-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center shrink-0"
                        title="Clear drop location"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Inline Error Message */}
                  {destError && (
                    <p className="text-xs font-extrabold text-red-500 mt-1.5 flex items-center gap-1.5 animate-fade-in pl-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                      <span>{destError}</span>
                    </p>
                  )}

                  {showDestDropdown && destSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 glass-panel border border-white/80 mt-2 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto text-left p-1.5 divide-y divide-gray-100/60">
                      {destSuggestions.map((loc, idx) => (
                        <div
                          key={idx}
                          onClick={() => selectDestSuggestion(loc)}
                          className="p-2.5 hover:bg-emerald-50/60 cursor-pointer text-xs font-semibold flex items-center gap-3 rounded-xl transition-colors"
                        >
                          <span className="text-base shrink-0">{loc.icon || '📍'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-gray-900 font-extrabold truncate">{loc.title}</p>
                              {loc.distanceKm < 999 && (
                                <span className="text-xs text-gray-500 font-bold shrink-0 ml-1">{loc.distanceKm.toFixed(1)} km</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5 font-medium">{loc.subtitle}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Note to Driver */}
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Note to driver (optional)"
                  className="w-full bg-white/80 border border-gray-200/80 rounded-[16px] p-3 text-xs text-gray-900 font-medium focus:border-emerald-500 focus:ring-0 focus:outline-none resize-none h-14 shadow-2xs"
                />
              </div>

              {/* Show Fare Estimates Button */}
              <button
                type="button"
                onClick={() => {
                  let hasErr = false;

                  if (!pickup || !pickup.trim()) {
                    setPickupError('Please enter pickup location');
                    hasErr = true;
                  } else {
                    setPickupError('');
                  }

                  if (!destination || !destination.trim()) {
                    setDestError('Please enter destination location');
                    hasErr = true;
                  } else {
                    setDestError('');
                  }

                  if (hasErr) return;

                  setShowFares(true);
                }}
                className="w-full py-4 bg-[#063B28] hover:bg-[#084A33] active:scale-[0.98] text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-[#063B28]/20 transition-all text-center cursor-pointer border-none"
              >
                Show Fare Estimates
              </button>

              {/* Vehicle List (Revealed below after Show Fares click) */}
              {showFares && (
                <div ref={fareEstimatesRef} className="space-y-3 pt-2 animate-fade-in">
                  <h3 className="text-sm font-black text-gray-900">Choose vehicle · {currentDist} km</h3>
                  <div className="space-y-2.5">
                    {rideTypes.map((ride) => {
                      const isSelected = selectedRide === ride.id;
                      return (
                        <div
                          key={ride.id}
                          onClick={() => setSelectedRide(ride.id)}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${isSelected ? 'border-2 border-[#16A34A] bg-[#EEF8F2]/90 shadow-sm' : 'glass-card border-gray-200/80 hover:bg-emerald-50/30'
                            }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-white text-[#16A34A] shadow-sm border border-[#D2EDD9]' : 'bg-gray-100 text-gray-600'
                              }`}>
                              <span className="text-xl">{ride.icon}</span>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-extrabold text-sm text-gray-900">{ride.name}</h4>
                                <span className="text-[10px] bg-white/80 border border-gray-200 font-black text-gray-600 px-1.5 py-0.5 rounded-md">
                                  {ride.capacity}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 font-medium">{ride.eta} away · {ride.desc}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-base text-[#16A34A]">{ride.price}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Confirm & Request Captain Action Button */}
                  <button
                    type="button"
                    onClick={handleBookRide}
                    disabled={isBooking}
                    className="w-full py-4 bg-gradient-to-r from-[#063B28] to-[#0D5B3E] hover:from-[#084A33] hover:to-[#106A49] text-white font-black text-base rounded-2xl shadow-xl shadow-[#063B28]/25 active:scale-[0.98] transition-all cursor-pointer border-none flex items-center justify-center gap-2 mt-4"
                  >
                    {isBooking ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Requesting Captain...</span>
                      </>
                    ) : (
                      <>
                        <span>Book {selectedRide.toUpperCase()} Now</span>
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div> {/* End of Left Sidebar */}

        {/* Right Area (Desktop Map) */}
        <div className="hidden lg:block flex-1 rounded-3xl overflow-hidden shadow-xl border border-gray-200 relative h-[calc(100vh-140px)] lg:mt-0 shrink-0 z-10">
          <RealtimeMap
            pickup={pickup}
            destination={destination}
            pickupCoords={pickupCoords}
            destCoords={destCoords}
            mode="booking"
            selectedRide={selectedRide}
            onRouteCalculated={(info) => setCalculatedRouteInfo(info)}
            onLocateMe={handleDetectGpsLocation}
            onPickupChange={(address, coords) => {
              setPickup(address);
              setPickupCoords(coords);
              setPickupError('');
            }}
          />
        </div>

      </div> {/* End of Main Container */}

      {/* Desktop Footer */}
      <div className="hidden lg:block shrink-0 w-full mt-auto">
        <Footer />
      </div>

      {/* Customer Profile Menu Modal */}
      <CustomerProfileMenu
        isOpen={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        user={user}
        onLogout={onLogout}
        activeNav="profile"
      />

    </div>
  );
}
