import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Navigation, Car, ShieldCheck, Clock, Search, ArrowRight, ArrowLeft, Star,
  CreditCard, Tag, CheckCircle2, ChevronRight, LogOut, User, RefreshCw, Zap,
  LocateFixed, Loader2, KeyRound, Lock, Unlock, AlertCircle, X, Menu, Ticket, Package,
  Apple, Play
} from 'lucide-react';
import { getDeviceGpsLocation } from '../common/locationService';
import { fetchWithAuth } from '../common/apiClient';
import Navbar from './Navbar';
import Footer from './Footer';

export default function HomePage({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('home');
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [currentGpsName, setCurrentGpsName] = useState('');
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
      try {
        const loc = await getDeviceGpsLocation();
        setCurrentGpsName(loc.address);
        setPickupCoords({ lat: loc.lat, lng: loc.lon });
      } catch (err) {
        console.log('GPS home notice:', err);
      }
    };
    detectGps();
  }, []);

  // Instantiate Map for Mobile Background
  useEffect(() => {
    if (!miniMapLoaded || !miniMapRef.current || miniMapInstance.current) return;
    const L = window.L;
    if (!L) return;

    const pLat = pickupCoords?.lat || 28.6139;
    const pLng = pickupCoords?.lng || 77.2090;

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

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const amberIcon = L.divIcon({
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
          <div style="position: absolute; width: 30px; height: 30px; background: rgba(34, 197, 94, 0.2); border-radius: 50%; animation: ping 1.5s infinite;"></div>
          <div style="background-color: #22C55E; color: white; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 5;"></div>
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    L.marker([pLat, pLng], { icon: amberIcon }).addTo(map);
    miniMapInstance.current = map;

    setTimeout(() => {
      if (miniMapInstance.current) {
        miniMapInstance.current.invalidateSize();
      }
    }, 200);

    return () => {
      if (miniMapInstance.current) {
        miniMapInstance.current.remove();
        miniMapInstance.current = null;
      }
    };
  }, [miniMapLoaded]);

  // Update Map position when pickupCoords changes
  useEffect(() => {
    if (miniMapInstance.current) {
      const L = window.L;
      if (!L) return;

      const pLat = pickupCoords?.lat || 28.6139;
      const pLng = pickupCoords?.lng || 77.2090;

      miniMapInstance.current.invalidateSize();
      miniMapInstance.current.setView([pLat, pLng], 15);

      miniMapInstance.current.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          miniMapInstance.current.removeLayer(layer);
        }
      });

      const amberIcon = L.divIcon({
        html: `
          <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            <div style="position: absolute; width: 30px; height: 30px; background: rgba(34, 197, 94, 0.2); border-radius: 50%; animation: ping 1.5s infinite;"></div>
            <div style="background-color: #22C55E; color: white; width: 14px; height: 14px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); z-index: 5;"></div>
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      L.marker([pLat, pLng], { icon: amberIcon }).addTo(miniMapInstance.current);
    }
  }, [pickupCoords]);

  // Fetch history when tab is switched to activity
  useEffect(() => {
    if (activeTab === 'activity' && user) {
      fetchRideHistory();
    }
  }, [activeTab, user]);

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
        <div ref={miniMapRef} className="absolute inset-0 w-full h-[55%] z-0"></div>

        {/* Top Header Over Map */}
        <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-start pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm pointer-events-auto flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span className="text-xs font-bold text-gray-800 truncate max-w-[200px]">
              {currentGpsName || 'Locating...'}
            </span>
          </div>
          <button 
            onClick={() => setActiveTab('profile')}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md pointer-events-auto text-gray-700"
          >
            <User className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Bottom Sheet Content */}
        <div className="absolute bottom-0 left-0 right-0 h-[60%] bg-white rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-20 flex flex-col transition-all duration-300">
          
          {/* Drag handle */}
          <div className="w-full flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-24 scrollbar-none">
            
            {activeTab === 'home' && (
              <div className="space-y-6 animate-fade-in pt-2">
                {/* Search Bar */}
                <div 
                  onClick={() => navigate('/book-ride')}
                  className="w-full bg-white border-2 border-gray-100 shadow-sm rounded-full px-5 py-4 flex items-center gap-3 cursor-pointer"
                >
                  <Search className="w-5 h-5 text-gray-400" />
                  <span className="text-lg font-bold text-gray-800">Where do you want to go?</span>
                </div>

                {/* Recent Locations (Mock) */}
                <div className="space-y-4 px-2">
                  <div className="flex items-center gap-4 cursor-pointer">
                    <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1 border-b border-gray-100 pb-3">
                      <p className="font-bold text-gray-900 text-sm">City Center Mall</p>
                      <p className="text-xs text-gray-500 font-medium truncate">MG Road, Sector 28</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 cursor-pointer">
                    <Clock className="w-5 h-5 text-gray-400 shrink-0" />
                    <div className="flex-1 border-b border-gray-100 pb-3">
                      <p className="font-bold text-gray-900 text-sm">Tech Park DLF</p>
                      <p className="text-xs text-gray-500 font-medium truncate">Cyber City, Phase 2</p>
                    </div>
                  </div>
                </div>

                {/* Services Section */}
                <div className="pt-2">
                  <h3 className="text-sm font-black text-gray-500 mb-3 uppercase tracking-wider">Everything In Minutes</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Parcel */}
                    <div 
                      onClick={() => alert('Parcel dispatch is coming soon!')}
                      className="bg-gray-50 rounded-2xl p-4 flex flex-col justify-between h-32 border border-gray-100 relative overflow-hidden"
                    >
                      <div>
                        <p className="text-sm text-gray-600 font-semibold">Send anything</p>
                        <h4 className="text-lg font-black text-gray-900">Parcel</h4>
                      </div>
                      <Package className="w-12 h-12 text-yellow-600 absolute bottom-2 right-2 opacity-80" />
                    </div>

                    {/* Metro Tickets */}
                    <div 
                      onClick={() => alert('Metro Tickets coming soon!')}
                      className="bg-gray-50 rounded-2xl p-4 flex flex-col justify-between h-32 border border-gray-100 relative overflow-hidden"
                    >
                      <div>
                        <span className="inline-block px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-md mb-1">Offers</span>
                        <h4 className="text-lg font-black text-gray-900 leading-tight">Metro tickets</h4>
                      </div>
                      <Ticket className="w-10 h-10 text-gray-400 absolute bottom-3 right-3 opacity-80" />
                    </div>

                    {/* Auto/Rickshaw */}
                    <div 
                      onClick={() => navigate('/book-ride', { state: { selectedRide: 'auto' } })}
                      className="bg-gray-50 rounded-2xl p-4 flex flex-col justify-between h-32 border border-gray-100 relative overflow-hidden"
                    >
                      <div>
                        <p className="text-sm text-gray-600 font-semibold">Private</p>
                        <h4 className="text-lg font-black text-gray-900 leading-tight">Auto &<br/>Rickshaw</h4>
                      </div>
                      <div className="absolute bottom-2 right-2 text-4xl">🛺</div>
                    </div>

                    {/* All Services */}
                    <div 
                      onClick={() => navigate('/book-ride')}
                      className="bg-gray-50 rounded-2xl p-4 flex flex-col justify-between h-32 border border-gray-100 relative overflow-hidden"
                    >
                      <div>
                        <h4 className="text-lg font-black text-gray-900 leading-tight mt-2">All<br/>Services</h4>
                      </div>
                      <div className="absolute bottom-4 right-4 grid grid-cols-2 gap-1">
                        <div className="w-3 h-3 bg-gray-300 rounded-sm"></div>
                        <div className="w-3 h-3 bg-yellow-400 rounded-sm"></div>
                        <div className="w-3 h-3 bg-gray-300 rounded-sm"></div>
                        <div className="w-3 h-3 bg-gray-300 rounded-sm"></div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Promo Banner */}
                <div className="bg-blue-900 rounded-2xl p-4 flex items-center justify-between mt-2">
                  <h4 className="text-white font-black text-lg">Someone misses you</h4>
                  <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-white" />
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
                    <div className="bg-gray-50 rounded-3xl p-5 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-yellow-400 text-black font-black text-2xl flex items-center justify-center shadow-sm">
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
                      className="w-full py-4 bg-red-50 text-red-600 font-black text-sm rounded-2xl transition-all cursor-pointer shadow-none flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Log Out</span>
                    </button>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-3xl p-6 text-center space-y-4">
                    <User className="w-12 h-12 text-gray-300 mx-auto" />
                    <h4 className="text-base font-black text-gray-900">Guest User</h4>
                    <p className="text-sm text-gray-500 font-medium">Log in to manage your rides.</p>
                    <button
                      onClick={() => navigate('/login')}
                      className="w-full py-3.5 bg-yellow-400 text-black font-black text-sm rounded-2xl cursor-pointer"
                    >
                      Log In
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Activity Tab Mobile */}
            {activeTab === 'activity' && (
               <div className="space-y-5 animate-fade-in pt-4">
               <h3 className="text-2xl font-black text-gray-900">My Rides</h3>
               {!user ? (
                 <div className="text-center py-12 bg-gray-50 rounded-3xl space-y-4 p-6">
                   <Clock className="w-12 h-12 text-gray-300 mx-auto" />
                   <p className="text-sm text-gray-500 font-bold">Please log in to view your ride history.</p>
                 </div>
               ) : isLoadingHistory ? (
                 <div className="text-center py-12 space-y-3">
                   <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mx-auto" />
                 </div>
               ) : rideHistory.length === 0 ? (
                 <div className="text-center py-12 bg-gray-50 rounded-3xl space-y-3 p-6">
                   <Clock className="w-10 h-10 text-gray-300 mx-auto" />
                   <p className="text-sm text-gray-500 font-bold">No ride activity found yet.</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                   {rideHistory.map((ride) => (
                     <div key={ride.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm space-y-3">
                       <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                         <span className="text-xs uppercase font-black bg-gray-100 px-2 py-1 rounded">
                           {ride.booking_number || 'Ride'}
                         </span>
                         <span className="font-extrabold text-sm text-gray-900">₹{ride.total_fare}</span>
                       </div>
                       <div className="space-y-2 text-sm">
                         <p className="text-gray-900 font-extrabold truncate flex gap-2 items-center"><span className="w-2 h-2 rounded-full bg-green-500"></span> {ride.pickup_address}</p>
                         <p className="text-gray-500 font-bold truncate flex gap-2 items-center"><span className="w-2 h-2 rounded-full bg-red-500"></span> {ride.dropoff_address}</p>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
             </div>
            )}
          </div>
        </div>

        {/* Mobile Bottom Tab Bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[72px] bg-white border-t border-gray-100 flex items-center justify-around z-40 pb-2 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
          <button onClick={() => setActiveTab('home')} className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none w-16 ${activeTab === 'home' ? 'text-gray-900' : 'text-gray-400'}`}>
            <Car className={`w-6 h-6 ${activeTab === 'home' ? 'fill-gray-900' : ''}`} />
            <span className="text-[10px] font-black">Ride</span>
          </button>
          <button onClick={() => alert('Metro coming soon')} className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none text-gray-400 w-16">
            <Ticket className="w-6 h-6" />
            <span className="text-[10px] font-bold">Metro</span>
          </button>
          <button onClick={() => alert('Parcel coming soon')} className="flex flex-col items-center gap-1 cursor-pointer bg-transparent border-none text-gray-400 w-16">
            <Package className="w-6 h-6" />
            <span className="text-[10px] font-bold">Parcel</span>
          </button>
          <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none w-16 ${activeTab === 'profile' ? 'text-gray-900' : 'text-gray-400'}`}>
            <User className={`w-6 h-6 ${activeTab === 'profile' ? 'fill-gray-900' : ''}`} />
            <span className="text-[10px] font-black">Profile</span>
          </button>
        </div>
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-gray-900 font-bold focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                  />
                  {isSearchingPickup && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>}
                  
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl py-4 pl-12 pr-4 text-gray-900 font-bold focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
                  />
                  {isSearchingDrop && <div className="absolute right-4 top-1/2 -translate-y-1/2"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>}
                  
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
