import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Navigation, Car, ShieldCheck, Clock, Search, ArrowRight, ArrowLeft, Star,
  CreditCard, Tag, CheckCircle2, ChevronRight, ChevronDown, ChevronUp, LogOut, User, RefreshCw, Zap,
  LocateFixed, Loader2, KeyRound, Lock, Unlock, AlertCircle, X, Info, Phone, MessageSquare, Shield, Share2, AlertTriangle
} from 'lucide-react';
import { fetchLocationSuggestions, getDeviceGpsLocation, getRealtimeGpsLocation } from '../common/locationService';
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

  // Read any cached pending booking from localStorage
  const getCachedBooking = () => {
    try {
      const saved = localStorage.getItem('pending_booking');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.log('Error reading pending_booking cache:', e);
    }
    return null;
  };

  const cachedBooking = getCachedBooking();

  // Selected ride passed via state or cache or default
  const initialRide = location.state?.selectedRide || cachedBooking?.selectedRide || 'bike';

  const [pickup, setPickup] = useState(() => location.state?.prefillPickup || cachedBooking?.pickup || '');
  const [destination, setDestination] = useState(() => location.state?.prefillDrop || location.state?.prefillDest || cachedBooking?.destination || '');
  const [pickupError, setPickupError] = useState('');
  const [destError, setDestError] = useState('');
  const [selectedRide, setSelectedRide] = useState(initialRide);
  const [showFares, setShowFares] = useState(() => Boolean((location.state?.prefillPickup || cachedBooking?.pickup) && (location.state?.prefillDrop || location.state?.prefillDest || cachedBooking?.destination)));
  const [paymentMethod, setPaymentMethod] = useState(() => cachedBooking?.paymentMethod || 'COD'); // 'COD' | 'Online' | 'RaahGo Wallet'
  const [isBooking, setIsBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [activeBookingData, setActiveBookingData] = useState(null);
  const [isSearchingDriver, setIsSearchingDriver] = useState(false);
  const [searchProgress, setSearchProgress] = useState(0);
  const [showTripDetailsInSearch, setShowTripDetailsInSearch] = useState(false);
  const [rideNotification, setRideNotification] = useState(null);
  const [tripCompletedModal, setTripCompletedModal] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [ratingCompliments, setRatingCompliments] = useState(['Polite Captain', 'Smooth Ride']);
  const [showSosModal, setShowSosModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of plans');
  const [activeRideRef] = useState(() => React.createRef());
  const [customerWaitMinutes, setCustomerWaitMinutes] = useState(5);
  const [searchTimeLeft, setSearchTimeLeft] = useState(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [pickupCoords, setPickupCoords] = useState(() => location.state?.pickupCoords || cachedBooking?.pickupCoords || null);
  const [destCoords, setDestCoords] = useState(() => location.state?.dropCoords || cachedBooking?.destCoords || null);
  const [calculatedRouteInfo, setCalculatedRouteInfo] = useState(() => cachedBooking?.calculatedRouteInfo || null);
  const [notes, setNotes] = useState(() => cachedBooking?.notes || '');

  
  const isClearingRideRef = useRef(false);

  // Helper to clear cached booking and reset address input fields
  const clearRideCacheAndInputs = () => {
    isClearingRideRef.current = true;
    localStorage.removeItem('pending_booking');
    setPickup('');
    setDestination('');
    setPickupCoords(null);
    setDestCoords(null);
    setCalculatedRouteInfo(null);
    setShowFares(false);
    setTimeout(() => {
      isClearingRideRef.current = false;
    }, 500);
  };

  // Sync inputs with cache continuously whenever user enters/changes addresses
  useEffect(() => {
    if (isClearingRideRef.current) return;

    if (!pickup?.trim() && !destination?.trim()) {
      if (!activeBookingData || !['Searching', 'Accepted', 'Arrived', 'In Trip'].includes(activeBookingData.status)) {
        localStorage.removeItem('pending_booking');
      }
      return;
    }

    if (activeBookingData && ['Completed', 'Cancelled'].includes(activeBookingData.status)) {
      return;
    }

    try {
      const currentCache = {
        selectedRide,
        pickup,
        destination,
        pickupCoords,
        destCoords,
        calculatedRouteInfo,
        paymentMethod,
        notes,
        savedAt: Date.now()
      };
      localStorage.setItem('pending_booking', JSON.stringify(currentCache));
    } catch (e) {
      console.log('Error caching pending booking:', e);
    }
  }, [pickup, destination, pickupCoords, destCoords, selectedRide, paymentMethod, notes, calculatedRouteInfo, activeBookingData]);

  // Auto-fetch cached addresses when user logs in or auth state updates
  useEffect(() => {
    if (isClearingRideRef.current) return;
    const cached = getCachedBooking();
    if (cached) {
      if (!pickup && cached.pickup) {
        setPickup(cached.pickup);
      }
      if (!destination && cached.destination) {
        setDestination(cached.destination);
      }
      if (!pickupCoords && cached.pickupCoords) {
        setPickupCoords(cached.pickupCoords);
      }
      if (!destCoords && cached.destCoords) {
        setDestCoords(cached.destCoords);
      }
      if (cached.selectedRide) {
        setSelectedRide(cached.selectedRide);
      }
      if (cached.paymentMethod) {
        setPaymentMethod(cached.paymentMethod);
      }
      if (cached.notes) {
        setNotes(cached.notes);
      }
      if ((cached.pickup || pickup) && (cached.destination || destination)) {
        setShowFares(true);
      }
    }
  }, [user]);

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

    const fetchConfig = async () => {
      try {
        const res = await fetchWithAuth('/api/v1/services/config/');
        if (res.ok) {
          const cfg = await res.json();
          if (cfg?.customer_wait_time) {
            setCustomerWaitMinutes(Number(cfg.customer_wait_time));
          }
        }
      } catch (err) {
        console.log('Config API fetch notice:', err);
      }
    };

    fetchVehicleTypes();
    fetchConfig();
  }, []);

  // Auto-detect GPS Location and restore active booking state on mount
  useEffect(() => {
    const cached = getCachedBooking();
    const hasInitialPickup = location.state?.prefillPickup || cached?.pickup;
    if (!hasInitialPickup) {
      handleDetectGpsLocation();
    }

    const restoreActiveBookingOnMount = async () => {
      if (!user) return;
      try {
        const res = await fetchWithAuth('/api/v1/bookings/bookings/active/');
        if (res.ok) {
          const data = await res.json();
          if (data && !data.auto_cancelled && data.id) {
            if (data.status === 'Completed' || data.status === 'Cancelled') {
              clearRideCacheAndInputs();
              if (data.status === 'Completed') {
                setTripCompletedModal(true);
              }
              return;
            }

            setActiveBookingData(data);
            if (data.pickup_address) setPickup(data.pickup_address);
            if (data.dropoff_address) setDestination(data.dropoff_address);
            if (data.pickup_latitude && data.pickup_longitude) {
              setPickupCoords({ lat: parseFloat(data.pickup_latitude), lng: parseFloat(data.pickup_longitude) });
            }
            if (data.dropoff_latitude && data.dropoff_longitude) {
              setDestCoords({ lat: parseFloat(data.dropoff_latitude), lng: parseFloat(data.dropoff_longitude) });
            }
            if (data.selected_ride) {
              setSelectedRide(data.selected_ride.toLowerCase());
            }

            if (data.status === 'Searching') {
              setIsSearchingDriver(true);
              setBookingSuccess(false);
              const created = new Date(data.created_at).getTime();
              const elapsed = Math.floor((Date.now() - created) / 1000);
              const waitSec = (customerWaitMinutes || 5) * 60;
              const remaining = Math.max(0, waitSec - elapsed);
              setSearchTimeLeft(remaining);
            } else if (['Accepted', 'Arrived', 'In Trip'].includes(data.status)) {
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
  }, [user, customerWaitMinutes]);

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

  // Auto-geocode destination address text to coordinates if destCoords is null
  useEffect(() => {
    if (destination && destination.trim().length > 2 && !destCoords) {
      const autoGeocodeDest = async () => {
        const userCoords = pickupCoords ? { lat: pickupCoords.lat, lon: pickupCoords.lng } : null;
        const results = await fetchLocationSuggestions(destination, userCoords);
        if (results && results.length > 0 && results[0].coordinates) {
          setDestCoords({
            lat: parseFloat(results[0].coordinates[1]),
            lng: parseFloat(results[0].coordinates[0])
          });
        }
      };
      autoGeocodeDest();
    }
  }, [destination, destCoords, pickupCoords]);

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

  // Poll for Captain status updates + 15-min auto-cancel countdown
  useEffect(() => {
    let interval = null;
    let countdownInterval = null;
    const bookingId = activeBookingData?.id;

    if (bookingId && activeBookingData?.status !== 'Completed' && activeBookingData?.status !== 'Cancelled') {
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
              clearRideCacheAndInputs();
              setIsSearchingDriver(false);
              setBookingSuccess(false);
              setSearchTimeLeft(null);
              setRideNotification({
                type: 'declined',
                title: 'Ride Cancelled',
                message: 'This ride has been cancelled.'
              });
              setActiveBookingData(null);
            } else if (data.status === 'Completed') {
              clearRideCacheAndInputs();
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

      if (activeBookingData?.status === 'Searching') {
        const waitMins = customerWaitMinutes || 5;
        const waitSec = waitMins * 60;
        const created = new Date(activeBookingData.created_at).getTime();
        countdownInterval = setInterval(() => {
          const elapsed = Math.floor((Date.now() - created) / 1000);
          const remaining = Math.max(0, waitSec - elapsed);
          setSearchTimeLeft(remaining);

          if (remaining === 0) {
            clearInterval(countdownInterval);
            fetchWithAuth(`/api/v1/bookings/bookings/${bookingId}/cancel/`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason: `Auto-cancelled: no driver found within ${waitMins} minutes.` })
            }).then(() => {
              clearRideCacheAndInputs();
              setIsSearchingDriver(false);
              setBookingSuccess(false);
              setSearchTimeLeft(null);
              setActiveBookingData(null);
              setRideNotification({
                type: 'declined',
                title: 'No Captain Found ⏱️',
                message: `Your ride was automatically cancelled after ${waitMins} minutes with no driver response. Please try again.`
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
  }, [activeBookingData?.id, activeBookingData?.status, isSearchingDriver, customerWaitMinutes]);

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
    setShowPickupDropdown(false);
    setLocationStatus('Accessing device GPS location...');

    try {
      const result = await getRealtimeGpsLocation();

      if (!result?.error) {
        // Success
        setPickup(result.address);
        setPickupCoords({ lat: result.lat, lng: result.lon });
        setPickupError('');
        setGpsVerified(true);
        setLocationStatus('');
        return;
      }

      // Error — show specific actionable guidance
      setGpsVerified(false);
      switch (result.errorCode) {
        case 'PERMISSION_DENIED':
          setLocationStatus(
            'Location permission was denied. Tap the 🔒 or settings icon in your browser address bar → Permissions → Allow Location, then tap again.'
          );
          break;
        case 'INSECURE_CONTEXT': {
          const host = typeof window !== 'undefined' ? window.location.host : '';
          setLocationStatus(
            `GPS requires HTTPS. Please open the URL starting with https://${host ? ` (e.g. https://${host})` : ''}`
          );
          break;
        }
        case 'POSITION_UNAVAILABLE':
          setLocationStatus(
            'GPS location unavailable. Please ensure Device Location (GPS) is turned ON in your phone quick settings.'
          );
          break;
        case 'TIMEOUT':
          setLocationStatus(
            'GPS request timed out. Please check your signal and try again.'
          );
          break;
        case 'UNSUPPORTED':
          setLocationStatus(
            'Your browser does not support GPS. Please search for your pickup location manually.'
          );
          break;
        default:
          setLocationStatus(
            'Could not determine your location. Please search for your pickup point manually.'
          );
      }
    } catch (err) {
      setGpsVerified(false);
      setLocationStatus('Unable to access GPS location. Please check browser permissions.');
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
        paymentMethod,
        notes
      };
      localStorage.setItem('pending_booking', JSON.stringify(pendingBooking));
      navigate('/login');
      return;
    }

    if (activeBookingData && ['Searching', 'Accepted', 'Arrived', 'In Trip'].includes(activeBookingData.status)) {
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
      payment_method: paymentMethod,
      notes_for_driver: notes,
      status: 'Searching'
    };

    setIsSearchingDriver(true);
    setSearchTimeLeft((customerWaitMinutes || 5) * 60);

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
        setIsSearchingDriver(false);
        setSearchTimeLeft(null);
        const errMsg = data?.detail || data?.error || data?.non_field_errors?.[0] || 'Failed to create booking. Please try again.';
        setRideNotification({ type: 'declined', title: 'Booking Failed', message: errMsg });
      }
    } catch (err) {
      setIsSearchingDriver(false);
      setSearchTimeLeft(null);
      setRideNotification({ type: 'declined', title: 'Network Error', message: 'Could not reach server. Check your connection and try again.' });
    } finally {
      setIsBooking(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (activeBookingData?.id) {
      try {
        await fetchWithAuth(`/api/v1/bookings/bookings/${activeBookingData.id}/cancel/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: cancelReason })
        });
      } catch (err) {
        console.log(err);
      }
    }
    clearRideCacheAndInputs();
    setShowCancelModal(false);
    setIsSearchingDriver(false);
    setBookingSuccess(false);
    setSearchTimeLeft(null);
    setActiveBookingData(null);
    setRideNotification({
      type: 'declined',
      title: 'Ride Cancelled',
      message: 'Your ride has been successfully cancelled.'
    });
  };

  const handleCompleteRating = () => {
    clearRideCacheAndInputs();
    setTripCompletedModal(false);
    setActiveBookingData(null);
    setBookingSuccess(false);
    setIsSearchingDriver(false);
    navigate('/home');
  };

  // Helper check for active accepted ride status
  const isAcceptedRide = activeBookingData && ['Accepted', 'Arrived', 'In Trip'].includes(activeBookingData.status);

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col font-sans relative overflow-x-hidden">

      {/* Desktop Header */}
      <div className="hidden lg:block shrink-0">
        <Navbar user={user} onLogout={onLogout} />
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-0 lg:gap-6 p-0 lg:p-6 relative">

        {/* Left Sidebar */}
        <div className="w-full lg:w-[460px] bg-white h-screen lg:h-[calc(100vh-140px)] lg:rounded-3xl lg:shadow-xl lg:border lg:border-gray-200 flex flex-col relative overflow-hidden shrink-0 z-10 lg:mt-0">

          {/* Floating Notification Toast */}
          {rideNotification && (
            <div className={`absolute top-4 left-4 right-4 z-50 p-3.5 rounded-2xl shadow-2xl border transition-all transform animate-bounce-short bg-white ${
              rideNotification.type === 'accepted' ? 'border-green-500 text-black' : 'border-red-500 text-black'
            }`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${rideNotification.type === 'accepted' ? 'bg-green-500 animate-ping' : 'bg-red-500'}`} />
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

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* 1. SEARCHING FOR CAPTAIN ANIMATED SCREEN */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {isSearchingDriver && (
            <div ref={activeRideRef} className="absolute inset-0 z-50 flex flex-col justify-between overflow-hidden animate-fade-in">
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

              <div className="relative z-10 w-full h-full pointer-events-none flex flex-col justify-between p-4 sm:p-5">
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

                <div className="space-y-3 max-w-md w-full mx-auto pointer-events-auto">
                  <div className="bg-white rounded-[32px] p-5 sm:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.22)] border border-gray-100 text-gray-900 space-y-4">
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

                    <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-[#16A34A] h-full transition-all duration-300 rounded-full"
                        style={{ width: `${searchProgress}%` }}
                      ></div>
                    </div>

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

                    <div className="bg-[#F8FAF9] rounded-2xl p-3.5 border border-[#E6EFE9] flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-gray-500 font-semibold text-[10px] uppercase">Total Fare</span>
                        <span className="text-[#16A34A] text-lg font-black tracking-tight leading-none">
                          ₹{calculateFare(selectedRide, currentDist)}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowTripDetailsInSearch(!showTripDetailsInSearch)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-[#D2EDD9] text-[#063B28] font-black text-xs hover:bg-[#EEF8F2] active:scale-95 transition-all shadow-2xs cursor-pointer"
                      >
                        <MapPin className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span>{showTripDetailsInSearch ? 'Hide Details' : 'Route Details'}</span>
                        <ChevronDown className={`w-4 h-4 text-[#16A34A] transition-transform duration-200 ${showTripDetailsInSearch ? 'rotate-180' : ''}`} />
                      </button>
                    </div>

                    {showTripDetailsInSearch && (
                      <div className="bg-[#F8FAF9] rounded-2xl p-4 border border-[#E6EFE9] space-y-3.5 animate-fade-in">
                        <div className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full border-2 border-[#16A34A] flex items-center justify-center shrink-0 mt-0.5 bg-white p-0.5 shadow-xs">
                            <div className="w-2 h-2 rounded-full bg-[#16A34A]"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase text-[#16A34A] tracking-wider">Pickup Point</p>
                            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate mt-0.5">{pickup || 'Current Location'}</p>
                          </div>
                        </div>

                        <div className="flex items-start gap-3 border-t border-[#E6EFE9] pt-3">
                          <div className="w-5 h-5 rounded-full border-2 border-[#EF4444] flex items-center justify-center shrink-0 mt-0.5 bg-white p-0.5 shadow-xs">
                            <div className="w-2 h-2 rounded-full bg-[#EF4444]"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-black uppercase text-[#EF4444] tracking-wider">Drop Point</p>
                            <p className="text-xs sm:text-sm font-bold text-gray-900 truncate mt-0.5">{destination || 'Selected Drop Location'}</p>
                          </div>
                        </div>

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

                    <button
                      onClick={() => setShowCancelModal(true)}
                      className="w-full py-4 bg-[#063B28] hover:bg-[#084A33] active:scale-[0.98] text-white font-extrabold text-sm sm:text-base rounded-2xl shadow-lg shadow-[#063B28]/25 transition-all border-none cursor-pointer text-center"
                    >
                      Cancel Request
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════ */}
          {/* 2. ACCEPTED CAPTAIN & LIVE RIDE TRACKING SCREEN */}
          {/* ═════════════════════════════════════════════════════════════════════ */}
          {isAcceptedRide ? (
            <div className="flex flex-col h-full overflow-y-auto scrollbar-none animate-fade-in bg-slate-50">
              {/* Header Bar */}
              <div className="flex items-center justify-between px-5 pt-6 pb-4 border-b border-gray-200 bg-white shrink-0 shadow-xs">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#063B28] text-white flex items-center justify-center shadow-md shadow-emerald-700/20">
                    <Car className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-gray-900">
                      {activeBookingData.status === 'Accepted' && 'Captain En Route'}
                      {activeBookingData.status === 'Arrived' && 'Captain Has Arrived'}
                      {activeBookingData.status === 'In Trip' && 'Trip In Progress'}
                    </h2>
                    <span className="text-xs text-emerald-600 font-extrabold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                      Live Tracking Active
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSosModal(true)}
                  className="px-3 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-extrabold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer transition-all active:scale-95"
                >
                  <Shield className="w-3.5 h-3.5 text-red-600" />
                  <span>SOS</span>
                </button>
              </div>

              {/* Scrollable Content inside Accepted View */}
              <div className="p-4 space-y-4 flex-1">

                {/* Status Indicator Banner */}
                <div className={`p-4 rounded-2xl border text-white shadow-md flex items-center justify-between ${
                  activeBookingData.status === 'Accepted'
                    ? 'bg-gradient-to-r from-[#063B28] to-[#0E5C41] border-emerald-600'
                    : activeBookingData.status === 'Arrived'
                    ? 'bg-gradient-to-r from-amber-600 to-amber-700 border-amber-500'
                    : 'bg-gradient-to-r from-blue-700 to-indigo-800 border-blue-600'
                }`}>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-80">RIDE STATUS</span>
                    <h3 className="text-base font-black tracking-tight mt-0.5">
                      {activeBookingData.status === 'Accepted' && 'Captain arriving in ~3 mins'}
                      {activeBookingData.status === 'Arrived' && 'Captain reached pickup point!'}
                      {activeBookingData.status === 'In Trip' && 'On the way to destination'}
                    </h3>
                  </div>
                  <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-xl">
                    {activeBookingData.status === 'Accepted' && '🚕'}
                    {activeBookingData.status === 'Arrived' && '📍'}
                    {activeBookingData.status === 'In Trip' && '🚀'}
                  </div>
                </div>

                {/* Prominent Start Ride OTP Box */}
                <div className="bg-white rounded-2xl p-4 border border-emerald-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 font-bold">
                      <KeyRound className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">START RIDE OTP</p>
                      <p className="text-xs text-gray-600 font-medium">Share PIN with captain before boarding</p>
                    </div>
                  </div>
                  <div className="bg-emerald-500 text-white font-black text-xl px-4 py-1.5 rounded-xl tracking-widest shadow-sm font-mono">
                    {activeBookingData.otp || activeBookingData.ride_pin }
                  </div>
                </div>

                {/* Captain Profile & Vehicle Details Card */}
                <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3.5">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-800 flex items-center justify-center font-black text-xl border-2 border-emerald-500/20 shadow-xs">
                          {(activeBookingData.driver_details?.captain_name || 'C').charAt(0).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] border-2 border-white shadow-xs">
                          ✓
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-extrabold text-base text-gray-900">
                            {activeBookingData.driver_details?.captain_name || 'Captain Partner'}
                          </h3>
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-1.5 py-0.5 rounded-md">
                            Verified
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="flex items-center gap-1 text-xs font-black text-amber-500">
                            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                            {activeBookingData.driver_details?.rating || '4.95'}
                          </span>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-500 font-semibold">1,240+ trips</span>
                        </div>
                      </div>
                    </div>

                    {/* Vehicle Type Icon */}
                    <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-200 flex items-center justify-center text-2xl shadow-2xs">
                      {selectedRide === 'bike' ? '🏍️' : (selectedRide === 'auto' || selectedRide === 'e-rickshaw') ? '🛺' : '🚗'}
                    </div>
                  </div>

                  {/* Vehicle Model & Registration Number Plate */}
                  <div className="bg-[#F8FAF9] rounded-2xl p-3.5 border border-[#E6EFE9] flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">VEHICLE DETAILS</p>
                      <p className="text-xs font-bold text-gray-900 mt-0.5">
                        {activeBookingData.driver_details?.vehicle_name || 'Maruti Swift Dzire'}
                      </p>
                    </div>
                    {/* Indian Standard Number Plate Style */}
                    <div className="bg-amber-300 text-black border-2 border-black font-mono font-black text-xs px-3 py-1 rounded-lg tracking-wider shadow-xs">
                      {activeBookingData.driver_details?.vehicle_number || 'DL 01 AB 1234'}
                    </div>
                  </div>

                  {/* Direct Contact Buttons */}
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <a
                      href={`tel:${activeBookingData.driver_details?.captain_phone || '+919876543210'}`}
                      className="py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all no-underline cursor-pointer"
                    >
                      <Phone className="w-4 h-4" />
                      <span>Call Captain</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => alert(`Messaging Captain: ${activeBookingData.driver_details?.captain_name || 'Partner'}`)}
                      className="py-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-900 font-extrabold text-xs rounded-xl flex items-center justify-center gap-2 border border-gray-200 transition-all cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-gray-600" />
                      <span>Message</span>
                    </button>
                  </div>
                </div>

                {/* Trip Route Details Card */}
                <div className="bg-white rounded-3xl p-5 border border-gray-200 shadow-sm space-y-3.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-gray-500">Trip Overview</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full border-2 border-emerald-600 flex items-center justify-center shrink-0 mt-0.5 bg-white p-0.5 shadow-xs">
                        <div className="w-2 h-2 rounded-full bg-emerald-600"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Pickup</p>
                        <p className="text-xs font-bold text-gray-900 truncate mt-0.5">{activeBookingData.pickup_address || pickup}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 border-t border-gray-100 pt-3">
                      <div className="w-5 h-5 rounded-full border-2 border-red-500 flex items-center justify-center shrink-0 mt-0.5 bg-white p-0.5 shadow-xs">
                        <div className="w-2 h-2 rounded-full bg-red-500"></div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black uppercase text-red-500 tracking-wider">Dropoff</p>
                        <p className="text-xs font-bold text-gray-900 truncate mt-0.5">{activeBookingData.dropoff_address || destination}</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-gray-600 font-bold">
                      <span>Distance:</span>
                      <span className="font-extrabold text-gray-900">{activeBookingData.distance_km || currentDist} km</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-500 font-bold">Total Fare:</span>
                      <span className="text-emerald-700 font-black text-base">
                        ₹{activeBookingData.total_fare || calculateFare(selectedRide, currentDist)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Safety & Share Links */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'My RaahGo Ride',
                          text: `I am on a RaahGo ride with Captain ${activeBookingData.driver_details?.captain_name || 'Partner'} (${activeBookingData.driver_details?.vehicle_number || 'DL 01 AB 1234'}). Tracking live!`,
                          url: window.location.href
                        }).catch(() => {});
                      } else {
                        navigator.clipboard?.writeText(window.location.href);
                        alert('Ride tracking link copied to clipboard!');
                      }
                    }}
                    className="flex-1 py-3 bg-white hover:bg-gray-50 active:scale-95 text-gray-800 font-extrabold text-xs rounded-2xl border border-gray-200 flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-gray-600" />
                    <span>Share Ride</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSosModal(true)}
                    className="flex-1 py-3 bg-red-50 hover:bg-red-100 active:scale-95 text-red-600 font-extrabold text-xs rounded-2xl border border-red-200 flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
                  >
                    <Shield className="w-4 h-4 text-red-600" />
                    <span>Safety Shield</span>
                  </button>
                </div>

                {/* Cancel Ride Option */}
                {activeBookingData.status !== 'In Trip' && (
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-3.5 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 font-extrabold text-xs rounded-2xl transition-all border border-gray-200 cursor-pointer text-center"
                  >
                    Cancel Ride Request
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* ═════════════════════════════════════════════════════════════════════ */
            /* 3. DEFAULT BOOKING INPUTS & FARE SELECTION FORM */
            /* ═════════════════════════════════════════════════════════════════════ */
            <>
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
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-32 space-y-4 scrollbar-none scroll-smooth">
                {/* Mobile Map View */}
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

                {/* Location Status / Alert Banner */}
                {locationStatus && !gpsVerified && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between gap-2.5 text-xs text-amber-700 font-bold animate-fade-in">
                    <div className="flex items-center gap-2 flex-1">
                      {isLocating ? (
                        <Loader2 className="w-4 h-4 shrink-0 text-amber-600 animate-spin" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                      )}
                      <span className="flex-1 text-xs">{locationStatus}</span>
                    </div>
                    {!isLocating && (
                      <button
                        type="button"
                        onClick={() => setLocationStatus('')}
                        className="p-1 hover:bg-amber-500/20 rounded-full text-amber-700 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Pickup & Drop Inputs Card */}
                <div className="glass-card rounded-[28px] p-4 space-y-3 relative border border-emerald-500/15 shadow-sm">
                  {/* Pickup Location Row */}
                  <div className="relative" ref={pickupContainerRef}>
                    <div className={`flex items-center gap-3 bg-white/90 p-3 rounded-2xl border transition-all ${
                      pickupError ? 'border-red-500 bg-red-500/5 ring-1 ring-red-500' : 'border-gray-200/80'
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
                      {/* GPS locate-me button */}
                      <button
                        type="button"
                        onClick={handleDetectGpsLocation}
                        disabled={isLocating}
                        title="Detect my current location"
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-none bg-emerald-50 hover:bg-emerald-100 active:scale-90 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {isLocating ? (
                          <Loader2 className="w-4 h-4 text-emerald-600 animate-spin" />
                        ) : (
                          <LocateFixed className="w-4 h-4 text-emerald-600" />
                        )}
                      </button>
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

                    {pickupError && (
                      <p className="text-xs font-extrabold text-red-500 mt-1.5 flex items-center gap-1.5 animate-fade-in pl-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0"></span>
                        <span>{pickupError}</span>
                      </p>
                    )}

                    {showPickupDropdown && (
                      <div className="absolute left-0 right-0 glass-panel border border-white/80 mt-2 rounded-2xl shadow-2xl z-50 max-h-56 overflow-y-auto text-left p-1.5 divide-y divide-gray-100/60">
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

                  <div className="border-t border-gray-100"></div>

                  {/* Drop Location Row */}
                  <div className="relative" ref={destContainerRef}>
                    <div className={`flex items-center gap-3 bg-white/90 p-3 rounded-2xl border transition-all ${
                      destError ? 'border-red-500 bg-red-500/5 ring-1 ring-red-500' : 'border-gray-200/80'
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

                {/* Vehicle Fare Options List */}
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
                            className={`p-3.5 rounded-2xl border flex items-center justify-between transition-all cursor-pointer ${
                              isSelected ? 'border-2 border-[#16A34A] bg-[#EEF8F2]/90 shadow-sm' : 'glass-card border-gray-200/80 hover:bg-emerald-50/30'
                            }`}
                          >
                            <div className="flex items-center gap-3.5">
                              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-white text-[#16A34A] shadow-sm border border-[#D2EDD9]' : 'bg-gray-100 text-gray-600'
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

                    {/* Payment Method Selection */}
                    <div className="space-y-2 pt-2 border-t border-gray-100">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-gray-800 uppercase tracking-wider block">
                          Payment Method
                        </label>
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {paymentMethod === 'COD' ? '💵 Cash' : paymentMethod === 'Online' ? '💳 Online / UPI' : '👛 RaahGo Wallet'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { id: 'COD', label: 'Cash', icon: '💵', desc: 'Pay captain direct' },
                          { id: 'Online', label: 'Online / UPI', icon: '💳', desc: 'UPI / Cards / Net' },
                          { id: 'RaahGo Wallet', label: 'Wallet', icon: '👛', desc: 'RaahGo Balance' },
                        ].map((pm) => {
                          const isSelected = paymentMethod === pm.id;
                          return (
                            <button
                              key={pm.id}
                              type="button"
                              onClick={() => setPaymentMethod(pm.id)}
                              className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                                isSelected
                                  ? 'border-2 border-[#16A34A] bg-[#EEF8F2] shadow-xs'
                                  : 'bg-white border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-lg">{pm.icon}</span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                                )}
                              </div>
                              <div className="mt-1">
                                <span className="font-extrabold text-xs text-gray-900 block leading-tight">
                                  {pm.label}
                                </span>
                                <span className="text-[10px] text-gray-500 block leading-tight mt-0.5">
                                  {pm.desc}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                  </div>
                )}

              </div>

              {/* Sticky Book Now button — always visible when fares are shown */}
              {showFares && !isSearchingDriver && !isAcceptedRide && (
                <div className="shrink-0 px-4 pb-5 pt-3 bg-gradient-to-t from-white via-white/95 to-transparent border-t border-gray-100">
                  <button
                    type="button"
                    onClick={handleBookRide}
                    disabled={isBooking}
                    className="w-full py-4 bg-gradient-to-r from-[#063B28] to-[#0D5B3E] hover:from-[#084A33] hover:to-[#106A49] text-white font-black text-base rounded-2xl shadow-xl shadow-[#063B28]/30 active:scale-[0.98] transition-all cursor-pointer border-none flex items-center justify-center gap-2"
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
            </>
          )}

        </div> {/* End of Left Sidebar */}

        {/* Right Area Desktop Map */}
        <div className="hidden lg:block flex-1 rounded-3xl overflow-hidden shadow-xl border border-gray-200 relative h-[calc(100vh-140px)] lg:mt-0 shrink-0 z-10">
          <RealtimeMap
            pickup={activeBookingData?.pickup_address || pickup}
            destination={activeBookingData?.dropoff_address || destination}
            pickupCoords={pickupCoords}
            destCoords={destCoords}
            mode={isAcceptedRide ? "tracking" : "booking"}
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

      </div>

      {/* Desktop Footer */}
      <div className="hidden lg:block shrink-0 w-full mt-auto">
        <Footer />
      </div>

      {/* Profile Menu Modal */}
      <CustomerProfileMenu
        isOpen={showProfileMenu}
        onClose={() => setShowProfileMenu(false)}
        user={user}
        onLogout={onLogout}
        activeNav="profile"
      />

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 4. EMERGENCY SOS SAFETY MODAL */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showSosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-red-200 space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto border-2 border-red-200">
              <Shield className="w-7 h-7 text-red-600 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-gray-900">RaahGo Safety Support</h3>
              <p className="text-xs text-gray-500 font-medium mt-1">
                Immediate 24x7 emergency response with live location sharing
              </p>
            </div>
            <div className="space-y-2.5 pt-2">
              <a
                href="tel:112"
                className="w-full py-3.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-sm rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 no-underline cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Call National Emergency (112)</span>
              </a>
              <a
                href="tel:+911800123456"
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-900 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-gray-200 no-underline cursor-pointer"
              >
                <Phone className="w-3.5 h-3.5" />
                <span>Call RaahGo Safety Helpline</span>
              </a>
            </div>
            <button
              type="button"
              onClick={() => setShowSosModal(false)}
              className="text-xs text-gray-400 font-bold hover:text-gray-700 mt-2 bg-transparent border-none cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 5. CANCEL RIDE CONFIRMATION MODAL */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-black text-gray-900">Cancel Ride Request?</h3>
                <p className="text-xs text-gray-500 font-medium">Please let us know the reason</p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {[
                'Change of plans',
                'Driver is taking too long',
                'Booked by mistake',
                'Found alternate transport'
              ].map((reason) => (
                <label
                  key={reason}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                    cancelReason === reason ? 'border-red-500 bg-red-50/50 text-red-700' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="cancel_reason"
                    checked={cancelReason === reason}
                    onChange={() => setCancelReason(reason)}
                    className="text-red-600 focus:ring-red-500"
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-800 font-extrabold text-xs rounded-xl border border-gray-200 cursor-pointer"
              >
                Keep Ride
              </button>
              <button
                type="button"
                onClick={handleConfirmCancel}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-md shadow-red-600/30 border-none cursor-pointer"
              >
                Cancel Ride
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* 6. TRIP COMPLETED & RATING MODAL */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {tripCompletedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-emerald-200 space-y-5 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-4 border-emerald-200">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-emerald-700 tracking-widest bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                TRIP COMPLETED
              </span>
              <h3 className="text-lg font-black text-gray-900 mt-2">You have arrived safely!</h3>
              <p className="text-xs text-gray-500 font-medium mt-0.5">
                Total fare: <strong className="text-emerald-700 text-sm">₹{activeBookingData?.total_fare || calculateFare(selectedRide, currentDist)}</strong> (Paid in Cash)
              </p>
            </div>

            {/* Star Rating Selection */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-gray-200 space-y-2">
              <p className="text-xs font-extrabold text-gray-700">Rate your experience with Captain</p>
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedRating(star)}
                    className="p-1 bg-transparent border-none cursor-pointer transform hover:scale-125 transition-transform"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        star <= selectedRating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Compliments Badges */}
            <div className="flex flex-wrap gap-2 justify-center">
              {['Polite Captain', 'Smooth Ride', 'Clean Vehicle', 'On Time'].map((tag) => {
                const isSelected = ratingCompliments.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      if (isSelected) {
                        setRatingCompliments(ratingCompliments.filter((t) => t !== tag));
                      } else {
                        setRatingCompliments([...ratingCompliments, tag]);
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-extrabold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={handleCompleteRating}
              className="w-full py-4 bg-[#063B28] hover:bg-[#084A33] active:scale-[0.98] text-white font-black text-sm rounded-2xl shadow-xl shadow-[#063B28]/25 border-none cursor-pointer"
            >
              Submit Feedback & Done
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
