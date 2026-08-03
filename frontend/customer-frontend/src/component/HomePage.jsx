import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  MapPin, Navigation, Car, ShieldCheck, Clock, Search, ArrowRight, ArrowLeft, Star,
  CreditCard, Tag, CheckCircle2, ChevronRight, LogOut, User, RefreshCw, Zap,
  LocateFixed, Loader2, KeyRound, Lock, Unlock, AlertCircle, X
} from 'lucide-react';
import { getDeviceGpsLocation } from '../common/locationService';
import { fetchWithAuth } from '../common/apiClient';

export default function HomePage({ user, onLogout }) {
  const navigate = useNavigate();
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('home');
  const [pickup, setPickup] = useState('');
  const [pickupCoords, setPickupCoords] = useState(null);
  const [rideHistory, setRideHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const miniMapRef = useRef(null);
  const miniMapInstance = useRef(null);
  const [miniMapLoaded, setMiniMapLoaded] = useState(false);

  // Load Leaflet dynamically for Mini Map preview card
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
        setPickup(loc.address);
        setPickupCoords({ lat: loc.lat, lng: loc.lon });
      } catch (err) {
        console.log('GPS home notice:', err);
      }
    };
    detectGps();
  }, []);

  // Instantiate Mini Map Preview
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
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      touchZoom: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19
    }).addTo(map);

    const amberIcon = L.divIcon({
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; items-center; justify-content: center;">
          <div style="position: absolute; width: 30px; height: 30px; background: rgba(255, 192, 0, 0.4); border-radius: 50%; animation: ping 1.5s infinite;"></div>
          <div style="background-color: #FFC000; color: black; width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; items-center; justify-content: center; font-size: 13px; font-weight: bold; z-index: 5;">📍</div>
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

  // Update Mini Map position when pickupCoords or activeTab changes
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
          <div style="position: relative; width: 32px; height: 32px; display: flex; items-center; justify-content: center;">
            <div style="position: absolute; width: 30px; height: 30px; background: rgba(255, 192, 0, 0.4); border-radius: 50%; animation: ping 1.5s infinite;"></div>
            <div style="background-color: #FFC000; color: black; width: 26px; height: 26px; border-radius: 50%; border: 2px solid white; box-shadow: 0 4px 10px rgba(0,0,0,0.3); display: flex; items-center; justify-content: center; font-size: 13px; font-weight: bold; z-index: 5;">📍</div>
          </div>
        `,
        className: 'custom-div-icon',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      L.marker([pLat, pLng], { icon: amberIcon }).addTo(miniMapInstance.current);
    }
  }, [pickupCoords, activeTab]);

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

  const handleQuickBook = (rideType) => {
    navigate('/book-ride', { state: { selectedRide: rideType } });
  };

  return (
    <div className="min-h-screen w-full bg-[#1C1C1E] flex justify-center font-sans relative overflow-x-hidden p-0 sm:p-4">
      {/* Centered Mobile Device Mockup Container */}
      <div className="w-full max-w-md bg-[#F8F9FA] min-h-screen sm:min-h-[850px] sm:max-h-[900px] sm:my-auto sm:rounded-[40px] sm:border-[8px] sm:border-[#2C2C2E] shadow-2xl flex flex-col relative overflow-y-auto overflow-x-hidden scrollbar-none">

        {/* Home View */}
        {activeTab === 'home' && (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Header (Fixed Top) */}
            <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
              <div>
                <span className="text-xs text-[#8E8E93] font-bold">Hi, {user?.name || 'Guest'} 👋</span>
                <h2 className="text-2xl font-black text-[#1C1C1E] tracking-tight">Where to today?</h2>
              </div>
              <button
                onClick={() => setActiveTab('profile')}
                className="w-10 h-10 rounded-full bg-[#FFC000] text-black font-extrabold flex items-center justify-center shadow-md cursor-pointer border-none"
              >
                <User className="w-5 h-5 text-black" />
              </button>
            </div>

            {/* Overflow Scrollable Section */}
            <div className="flex-1 overflow-y-auto pb-24 scrollbar-none">
              {/* Search Bar Shortcut */}
              <div className="px-5 mb-5">
                <div
                  onClick={() => navigate('/book-ride')}
                  className="flex items-center gap-3 bg-[#F2F2F7] border border-[#E5E5EA] px-4 py-3.5 rounded-2xl cursor-pointer hover:border-[#C7C7CC] transition-all"
                >
                  <Search className="w-5 h-5 text-[#8E8E93]" />
                  <span className="text-[#8E8E93] font-bold text-sm">Enter destination</span>
                </div>
              </div>

              {/* Map Preview card */}
              <div className="px-5 mb-6">
                <div
                  onClick={() => navigate('/book-ride')}
                  className="relative h-36 rounded-3xl overflow-hidden border border-[#E5E5EA] shadow-md bg-[#E5E5EA] cursor-pointer group"
                >
                  <div ref={miniMapRef} className="absolute inset-0 w-full h-full z-0"></div>
                  <div className="absolute inset-0 bg-transparent z-10"></div>
                </div>
              </div>

              {/* Services Section */}
              <div className="px-5 mb-6">
                <h3 className="text-base font-black text-[#1C1C1E] mb-3">Services</h3>
                <div className="space-y-3">
                  {/* Book Ride */}
                  <div
                    onClick={() => navigate('/book-ride')}
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
                    onClick={() => handleQuickBook('bike')}
                    className="flex-1 py-2.5 px-4 bg-white border border-[#E5E5EA] rounded-full text-xs font-extrabold text-[#1C1C1E] hover:border-[#C7C7CC] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>🏍️</span> Bike
                  </button>
                  <button
                    onClick={() => handleQuickBook('auto')}
                    className="flex-1 py-2.5 px-4 bg-white border border-[#E5E5EA] rounded-full text-xs font-extrabold text-[#1C1C1E] hover:border-[#C7C7CC] flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                  >
                    <span>🛺</span> Auto
                  </button>
                  <button
                    onClick={() => handleQuickBook('car')}
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
          </div>
        )}

        {/* Activity Tab View */}
        {activeTab === 'activity' && (
          <div className="p-5 space-y-4 flex-1 overflow-y-auto pb-24 scrollbar-none">
            <h3 className="text-xl font-black text-[#1C1C1E]">My Activity</h3>
            {!user ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-[#E5E5EA] shadow-xs space-y-4 p-6">
                <Clock className="w-12 h-12 text-gray-300 mx-auto" />
                <div>
                  <h3 className="text-sm font-black text-[#1C1C1E]">Not Logged In</h3>
                  <p className="text-xs text-[#8E8E93] font-bold mt-1">Please log in to view your ride history.</p>
                </div>
              </div>
            ) : isLoadingHistory ? (
              <div className="text-center py-12 space-y-3">
                <Loader2 className="w-8 h-8 text-[#FFC000] animate-spin mx-auto" />
                <p className="text-xs font-extrabold text-[#8E8E93]">Fetching your ride history...</p>
              </div>
            ) : rideHistory.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-[#E5E5EA] shadow-xs space-y-3 p-6">
                <Clock className="w-10 h-10 text-gray-300 mx-auto" />
                <p className="text-xs text-[#8E8E93] font-bold">No ride activity found yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rideHistory.map((ride) => (
                  <div key={ride.id} className="bg-white rounded-2xl p-4 border border-[#E5E5EA] shadow-2xs space-y-2">
                    <div className="flex items-center justify-between border-b border-[#F2F2F7] pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs uppercase font-black text-white bg-[#1C1C1E] px-2 py-0.5 rounded">
                          {ride.booking_number || 'Ride'}
                        </span>
                        <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded ${ride.status === 'Completed' ? 'bg-[#34C759]/10 text-[#34C759]' :
                            ride.status === 'Cancelled' ? 'bg-[#FF3B30]/10 text-[#FF3B30]' :
                              'bg-[#FFC000]/10 text-[#FF9F0A]'
                          }`}>
                          {ride.status}
                        </span>
                      </div>
                      <span className="font-extrabold text-sm text-[#1C1C1E]">₹{ride.total_fare}</span>
                    </div>

                    <div className="space-y-1 pt-1 text-xs">
                      <p className="text-[#1C1C1E] font-extrabold truncate">🟢 {ride.pickup_address}</p>
                      <p className="text-[#636366] font-bold truncate">📍 {ride.dropoff_address}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab View */}
        {activeTab === 'profile' && (
          <div className="p-5 space-y-5 flex-1 overflow-y-auto pb-24 scrollbar-none">
            <h3 className="text-xl font-black text-[#1C1C1E]">Customer Profile</h3>

            {user ? (
              <div className="space-y-4">
                <div className="bg-white rounded-3xl p-5 border border-[#E5E5EA] shadow-xs flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-[#FFC000] text-black font-black text-xl flex items-center justify-center shadow-md">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h4 className="text-base font-extrabold text-[#1C1C1E]">{user.name}</h4>
                    <p className="text-xs text-[#8E8E93] font-bold mt-0.5">{user.identifier || user.email || user.phone_number}</p>
                    <span className="inline-block text-[10px] font-black uppercase tracking-wider text-[#34C759] bg-[#34C759]/10 px-2 py-0.5 rounded-full mt-1">
                      Verified Customer
                    </span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-4 border border-[#E5E5EA] shadow-xs space-y-2 text-xs">
                  <div className="flex items-center justify-between py-2 border-b border-[#F2F2F7]">
                    <span className="font-bold text-[#8E8E93]">Role</span>
                    <span className="font-extrabold text-[#1C1C1E]">Customer</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-[#F2F2F7]">
                    <span className="font-bold text-[#8E8E93]">Session Logged In</span>
                    <span className="font-extrabold text-[#1C1C1E]">{user.loggedInAt || 'Active'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full py-3.5 bg-[#FF3B30]/10 hover:bg-[#FF3B30]/20 text-[#FF3B30] font-black text-xs rounded-2xl border border-[#FF3B30]/20 transition-all cursor-pointer shadow-none flex items-center justify-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log Out of RaahGo Account</span>
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-[#E5E5EA] text-center space-y-4">
                <User className="w-12 h-12 text-gray-300 mx-auto" />
                <h4 className="text-sm font-black text-[#1C1C1E]">You are browsing as Guest</h4>
                <p className="text-xs text-[#8E8E93] font-bold">Log in to manage your profile, saved places, and trip receipts.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full py-3 bg-[#FFC000] text-black font-extrabold text-xs rounded-2xl shadow-xs border-none cursor-pointer"
                >
                  Log In / Register Now
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bottom Tab Bar Navigation */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-[#E5E5EA] flex items-center justify-around z-40">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none ${
              activeTab === 'home' ? 'text-[#FFC000] scale-105' : 'text-[#8E8E93]'
            }`}
          >
            <Car className="w-5 h-5" />
            <span className="text-[10px] font-bold">Home</span>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none ${
              activeTab === 'activity' ? 'text-[#FFC000] scale-105' : 'text-[#8E8E93]'
            }`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-[10px] font-bold">Activity</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer bg-transparent border-none ${
              activeTab === 'profile' ? 'text-[#FFC000] scale-105' : 'text-[#8E8E93]'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[10px] font-bold">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}
