import React, { useState } from 'react';
import {
  Car, MapPin, Navigation, Clock, CheckCircle2, XCircle, Phone, ArrowRight,
  ShieldCheck, RefreshCw, Calendar, Package, AlertCircle, Check
} from 'lucide-react';

export default function DriverRidesTab({
  activeRide,
  allRides = [],
  completedRides = [],
  onStartRideWithPin,
  onCompleteRide,
  enteredPin,
  setEnteredPin,
  pinError,
  onRefresh,
  isLoading
}) {
  const [subTab, setSubTab] = useState('active'); // 'active' | 'upcoming' | 'completed' | 'cancelled'

  // Dynamic filter from real DB bookings
  const upcomingRides = allRides.filter(
    (b) => String(b.status).toLowerCase() === 'scheduled' || String(b.status).toLowerCase() === 'searching'
  );

  const completedList = completedRides.length > 0
    ? completedRides
    : allRides.filter((b) => String(b.status).toLowerCase() === 'completed');

  const cancelledList = allRides.filter(
    (b) => String(b.status).toLowerCase() === 'cancelled'
  );

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            My Rides
          </h2>
          <p className="text-xs text-gray-500">
            View active, completed, scheduled and cancelled trips from database
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shadow-xs"
          title="Refresh Rides"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Subtabs Filter */}
      <div className="flex items-center gap-1.5 p-1 bg-gray-200/70 rounded-2xl">
        {[
          { id: 'active', label: 'Active', count: activeRide ? 1 : 0 },
          { id: 'upcoming', label: 'Upcoming', count: upcomingRides.length },
          { id: 'completed', label: 'Completed', count: completedList.length },
          { id: 'cancelled', label: 'Cancelled', count: cancelledList.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`flex-1 py-2 px-2 text-xs sm:text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 ${
              subTab === tab.id
                ? 'bg-white text-black shadow-xs'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                subTab === tab.id ? 'bg-[#FFC000] text-black' : 'bg-gray-300 text-gray-700'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 1. Active Ride Tab ── */}
      {subTab === 'active' && (
        <div className="space-y-4">
          {activeRide ? (
            <div className="bg-white rounded-2xl border-2 border-emerald-500/40 p-4 sm:p-5 shadow-lg space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-white text-[11px] font-extrabold rounded-bl-xl uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                Live Ride in Progress
              </div>

              <div className="flex items-center gap-3 pt-2">
                <div className="w-12 h-12 rounded-2xl bg-[#FFC000] text-black flex items-center justify-center font-bold text-lg shadow-sm">
                  <Car className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-500">
                      #{activeRide.booking_number || activeRide.id?.substring(0, 8)}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-800 text-xs font-bold">
                      {activeRide.vehicle_type || 'Standard'}
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-gray-900">
                    ₹{activeRide.fare || activeRide.total_fare || 180}
                  </h3>
                </div>
              </div>

              {/* Addresses */}
              <div className="space-y-2.5 bg-gray-50 p-3.5 rounded-xl border border-gray-100 text-xs sm:text-sm">
                <div className="flex items-start gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mt-1 shrink-0 ring-4 ring-emerald-100" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Pickup Location</p>
                    <p className="font-semibold text-gray-800">{activeRide.pickup_address || activeRide.pickup}</p>
                  </div>
                </div>
                <div className="w-0.5 h-3 bg-gray-300 ml-1.5" />
                <div className="flex items-start gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 mt-1 shrink-0 ring-4 ring-red-100" />
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">Dropoff Destination</p>
                    <p className="font-semibold text-gray-800">{activeRide.dropoff_address || activeRide.dropoff}</p>
                  </div>
                </div>
              </div>

              {/* Customer Contact */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-xs text-gray-500">Customer</p>
                  <p className="font-bold text-gray-900">{activeRide.customer_name || 'Passenger'}</p>
                </div>
                <a
                  href={`tel:${activeRide.customer_phone || '9876543210'}`}
                  className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center gap-1.5 border border-emerald-200 hover:bg-emerald-100"
                >
                  <Phone className="w-3.5 h-3.5" /> Call Passenger
                </a>
              </div>

              {/* PIN Verification (If ride not started) */}
              {String(activeRide.status).toUpperCase() !== 'IN_TRIP' ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <ShieldCheck className="w-4 h-4 text-amber-600" />
                    <span>Enter 4-Digit Start PIN from Passenger:</span>
                  </div>
                  <div className="flex items-center gap-2 justify-center">
                    {[0, 1, 2, 3].map((idx) => (
                      <input
                        key={idx}
                        id={`pin-input-${idx}`}
                        type="tel"
                        maxLength={1}
                        value={enteredPin[idx]}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const copy = [...enteredPin];
                          copy[idx] = val;
                          setEnteredPin(copy);
                          if (val && idx < 3) {
                            document.getElementById(`pin-input-${idx + 1}`)?.focus();
                          }
                        }}
                        className="w-12 h-12 text-center text-xl font-bold bg-white border border-amber-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:outline-none"
                      />
                    ))}
                  </div>
                  {pinError && (
                    <p className="text-xs text-red-600 text-center font-semibold">{pinError}</p>
                  )}
                  <button
                    onClick={onStartRideWithPin}
                    className="w-full py-3 bg-[#FFC000] text-black font-extrabold rounded-xl hover:bg-[#E5AC00] shadow-sm flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" /> Verify PIN & Start Trip
                  </button>
                </div>
              ) : (
                <button
                  onClick={onCompleteRide}
                  className="w-full py-3.5 bg-emerald-600 text-white font-extrabold rounded-xl hover:bg-emerald-700 shadow-md flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> Complete Trip & Collect Cash (₹{activeRide.fare || activeRide.total_fare || 180})
                </button>
              )}
            </div>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 space-y-3">
              <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 mx-auto flex items-center justify-center">
                <Car className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-800">No Active Ride</h3>
              <p className="text-xs text-gray-500 max-w-xs mx-auto">
                Go ONLINE on the Home tab to start receiving nearby ride requests.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── 2. Upcoming Rides Tab ── */}
      {subTab === 'upcoming' && (
        <div className="space-y-3">
          {upcomingRides.length > 0 ? (
            upcomingRides.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-extrabold border border-blue-200">
                      {item.service || item.vehicle_type || 'Scheduled Ride'}
                    </span>
                    <span className="text-xs font-mono text-gray-400">#{item.booking_number || item.id?.slice(0, 8)}</span>
                  </div>
                  <span className="text-base font-black text-gray-900">₹{item.total_fare || item.fare || 0}</span>
                </div>
                <div className="text-xs text-gray-600 flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                  <span>Scheduled for: <strong>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Today'}</strong></span>
                </div>
                <div className="bg-gray-50 p-3 rounded-xl text-xs space-y-1.5">
                  <p className="text-gray-800"><strong>Pickup:</strong> {item.pickup_address || item.pickup}</p>
                  <p className="text-gray-800"><strong>Dropoff:</strong> {item.dropoff_address || item.dropoff}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 text-xs text-gray-500">
              No upcoming scheduled rides recorded in database.
            </div>
          )}
        </div>
      )}

      {/* ── 3. Completed Rides Tab ── */}
      {subTab === 'completed' && (
        <div className="space-y-3">
          {completedList.length > 0 ? (
            completedList.map((ride, idx) => (
              <div key={ride.id || idx} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-gray-500">
                      #{ride.booking_number || (ride.id ? String(ride.id).substring(0, 8) : `RG1028${idx}`)}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold border border-emerald-200">
                      Completed
                    </span>
                  </div>
                  <strong className="text-emerald-700 font-extrabold text-base">
                    ₹{ride.fare || ride.total_fare || 150}
                  </strong>
                </div>
                <div className="text-xs text-gray-600 space-y-1">
                  <p className="truncate"><strong>From:</strong> {ride.pickup_address || ride.pickup || 'Pickup Location'}</p>
                  <p className="truncate"><strong>To:</strong> {ride.dropoff_address || ride.dropoff || 'Dropoff Location'}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px] text-gray-400">
                  <span>{ride.created_at ? new Date(ride.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Today'}</span>
                  <span className="font-semibold text-gray-700">{ride.payment_status || 'Cash / Online'}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 text-xs text-gray-500">
              No completed rides recorded yet in database.
            </div>
          )}
        </div>
      )}

      {/* ── 4. Cancelled Rides Tab ── */}
      {subTab === 'cancelled' && (
        <div className="space-y-3">
          {cancelledList.length > 0 ? (
            cancelledList.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-gray-500">#{item.booking_number || item.id?.slice(0, 8)}</span>
                  <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-[10px] font-bold border border-red-200">
                    Cancelled
                  </span>
                </div>
                <div className="text-xs text-gray-700 space-y-1">
                  <p><strong>Route:</strong> {item.pickup_address || item.pickup} ➔ {item.dropoff_address || item.dropoff}</p>
                  <p className="text-red-600 font-medium">Cancellation status: Cancelled</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-[11px]">
                  <span className="text-gray-400">{item.created_at ? new Date(item.created_at).toLocaleString() : 'Today'}</span>
                  <span className="font-bold text-gray-700">₹{item.total_fare || 0}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 text-xs text-gray-500">
              No cancelled rides recorded in database.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
