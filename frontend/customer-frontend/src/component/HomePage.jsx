import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Navigation, Car, ShieldCheck, Clock, Search, ArrowRight, ArrowLeft, Star,
  CreditCard, Tag, CheckCircle2, ChevronRight, LogOut, User, RefreshCw, Zap,
  LocateFixed, Loader2, KeyRound, Lock, Unlock, AlertCircle, X, Menu, Ticket, Package,
  Apple, Play, Train, Luggage, Coins, Bell, Shield, Settings, ChevronLeft
} from 'lucide-react';
import { getDeviceGpsLocation, reverseGeocodeGps } from '../common/locationService';
import { fetchWithAuth } from '../common/apiClient';
import Navbar from './Navbar';
import Footer from './Footer';
import CustomerProfileMenu from './CustomerProfileMenu';

export default function HomePage({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('home');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [currentGpsName, setCurrentGpsName] = useState('');
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [drop, setDrop] = useState('');
  const [dropCoords, setDropCoords] = useState(null);
  const [rideHistory, setRideHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const [pickupSuggestions, setPickupSuggestions] = useState([]);
  const [dropSuggestions, setDropSuggestions] = useState([]);
  const [isSearchingPickup, setIsSearchingPickup] = useState(false);
  const [isSearchingDrop, setIsSearchingDrop] = useState(false);

  const pickupTimeoutRef = useRef(null);
  const dropTimeoutRef = useRef(null);

  const miniMapRef = useRef(null);
  const miniMapInstance = useRef(null);
  const [miniMapLoaded, setMiniMapLoaded] = useState(false);

  const [sheetHeight, setSheetHeight] = useState(60);
  const [isDraggingSheet, setIsDraggingSheet] = useState(false);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(60);

  const handleTouchStart = (e) => {
    setIsDraggingSheet(true);
    dragStartY.current = e.touches[0].clientY;
    dragStartHeight.current = sheetHeight;
  };

  const handleTouchMove = (e) => {
    if (!isDraggingSheet) return;
    const deltaY = dragStartY.current - e.touches[0].clientY;
    const windowHeight = window.innerHeight;
    const deltaPercent = (deltaY / windowHeight) * 100;
    const newHeight = Math.min(80, Math.max(60, dragStartHeight.current + deltaPercent));
    setSheetHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDraggingSheet(false);
    setSheetHeight(prev => (prev > 70 ? 80 : 60));
  };

  const toggleSheetHeight = () => {
    setSheetHeight(prev => (prev >= 70 ? 60 : 80));
  };

  // Load Leaflet dynamically for Mini Map preview
  useEffect(() => {
    if (window.L) {
      setMiniMapLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => {
      setMiniMapLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Auto-detect GPS location on home mount
  useEffect(() => {
    const detectGps = async () => {
      setIsLocatingGps(true);
      try {
        const loc = await getDeviceGpsLocation();
        if (loc) {
          setCurrentGpsName(loc.address);
          setPickupCoords({ lat: loc.lat, lng: loc.lon });
          setPickup(loc.address);
          if (miniMapInstance.current) {
            adjustMapView({ lat: loc.lat, lng: loc.lon }, sheetHeight);
          }
        } else {
          setCurrentGpsName('📍 Enable location to auto-detect');
        }
      } catch (err) {
        console.log('GPS home notice:', err);
        setCurrentGpsName('📍 Enable location to auto-detect');
      } finally {
        setIsLocatingGps(false);
      }
    };
    detectGps();
  }, []);

  const handleReLocateGps = async () => {
    setIsLocatingGps(true);
    setCurrentGpsName('Locating GPS...');
    try {
      const loc = await getDeviceGpsLocation();
      if (loc) {
        setCurrentGpsName(loc.address);
        setPickupCoords({ lat: loc.lat, lng: loc.lon });
        setPickup(loc.address);
        if (miniMapInstance.current) {
          adjustMapView({ lat: loc.lat, lng: loc.lon }, sheetHeight);
        }
      } else {
        setCurrentGpsName('📍 Enable location to auto-detect');
      }
    } catch (err) {
      console.log('GPS relocate error:', err);
      setCurrentGpsName('📍 Enable location to auto-detect');
    } finally {
      setIsLocatingGps(false);
    }
  };

  // Helper to adjust map view so user marker stays centered in the visible top section above the bottom sheet
  const adjustMapView = (coords, heightPercent) => {
    if (!miniMapInstance.current || !window.L) return;
    const map = miniMapInstance.current;
    const L = window.L;
    const pLat = coords?.lat || pickupCoords?.lat || 28.440886;
    const pLng = coords?.lng || pickupCoords?.lng || 77.038938;
    const hPercent = heightPercent !== undefined ? heightPercent : sheetHeight;

    const windowH = window.innerHeight || 700;
    const visibleH = windowH * ((100 - hPercent) / 100);
    // Position the marker vertically centered in visible area, keeping pin + badge fully above bottom sheet div
    const targetPixelY = Math.max(70, visibleH / 2 - 12);
    const pixelOffsetY = (windowH / 2) - targetPixelY;

    const zoom = map.getZoom() || 15;
    const targetPoint = map.project(L.latLng(pLat, pLng), zoom);
    const targetCenterPoint = L.point(targetPoint.x, targetPoint.y + pixelOffsetY);
    const targetCenterLatLng = map.unproject(targetCenterPoint, zoom);

    map.setView(targetCenterLatLng, zoom, { animate: true });
  };

  // Instantiate Map for Mobile Background
  useEffect(() => {
    if (!miniMapLoaded || !miniMapRef.current || miniMapInstance.current) return;
    const L = window.L;
    if (!L) return;

    const pLat = pickupCoords?.lat || 28.440886;
    const pLng = pickupCoords?.lng || 77.038938;

    const map = L.map(miniMapRef.current, {
      center: [pLat, pLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      touchZoom: true
    });

    L.tileLayer('/api/v1/services/tiles/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      setPickupCoords({ lat, lng });
      setCurrentGpsName('Detecting location...');
      setIsGeocoding(true);
      try {
        const address = await reverseGeocodeGps(lat, lng);
        setCurrentGpsName(address);
        setPickup(address);
      } catch (err) {
        console.error('Reverse geocode error:', err);
        setCurrentGpsName(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } finally {
        setIsGeocoding(false);
      }
    });

    map.on('dragend', async () => {
      const windowH = window.innerHeight || 700;
      const windowW = window.innerWidth || 360;
      const visibleH = windowH * ((100 - sheetHeight) / 100);
      const targetPixelY = Math.max(50, visibleH / 2 + 10);
      const centerPoint = L.point(windowW / 2, targetPixelY);
      const newLatLng = map.containerPointToLatLng(centerPoint);

      setPickupCoords({ lat: newLatLng.lat, lng: newLatLng.lng });
      setCurrentGpsName('Detecting location...');
      setIsGeocoding(true);
      try {
        const address = await reverseGeocodeGps(newLatLng.lat, newLatLng.lng);
        setCurrentGpsName(address);
        setPickup(address);
      } catch (err) {
        console.error('Reverse geocode error:', err);
        setCurrentGpsName(`Location (${newLatLng.lat.toFixed(4)}, ${newLatLng.lng.toFixed(4)})`);
      } finally {
        setIsGeocoding(false);
      }
    });

    miniMapInstance.current = map;

    setTimeout(() => {
      if (miniMapInstance.current) {
        miniMapInstance.current.invalidateSize();
        adjustMapView({ lat: pLat, lng: pLng }, sheetHeight);
      }
    }, 200);

    return () => {
      if (miniMapInstance.current) {
        miniMapInstance.current.remove();
        miniMapInstance.current = null;
      }
    };
  }, [miniMapLoaded]);

  // Update Map position when pickupCoords or sheetHeight changes
  useEffect(() => {
    if (miniMapInstance.current && window.L) {
      miniMapInstance.current.invalidateSize();
      adjustMapView(pickupCoords, sheetHeight);
    }
  }, [pickupCoords, sheetHeight]);

  // Fetch history on mount and when tab is switched to activity
  useEffect(() => {
    if (user) {
      fetchRideHistory();
    }
  }, [user, activeTab]);

  const fetchRideHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetchWithAuth('/api/v1/bookings/bookings/');
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

  // Dynamic last 3 recent unique destination rides
  const recentRides = useMemo(() => {
    if (!rideHistory || rideHistory.length === 0) {
      return [
        {
          id: 'mock-1',
          title: 'Cyber City Building 10',
          subtitle: 'DLF Phase 2, Gurugram',
          fullAddress: 'Cyber City Building 10, DLF Phase 2, Gurugram, Haryana'
        },
        {
          id: 'mock-2',
          title: 'City Center Mall',
          subtitle: 'MG Road, Sector 28',
          fullAddress: 'City Center Mall, MG Road, Sector 28, Gurugram'
        },
        {
          id: 'mock-3',
          title: 'Huda City Metro Station',
          subtitle: 'Sector 29, Gurugram',
          fullAddress: 'Huda City Metro Station, Sector 29, Gurugram'
        }
      ];
    }

    const seen = new Set();
    const list = [];
    for (const r of rideHistory) {
      const drop = r.dropoff_address || r.dropoff;
      if (drop && !seen.has(drop.trim())) {
        seen.add(drop.trim());
        const parts = drop.split(',');
        const title = parts[0]?.trim() || drop;
        const subtitle = parts.slice(1, 3).join(',')?.trim() || parts.slice(1).join(',')?.trim() || 'Saved Destination';
        list.push({
          id: r.id,
          title,
          subtitle,
          fullAddress: drop,
          dropCoords: r.dropoff_latitude && r.dropoff_longitude ? {
            lat: parseFloat(r.dropoff_latitude),
            lng: parseFloat(r.dropoff_longitude)
          } : null,
          pickupAddress: r.pickup_address || r.pickup,
          pickupCoords: r.pickup_latitude && r.pickup_longitude ? {
            lat: parseFloat(r.pickup_latitude),
            lng: parseFloat(r.pickup_longitude)
          } : null
        });
        if (list.length >= 3) break;
      }
    }
    return list;
  }, [rideHistory]);

  const fetchSuggestions = async (query, type) => {
    if (!query || query.length < 3) {
      if (type === 'pickup') setPickupSuggestions([]);
      else setDropSuggestions([]);
      return;
    }
    
    if (type === 'pickup') setIsSearchingPickup(true);
    else setIsSearchingDrop(true);

    try {
      let url = `/api/v1/bookings/location-suggestions/?q=${encodeURIComponent(query)}`;
      if (pickupCoords) {
        url += `&lat=${pickupCoords.lat}&lon=${pickupCoords.lng}`;
      }
      const res = await fetchWithAuth(url);
      if (res.ok) {
        const data = await res.json();
        if (type === 'pickup') setPickupSuggestions(data.suggestions || []);
        else setDropSuggestions(data.suggestions || []);
      }
    } catch (e) {
      console.log('Error fetching suggestions', e);
    } finally {
      if (type === 'pickup') setIsSearchingPickup(false);
      else setIsSearchingDrop(false);
    }
  };

  const handlePickupChange = (e) => {
    const val = e.target.value;
    setPickup(val);
    
    if (pickupTimeoutRef.current) clearTimeout(pickupTimeoutRef.current);
    pickupTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(val, 'pickup');
    }, 600);
  };

  const handleDropChange = (e) => {
    const val = e.target.value;
    setDrop(val);
    
    if (dropTimeoutRef.current) clearTimeout(dropTimeoutRef.current);
    dropTimeoutRef.current = setTimeout(() => {
      fetchSuggestions(val, 'drop');
    }, 600);
  };

  const handleSelectPickup = (item) => {
    setPickup(item.display_name);
    setPickupCoords({ lat: item.lat, lng: item.lon });
    setPickupSuggestions([]);
  };

  const handleSelectDrop = (item) => {
    setDrop(item.display_name);
    setDropCoords({ lat: item.lat, lng: item.lon });
    setDropSuggestions([]);
  };

  const handleDesktopBookRide = (e) => {
    e.preventDefault();
    
    if (!pickup || !pickup.trim() || !drop || !drop.trim()) {
      alert("Please enter both Pickup and Drop locations to continue.");
      return;
    }

    navigate('/book-ride', { 
      state: { 
        prefillPickup: pickup, 
        prefillDrop: drop,
        pickupCoords: pickupCoords,
        dropCoords: dropCoords
      } 
    });
  };

  return (
    <div className="w-full bg-white font-sans text-gray-900 overflow-x-hidden min-h-screen">
      
      {/* 
        ============================================================
        MOBILE / TABLET LAYOUT (Hidden on Desktop)
        ============================================================
      */}
      <div className="block lg:hidden relative h-screen w-full bg-gray-100 overflow-hidden">
        
        {/* Fullscreen Map Background */}
        <div ref={miniMapRef} className="absolute inset-0 w-full h-full z-0"></div>

        {/* Floating Center Pickup Pin Overlay - Always 100% visible in open map viewport */}
        <div 
          style={{ 
            top: `calc(${((100 - sheetHeight) / 2)}% + 15px)` 
          }}
          className="absolute left-1/2 -translate-x-1/2 -translate-y-full z-10 pointer-events-none flex flex-col items-center transition-all duration-300"
        >
          <div className="bg-gray-900 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-xl mb-1 border border-white/20 flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <span>Pickup Point</span>
          </div>
          <div className="w-9 h-9 bg-green-500 text-white rounded-full border-2 border-white shadow-2xl flex items-center justify-center font-bold text-base">
            📍
          </div>
          <div className="w-3.5 h-1 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>
        </div>

        {/* Top Floating Location Search Bar with Profile / Menu Button */}
        <div className="absolute top-4 left-4 right-4 z-30 flex items-center justify-between pointer-events-none gap-2">
          
          {/* Profile / Menu Button */}
          <button
            onClick={() => setShowProfileModal(true)}
            className="w-11 h-11 glass-panel rounded-full flex items-center justify-center shadow-lg pointer-events-auto text-[#063B28] hover:bg-white active:scale-95 transition-all border border-white/80 shrink-0 cursor-pointer"
            title="Open Profile Menu"
          >
            <div className="w-7 h-7 rounded-full bg-[#063B28] text-white font-black text-xs flex items-center justify-center shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : '👤'}
            </div>
          </button>

          <div 
            onClick={() => navigate('/book-ride')}
            className="flex-1 glass-panel rounded-full px-4 py-3 shadow-lg pointer-events-auto flex items-center gap-2.5 cursor-pointer hover:bg-white/95 transition-all border border-white/80"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
            <span className="text-xs font-bold text-gray-900 truncate">
              {isLocatingGps ? 'Locating GPS...' : isGeocoding ? 'Detecting place...' : (currentGpsName || 'Locating...')}
            </span>
          </div>
          <button 
            onClick={handleReLocateGps}
            disabled={isLocatingGps}
            title="Re-center Current GPS Location"
            className="w-11 h-11 glass-panel rounded-full flex items-center justify-center shadow-lg pointer-events-auto text-[#063B28] hover:bg-white active:scale-95 transition-all border border-white/80 shrink-0 cursor-pointer"
          >
            {isLocatingGps ? (
              <Loader2 className="w-5 h-5 text-emerald-600 animate-spin" />
            ) : (
              <LocateFixed className="w-5 h-5 text-emerald-600" />
            )}
          </button>
        </div>

        {/* Scrollable Bottom Sheet Content */}
        <div 
          style={{ height: `${sheetHeight}%` }}
          className={`absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-2xl rounded-t-[36px] shadow-[0_-15px_50px_rgba(0,0,0,0.12)] border-t border-white/80 z-20 flex flex-col transition-all ${isDraggingSheet ? 'duration-0' : 'duration-300'}`}
        >
          
          {/* Drag handle */}
          <div 
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={toggleSheetHeight}
            className="w-full flex flex-col items-center pt-3.5 pb-2 shrink-0 cursor-pointer touch-none"
            title="Drag or tap to expand/collapse"
          >
            <div className="w-12 h-1.5 bg-gray-300/80 rounded-full hover:bg-gray-400 transition-colors"></div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-none">
            
            {activeTab === 'home' && (
              <div className="space-y-6 animate-fade-in pt-2">
                {/* Search Bar */}
                <div 
                  onClick={() => navigate('/book-ride')}
                  className="w-full bg-white/90 border-2 border-emerald-500/20 hover:border-emerald-500/50 shadow-md shadow-emerald-500/5 rounded-full px-5 py-4 flex items-center gap-3 cursor-pointer transition-all hover:scale-[1.01]"
                >
                  <Search className="w-5 h-5 text-emerald-600" />
                  <span className="text-base sm:text-lg font-extrabold text-gray-900">Where do you want to go?</span>
                </div>

                {/* Recent Locations (Last 3 Recent Rides Max) */}
                {recentRides.length > 0 && (
                  <div className="space-y-1.5 px-1">
                    <div className="flex items-center justify-between px-1 mb-0.5">
                      <span className="text-[11px] font-black text-gray-400 uppercase tracking-wider">
                        Recent Trips ({recentRides.length})
                      </span>
                    </div>
                    {recentRides.map((ride, idx) => (
                      <div
                        key={ride.id || idx}
                        className="flex items-center gap-3.5 cursor-pointer hover:bg-emerald-50/60 p-2.5 rounded-2xl transition-all border border-transparent hover:border-emerald-200/60 active:scale-[0.99]"
                        onClick={() => navigate('/book-ride', {
                          state: {
                            prefillDest: ride.fullAddress,
                            prefillDrop: ride.fullAddress,
                            dropCoords: ride.dropCoords,
                            prefillPickup: ride.pickupAddress,
                            pickupCoords: ride.pickupCoords
                          }
                        })}
                      >
                        <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200/60 text-gray-600">
                          <Clock className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="flex-1 min-w-0 border-b border-gray-100/80 pb-1.5">
                          <p className="font-bold text-gray-900 text-sm truncate">{ride.title}</p>
                          <p className="text-xs text-gray-500 font-medium truncate mt-0.5">{ride.subtitle}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Services Section */}
                <div className="pt-1">
                  <h3 className="text-xs font-black text-gray-400 mb-3 uppercase tracking-wider">Everything In Minutes</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Bike Ride */}
                    <div 
                      onClick={() => navigate('/book-ride', { state: { selectedRide: 'bike' } })}
                      className="bg-gradient-to-br from-white/95 to-emerald-50/60 rounded-3xl p-4 flex flex-col justify-between h-32 border border-emerald-100/70 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer relative overflow-hidden"
                    >
                      <div>
                        <p className="text-xs text-emerald-700 font-bold uppercase tracking-wider">Fastest</p>
                        <h4 className="text-lg font-black text-gray-900 leading-tight">Bike Taxi</h4>
                      </div>
                      <div className="absolute bottom-2 right-2 text-4xl">🏍️</div>
                    </div>

                    {/* Auto / Rickshaw */}
                    <div 
                      onClick={() => navigate('/book-ride', { state: { selectedRide: 'auto' } })}
                      className="bg-gradient-to-br from-white/95 to-amber-50/60 rounded-3xl p-4 flex flex-col justify-between h-32 border border-amber-100/70 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer relative overflow-hidden"
                    >
                      <div>
                        <p className="text-xs text-amber-700 font-bold uppercase tracking-wider">Reliable</p>
                        <h4 className="text-lg font-black text-gray-900 leading-tight">Auto &<br/>Rickshaw</h4>
                      </div>
                      <div className="absolute bottom-2 right-2 text-4xl">🛺</div>
                    </div>

                    {/* Metro Tickets */}
                    <div 
                      onClick={() => alert('Metro ticket booking is coming soon!')}
                      className="bg-gradient-to-br from-white/95 to-blue-50/60 rounded-3xl p-4 flex flex-col justify-between h-32 border border-blue-100/70 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer relative overflow-hidden"
                    >
                      <div>
                        <p className="text-xs text-blue-700 font-bold uppercase tracking-wider">Transit</p>
                        <h4 className="text-lg font-black text-gray-900 leading-tight">Metro Tickets</h4>
                      </div>
                      <Ticket className="w-10 h-10 text-blue-500 absolute bottom-3 right-3 opacity-80" />
                    </div>

                    {/* Parcel */}
                    <div 
                      onClick={() => alert('Parcel dispatch is coming soon!')}
                      className="bg-gradient-to-br from-white/95 to-purple-50/60 rounded-3xl p-4 flex flex-col justify-between h-32 border border-purple-100/70 shadow-sm hover:shadow-md transition-all hover:scale-[1.02] cursor-pointer relative overflow-hidden"
                    >
                      <div>
                        <p className="text-xs text-purple-700 font-bold uppercase tracking-wider">Delivery</p>
                        <h4 className="text-lg font-black text-gray-900 leading-tight">Send Parcel</h4>
                      </div>
                      <Package className="w-10 h-10 text-purple-500 absolute bottom-3 right-3 opacity-80" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Profile Tab Mobile */}
            {activeTab === 'profile' && (
              <div className="space-y-5 animate-fade-in pt-4">
                <h3 className="text-2xl font-black text-gray-900">Profile</h3>
                {user ? (
                  <div className="space-y-4">
                    <div className="glass-card rounded-3xl p-5 flex items-center gap-4 border border-white/80">
                      <div className="w-16 h-16 rounded-full bg-[#063B28] text-white font-black text-2xl flex items-center justify-center shadow-md">
                        {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div>
                        <h4 className="text-xl font-black text-gray-900">{user.name}</h4>
                        <p className="text-sm text-gray-500 font-bold">{user.identifier || user.email || user.phone_number}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="w-full py-4 bg-red-50 hover:bg-red-100 text-red-600 font-black text-sm rounded-2xl transition-all cursor-pointer border-none flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="glass-card rounded-3xl p-6 text-center space-y-4 border border-white/80">
                    <User className="w-12 h-12 text-gray-300 mx-auto" />
                    <h4 className="text-base font-black text-gray-900">Guest User</h4>
                    <p className="text-sm text-gray-500 font-medium">Log in to manage your rides.</p>
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full py-3.5 bg-[#063B28] hover:bg-[#084A33] text-white font-black text-sm rounded-2xl cursor-pointer shadow-md"
                    >
                      Log In
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Glassmorphic Bottom Tab Bar matching the 5 items in image */}
        <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-white border-t border-gray-100 flex items-center justify-around z-40 pb-1 shadow-[0_-5px_25px_rgba(0,0,0,0.06)]">
          
          {/* 1. Ride */}
          <button 
            onClick={() => setActiveTab('home')} 
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none w-16 ${
              activeTab === 'home' ? 'text-[#063B28]' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            <Navigation className={`w-5 h-5 ${activeTab === 'home' ? 'stroke-[2.5] text-[#063B28]' : 'stroke-[1.8]'}`} />
            <span className={`text-[11px] ${activeTab === 'home' ? 'font-black text-[#063B28]' : 'font-bold text-gray-500'}`}>Ride</span>
          </button>

          {/* 2. Metro */}
          <button 
            onClick={() => alert('Metro ticket booking is launching soon!')} 
            className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none text-gray-400 hover:text-gray-600 w-16"
          >
            <Train className="w-5 h-5 stroke-[1.8]" />
            <span className="text-[11px] font-bold text-gray-500">Metro</span>
          </button>

          {/* 3. Parcel */}
          <button 
            onClick={() => alert('Parcel delivery service is launching soon!')} 
            className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none text-gray-400 hover:text-gray-600 w-16"
          >
            <Package className="w-5 h-5 stroke-[1.8]" />
            <span className="text-[11px] font-bold text-gray-500">Parcel</span>
          </button>

          {/* 4. Travel */}
          <button 
            onClick={() => alert('Outstation & airport travel bookings launching soon!')} 
            className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none text-gray-400 hover:text-gray-600 w-16"
          >
            <Luggage className="w-5 h-5 stroke-[1.8]" />
            <span className="text-[11px] font-bold text-gray-500">Travel</span>
          </button>

          {/* 5. Profile */}
          <button 
            onClick={() => setShowProfileModal(true)} 
            className="flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none w-16 text-gray-900"
          >
            <User className="w-5 h-5 stroke-[2] text-gray-900" />
            <span className="text-[11px] font-black text-gray-900">Profile</span>
          </button>
        </div>

        {/* Customer Profile Modal Popup */}
        <CustomerProfileMenu
          isOpen={showProfileModal}
          onClose={() => setShowProfileModal(false)}
          user={user}
          onLogout={onLogout}
          activeNav="profile"
        />
      </div>


      {/* 
        ============================================================
        DESKTOP / WEB LAYOUT (Hidden on Mobile)
        ============================================================
      */}
      <div className="hidden lg:block w-full min-h-screen relative">
        
        {/* Top Navbar */}
        <Navbar user={user} onLogout={onLogout} />

        {/* Hero Section */}
        <section className="w-full bg-gradient-to-b from-gray-50 to-white pt-16 pb-24">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-12">
            
            {/* Left Column: Heading & Form */}
            <div className="w-1/2 space-y-8">
              <div className="space-y-4">
                <h1 className="text-6xl font-black text-gray-900 leading-tight">
                  India's #1<br/>Ride-hailing App
                </h1>
                <p className="text-xl text-gray-600 font-medium">Quick, Affordable rides at your doorstep</p>
              </div>

              {/* Desktop Booking Form */}
              <form onSubmit={handleDesktopBookRide} className="bg-white rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.08)] border border-gray-100 space-y-4 max-w-md relative z-10">
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-gray-900 rounded-full"></div>
                  <input 
                    type="text" 
                    placeholder="Enter Pickup Location" 
                    value={pickup}
                    onChange={handlePickupChange}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-10 text-gray-900 font-bold focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                  />
                  {pickup && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickup('');
                        setPickupCoords(null);
                        setPickupSuggestions([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title="Clear pickup"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {isSearchingPickup && !pickup && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>}
                  
                  {pickupSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                      {pickupSuggestions.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleSelectPickup(item)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                        >
                          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                          <div className="truncate">
                            <p className="text-sm font-bold text-gray-900 truncate">{item.display_name.split(',')[0]}</p>
                            <p className="text-xs text-gray-500 truncate">{item.display_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 w-2.5 h-2.5 border-2 border-gray-900 bg-white rounded-full"></div>
                  <input 
                    type="text" 
                    placeholder="Enter Drop Location" 
                    value={drop}
                    onChange={handleDropChange}
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-10 text-gray-900 font-bold focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                  />
                  {drop && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrop('');
                        setDropCoords(null);
                        setDropSuggestions([]);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-200 transition-colors border-none bg-transparent cursor-pointer flex items-center justify-center"
                      title="Clear drop"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {isSearchingDrop && !drop && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>}
                  
                  {dropSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden z-50">
                      {dropSuggestions.map((item, idx) => (
                        <div 
                          key={idx} 
                          onClick={() => handleSelectDrop(item)}
                          className="px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 flex items-center gap-3"
                        >
                          <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                          <div className="truncate">
                            <p className="text-sm font-bold text-gray-900 truncate">{item.display_name.split(',')[0]}</p>
                            <p className="text-xs text-gray-500 truncate">{item.display_name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-yellow-400 hover:bg-yellow-500 text-black font-black text-lg rounded-xl transition-colors mt-2"
                >
                  Book Ride
                </button>
              </form>
            </div>

            {/* Right Column: Hero Graphic */}
            <div className="w-1/2 relative h-[500px]">
              <div className="absolute inset-0 bg-blue-50/50 rounded-[40px] overflow-hidden flex items-end justify-center p-8 border border-gray-100 shadow-2xl">
                {/* Decorative Elements */}
                <div className="absolute top-10 right-10 w-32 h-32 bg-yellow-400/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-10 left-10 w-40 h-40 bg-blue-400/20 rounded-full blur-3xl"></div>
                
                {/* Placeholder for Auto/Car Graphic */}
                <div className="relative z-10 w-full h-full flex flex-col items-center justify-center space-y-6">
                  <div className="flex items-center gap-6">
                    <div className="w-32 h-32 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center transform -rotate-6">
                      <span className="text-5xl">🏍️</span>
                      <span className="font-black text-gray-900 mt-2">Bike</span>
                    </div>
                    <div className="w-40 h-40 bg-yellow-400 rounded-2xl shadow-xl flex flex-col items-center justify-center transform scale-110 z-10">
                      <span className="text-6xl">🛺</span>
                      <span className="font-black text-gray-900 mt-2 text-xl">Auto</span>
                    </div>
                    <div className="w-32 h-32 bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col items-center justify-center transform rotate-6">
                      <span className="text-5xl">🚕</span>
                      <span className="font-black text-gray-900 mt-2">Cab</span>
                    </div>
                  </div>
                  <div className="bg-gray-900/5 backdrop-blur-sm px-6 py-3 rounded-full text-gray-600 font-bold">
                    Join 10+ Million Happy Customers
                  </div>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Services Grid Section */}
        <section className="w-full bg-white py-24 border-t border-gray-100">
          <div className="max-w-7xl mx-auto px-6">
            <h2 className="text-4xl font-black text-gray-900 mb-12">
              Our Services
              <div className="w-16 h-1 bg-yellow-400 mt-4 rounded-full"></div>
            </h2>

            <div className="grid grid-cols-3 gap-8">
              {/* Bike Taxi */}
              <div className="bg-gray-50 hover:bg-white hover:shadow-xl hover:-translate-y-1 border border-gray-100 rounded-3xl p-8 transition-all duration-300 flex items-center justify-between group cursor-pointer">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Bike-Taxi</h3>
                  <p className="text-gray-500 font-medium">Beat traffic, ride quicker</p>
                </div>
                <div className="text-6xl group-hover:scale-110 transition-transform">🏍️</div>
              </div>

              {/* Auto */}
              <div className="bg-gray-50 hover:bg-white hover:shadow-xl hover:-translate-y-1 border border-gray-100 rounded-3xl p-8 transition-all duration-300 flex items-center justify-between group cursor-pointer">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Auto</h3>
                  <p className="text-gray-500 font-medium">Everyday autos, made easy</p>
                </div>
                <div className="text-6xl group-hover:scale-110 transition-transform">🛺</div>
              </div>

              {/* Cab */}
              <div className="bg-gray-50 hover:bg-white hover:shadow-xl hover:-translate-y-1 border border-gray-100 rounded-3xl p-8 transition-all duration-300 flex items-center justify-between group cursor-pointer">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Cab</h3>
                  <p className="text-gray-500 font-medium">Comfort for every journey</p>
                </div>
                <div className="text-6xl group-hover:scale-110 transition-transform">🚗</div>
              </div>

              {/* Parcel */}
              <div className="bg-gray-50 hover:bg-white hover:shadow-xl hover:-translate-y-1 border border-gray-100 rounded-3xl p-8 transition-all duration-300 flex items-center justify-between group cursor-pointer">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Parcel</h3>
                  <p className="text-gray-500 font-medium">Quick & insured deliveries</p>
                </div>
                <div className="text-6xl group-hover:scale-110 transition-transform">📦</div>
              </div>

              {/* Travel */}
              <div className="bg-gray-50 hover:bg-white hover:shadow-xl hover:-translate-y-1 border border-gray-100 rounded-3xl p-8 transition-all duration-300 flex items-center justify-between group cursor-pointer">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Travel & Stay</h3>
                  <p className="text-gray-500 font-medium">One app, entire journey</p>
                </div>
                <div className="text-6xl group-hover:scale-110 transition-transform">🌴</div>
              </div>

              {/* Metro */}
              <div className="bg-gray-50 hover:bg-white hover:shadow-xl hover:-translate-y-1 border border-gray-100 rounded-3xl p-8 transition-all duration-300 flex items-center justify-between group cursor-pointer">
                <div>
                  <h3 className="text-2xl font-black text-gray-900 mb-2">Metro Ticket</h3>
                  <p className="text-gray-500 font-medium">Rides to and from metro</p>
                </div>
                <div className="text-6xl group-hover:scale-110 transition-transform">🚇</div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer CTA Section */}
        <section className="w-full bg-[#1A365D] py-20 text-white">
          <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
            <div className="w-1/2 space-y-6">
              <h2 className="text-5xl font-black mb-2">
                Earn with RaahGo
                <div className="w-20 h-1.5 bg-yellow-400 mt-4 rounded-full"></div>
              </h2>
              <p className="text-xl text-blue-100 leading-relaxed font-medium">
                Become a RaahGo Captain. Ride when you want, work how you want, and earn on your own terms.
              </p>
              <button className="px-8 py-4 bg-yellow-400 hover:bg-yellow-500 text-black font-black text-lg rounded-xl transition-colors mt-4">
                Sign Up as Captain
              </button>
            </div>
            <div className="w-5/12 h-[300px] bg-blue-800/50 rounded-3xl border border-blue-400/20 overflow-hidden relative flex flex-col items-center justify-center">
               <div className="absolute inset-0 flex items-center justify-center opacity-20">
                 <div className="w-64 h-64 border-4 border-yellow-400 rounded-full animate-ping"></div>
               </div>
               <span className="text-7xl z-10">🤑</span>
               <span className="text-xl font-bold mt-4 z-10 text-blue-100">Zero Commission First Month</span>
            </div>
          </div>
        </section>

        {/* Download Now Section */}
        <section className="w-full bg-gray-50 py-24">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-4xl font-black text-gray-900 inline-block relative mb-16">
              Download Now
              <div className="absolute -bottom-4 left-0 right-0 h-1 bg-yellow-400"></div>
            </h2>

            <div className="flex items-center justify-center gap-8 max-w-4xl mx-auto">
              {/* Customer App Card */}
              <div className="flex-1 bg-white rounded-[32px] p-8 shadow-xl flex items-center gap-6 border border-gray-100 cursor-pointer hover:-translate-y-1 transition-transform">
                <div className="w-32 h-16 bg-yellow-400 rounded-full flex items-center justify-center shadow-inner relative overflow-hidden">
                   <span className="font-black text-xl text-black relative z-10 tracking-tight">RaahGo</span>
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">Bike-Taxi,<br/>Auto & Cabs</h3>
                </div>
              </div>

              {/* Captain App Card */}
              <div className="flex-1 bg-white rounded-[32px] p-8 shadow-xl flex items-center gap-6 border border-gray-100 cursor-pointer hover:-translate-y-1 transition-transform">
                <div className="w-32 h-16 bg-yellow-400 rounded-full flex flex-col items-center justify-center shadow-inner relative overflow-hidden">
                   <span className="font-black text-xl text-black relative z-10 tracking-tight leading-none">RaahGo</span>
                   <span className="text-[10px] font-bold text-black relative z-10 uppercase tracking-widest mt-0.5">Captain</span>
                </div>
                <div className="text-left">
                  <h3 className="text-xl font-bold text-gray-900 leading-tight">Drive &<br/>Earn</h3>
                </div>
              </div>
            </div>
          </div>
        </section>

        <Footer />

      </div>
    </div>
  );
}
