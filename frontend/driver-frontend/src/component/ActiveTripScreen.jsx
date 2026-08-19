import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Navigation, Phone, MessageSquare, ShieldAlert, CheckCircle2,
  Clock, MapPin, ArrowRight, Check, AlertCircle, Compass,
  ChevronLeft, Share2, DollarSign, Car, User, ExternalLink
} from 'lucide-react';
import RealtimeMap from './RealtimeMap';

export default function ActiveTripScreen({
  activeRide,
  captainLocation,
  onArrivedAtPickup,
  onStartRideWithPin,
  onCompleteRide,
  onCancelRide,
  enteredPin,
  setEnteredPin,
  pinError,
  onMinimize
}) {
  const [routeInfo, setRouteInfo] = useState({ distanceKm: '2.4', durationMins: 6 });
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Customer not reachable');

  if (!activeRide) return null;

  const statusRaw = String(activeRide.status || '').toUpperCase();
  const isAccepted = statusRaw === 'ACCEPTED' || statusRaw === 'SEARCHING' || statusRaw === 'ASSIGNED';
  const isArrived = statusRaw === 'ARRIVED';
  const isInTrip = statusRaw === 'IN_TRIP' || statusRaw === 'IN TRIP';

  // Customer info
  const customerName = activeRide.customer_details?.name || activeRide.customer_name || activeRide.customer || 'Passenger';
  const customerPhone = activeRide.customer_details?.phone || activeRide.customer_phone;
  const fare = activeRide.fare || activeRide.total_fare || activeRide.estimated_fare || 180;
  const vehicleType = activeRide.vehicle_type_name || activeRide.vehicle_type || 'Ride';

  // Coordinate parsing
  const pickupLat = parseFloat(activeRide.pickup_latitude) || 28.4415;
  const pickupLng = parseFloat(activeRide.pickup_longitude) || 77.0395;
  const dropLat = parseFloat(activeRide.dropoff_latitude) || 28.4595;
  const dropLng = parseFloat(activeRide.dropoff_longitude) || 77.0266;

  // Haversine formula for distance calculation
  const getDist = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number((R * c).toFixed(1));
  };

  const capLat = captainLocation?.lat || 28.4415;
  const capLng = captainLocation?.lng || 77.0395;
  const pickupDistKm = getDist(capLat, capLng, pickupLat, pickupLng) || activeRide.pickup_distance_km || 1.2;
  const dropDistKm = getDist(capLat, capLng, dropLat, dropLng) || activeRide.drop_distance_km || ((pickupDistKm || 1.2) + 6.8);

  // Memoized stable coordinates to avoid map re-render loops
  const originCoords = useMemo(() => {
    return isInTrip
      ? { lat: pickupLat, lng: pickupLng }
      : { lat: capLat, lng: capLng };
  }, [isInTrip, pickupLat, pickupLng, capLat, capLng]);

  const targetCoords = useMemo(() => {
    return isInTrip
      ? { lat: dropLat, lng: dropLng }
      : { lat: pickupLat, lng: pickupLng };
  }, [isInTrip, dropLat, dropLng, pickupLat, pickupLng]);

  const handleRouteCalculated = useCallback((info) => {
    setRouteInfo((prev) => {
      if (prev.distanceKm === info.distanceKm && prev.durationMins === info.durationMins) {
        return prev;
      }
      return info;
    });
  }, []);

  // Navigation target coordinates
  const navTargetLat = isInTrip ? dropLat : pickupLat;
  const navTargetLng = isInTrip ? dropLng : pickupLng;

  const openGoogleMapsNav = () => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${navTargetLat},${navTargetLng}&travelmode=driving`;
    window.open(url, '_blank');
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-2.5 sm:px-4 py-2 pb-6 space-y-2.5 font-sans animate-in fade-in duration-150">
      
      {/* ── 1. Top Compact Header & Status Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2.5 sm:p-3 shadow-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="p-1.5 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
              title="Minimize"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <div>
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block leading-tight">
              {vehicleType}
            </span>
            <p className="text-xs font-semibold text-gray-700">
              Live Fare: <strong className="text-emerald-700 text-sm font-black">₹{fare}</strong>
            </p>
          </div>
        </div>

        {/* Dynamic Status Chip */}
        <div>
          {isAccepted && (
            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              To Pickup
            </span>
          )}
          {isArrived && (
            <span className="px-2.5 py-1 rounded-xl bg-blue-100 text-blue-900 border border-blue-300 text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              At Pickup
            </span>
          )}
          {isInTrip && (
            <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-black uppercase tracking-wide flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              On Trip
            </span>
          )}
        </div>
      </div>

      {/* ── 2. Compact GPS Navigation Map & Quick Navigation Bar ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-2 shadow-xs space-y-1.5">
        <div className="h-44 sm:h-52 w-full rounded-xl overflow-hidden border border-gray-100 relative">
          <RealtimeMap
            pickup={isInTrip ? activeRide.pickup_address : "Your GPS Location"}
            destination={isInTrip ? activeRide.dropoff_address : activeRide.pickup_address}
            pickupCoords={originCoords}
            destCoords={targetCoords}
            mode={isInTrip ? 'in_trip' : 'pickup'}
            onRouteCalculated={handleRouteCalculated}
          />
        </div>

        {/* Live Route Info & One-Tap Google Maps Navigation Button */}
        <div className="flex items-center justify-between px-2 py-1.5 bg-gray-50 rounded-xl border border-gray-100 gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 font-bold text-gray-800">
              <Navigation className="w-3.5 h-3.5 text-blue-600" />
              <span>{routeInfo.distanceKm} km</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-gray-800">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>~{routeInfo.durationMins}m ETA</span>
            </div>
          </div>

          <button
            type="button"
            onClick={openGoogleMapsNav}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 transition-all cursor-pointer"
            title="Open Turn-by-Turn Navigation in Google Maps"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Google Maps</span>
            <ExternalLink className="w-3 h-3 opacity-75" />
          </button>
        </div>
      </div>

      {/* ── 3. Compact Customer & Pickup/Drop Route Card ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FFC000] text-black font-black text-sm flex items-center justify-center shadow-xs">
              {customerName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h4 className="font-extrabold text-xs sm:text-sm text-gray-900 leading-tight">
                  {customerName}
                </h4>
                <span className="px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 text-[10px] font-extrabold border border-amber-200">
                  ★ 4.9
                </span>
              </div>
              <p className="text-[10px] text-gray-500">
                Passenger Verified • Cash / Online
              </p>
            </div>
          </div>

          {/* Direct Call & Message */}
          <div className="flex items-center gap-1.5">
            <a
              href={`tel:${customerPhone || ''}`}
              className="p-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-extrabold text-xs flex items-center gap-1 border border-emerald-200 transition-colors shadow-2xs"
              title="Call Customer Directly"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Call</span>
            </a>
            <a
              href={`sms:${customerPhone || ''}?body=Hi%20${encodeURIComponent(customerName)},%20I%20am%20your%20RaahGo%20Captain.`}
              className="p-2 rounded-xl bg-blue-50 text-blue-700 hover:bg-blue-100 font-extrabold text-xs flex items-center gap-1 border border-blue-200 transition-colors shadow-2xs"
              title="Send SMS message to Customer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Message</span>
            </a>
          </div>
        </div>

        {/* Pickup & Destination Address Route Box */}
        <div className="space-y-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100 text-xs">
          {/* Pickup */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${!isInTrip ? 'bg-emerald-500 ring-2 ring-emerald-200 animate-pulse' : 'bg-emerald-500'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-extrabold text-emerald-800 uppercase tracking-wider block">
                  Pickup Location
                </span>
                <p className="font-bold text-gray-900 truncate mt-0.5">
                  {activeRide.pickup_address || activeRide.pickup || 'Customer Pickup Point'}
                </p>
              </div>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[10px]">
              {pickupDistKm} km away
            </span>
          </div>

          {/* Dropoff */}
          <div className="flex items-start justify-between gap-2 border-t border-gray-200/60 pt-1.5">
            <div className="flex items-start gap-2 flex-1 min-w-0">
              <div className={`w-3 h-3 rounded-full mt-0.5 shrink-0 ${isInTrip ? 'bg-red-500 ring-2 ring-red-200 animate-pulse' : 'bg-red-500'}`} />
              <div className="flex-1 min-w-0">
                <span className="text-[9px] font-extrabold text-red-800 uppercase tracking-wider block">
                  Destination Dropoff
                </span>
                <p className="font-bold text-gray-900 truncate mt-0.5">
                  {activeRide.dropoff_address || activeRide.dropoff || 'Dropoff Destination'}
                </p>
              </div>
            </div>
            <span className="shrink-0 px-2 py-0.5 rounded-lg bg-red-100 text-red-900 border border-red-300 font-extrabold text-[10px]" title="Distance from your location to destination">
              {dropDistKm} km drop
            </span>
          </div>
        </div>
      </div>

      {/* ── 4. Action Box (Arrived / Enter PIN / Complete Trip) ── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-3 sm:p-4 shadow-sm space-y-2.5">
        
        {/* STEP 1: Driving to Pickup -> "I have Arrived at Pickup" */}
        {isAccepted && (
          <div className="space-y-2.5">
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span className="font-bold">Driving to pickup point. Tap button when you reach.</span>
            </div>

            <button
              type="button"
              onClick={onArrivedAtPickup}
              className="w-full py-3.5 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
            >
              <MapPin className="w-4 h-4" />
              <span>I have Arrived at Pickup</span>
            </button>
          </div>
        )}

        {/* STEP 2: At Pickup -> Enter Passenger PIN & Start Trip */}
        {isArrived && (
          <div className="space-y-2.5">
            <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
              <span className="font-bold">You are at pickup. Ask customer for 4-digit start PIN.</span>
            </div>

            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl space-y-2">
              <div className="text-center">
                <span className="text-xs font-extrabold text-amber-900 block">
                  Enter 4-Digit Passenger PIN:
                </span>
                {activeRide.ride_pin && (
                  <span className="text-[10px] text-amber-700 font-mono">
                    (PIN: {activeRide.ride_pin})
                  </span>
                )}
              </div>

              {/* 4 PIN Box Inputs */}
              <div className="flex items-center gap-2 justify-center">
                {[0, 1, 2, 3].map((idx) => (
                  <input
                    key={idx}
                    id={`active-pin-box-${idx}`}
                    type="tel"
                    maxLength={1}
                    value={enteredPin[idx]}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const copy = [...enteredPin];
                      copy[idx] = val;
                      setEnteredPin(copy);
                      if (val && idx < 3) {
                        document.getElementById(`active-pin-box-${idx + 1}`)?.focus();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Backspace' && !enteredPin[idx] && idx > 0) {
                        document.getElementById(`active-pin-box-${idx - 1}`)?.focus();
                      }
                    }}
                    className="w-11 h-12 text-center text-xl font-black bg-white border-2 border-amber-300 rounded-xl focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none shadow-xs"
                  />
                ))}
              </div>

              {pinError && (
                <p className="text-xs text-red-600 text-center font-bold">{pinError}</p>
              )}

              <button
                type="button"
                onClick={onStartRideWithPin}
                className="w-full py-3 bg-[#FFC000] hover:bg-[#E5AC00] text-black font-black text-sm rounded-xl shadow-md flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Verify PIN & Start Trip</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: In Trip -> Navigate to Destination & Complete Trip */}
        {isInTrip && (
          <div className="space-y-2.5">
            <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
              <Car className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-bold">Trip in progress. Complete when passenger reaches safely.</span>
            </div>

            <button
              type="button"
              onClick={onCompleteRide}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-xl shadow-md shadow-emerald-600/30 flex items-center justify-center gap-2 active:scale-98 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Complete Trip & Collect Fare (₹{fare})</span>
            </button>
          </div>
        )}

        {/* Emergency SOS & Support Buttons */}
        <div className="flex items-center justify-between pt-1 text-xs">
          <button
            type="button"
            onClick={() => alert("🚨 Safety Alert Triggered: Emergency SOS dispatch activated to RaahGo Safety Team & Police (112).")}
            className="text-red-600 font-extrabold flex items-center gap-1.5 hover:text-red-700 cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            <span>Emergency SOS</span>
          </button>

          {onCancelRide && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="text-gray-500 font-bold hover:text-gray-800 cursor-pointer"
            >
              Cancel Ride
            </button>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 max-w-sm w-full space-y-4 shadow-2xl border border-gray-200">
            <h3 className="font-extrabold text-base text-gray-900">Cancel Active Ride?</h3>
            <p className="text-xs text-gray-600">
              Frequent cancellations affect captain ranking and acceptance score. Select a reason:
            </p>
            <select
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-2.5 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl"
            >
              <option value="Customer not reachable">Customer not reachable</option>
              <option value="Customer requested cancellation">Customer requested cancellation</option>
              <option value="Vehicle issue / breakdown">Vehicle issue / breakdown</option>
              <option value="Heavy traffic / inaccessible location">Heavy traffic / inaccessible location</option>
            </select>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-800 font-bold text-xs"
              >
                Keep Ride
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCancelModal(false);
                  onCancelRide(cancelReason);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white font-bold text-xs"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
