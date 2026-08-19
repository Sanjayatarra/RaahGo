import React from 'react';
import { Car, RefreshCw } from 'lucide-react';
import ActiveTripScreen from './ActiveTripScreen';

export default function DriverRidesTab({
  activeRide,
  captainLocation = { lat: 28.4415, lng: 77.0395 },
  allRides = [],
  completedRides = [],
  onArrivedAtPickup,
  onStartRideWithPin,
  onCompleteRide,
  onCancelRide,
  enteredPin,
  setEnteredPin,
  pinError,
  onRefresh,
  isLoading
}) {
  const completedList = completedRides.length > 0
    ? completedRides
    : allRides.filter((b) => String(b.status).toLowerCase() === 'completed');

  if (activeRide) {
    return (
      <ActiveTripScreen
        activeRide={activeRide}
        captainLocation={captainLocation}
        onArrivedAtPickup={onArrivedAtPickup}
        onStartRideWithPin={onStartRideWithPin}
        onCompleteRide={onCompleteRide}
        onCancelRide={onCancelRide}
        enteredPin={enteredPin}
        setEnteredPin={setEnteredPin}
        pinError={pinError}
      />
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Ride History
          </h2>
          <p className="text-xs text-gray-500">
            Completed trip logs and earnings history
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shadow-xs cursor-pointer"
          title="Refresh Rides"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="space-y-4">
        <div className="p-6 text-center bg-white rounded-3xl border border-gray-200 space-y-2 shadow-xs">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center font-bold">
            <Car className="w-6 h-6" />
          </div>
          <h3 className="font-extrabold text-base text-gray-900">No Active Trip</h3>
          <p className="text-xs text-gray-500 max-w-xs mx-auto">
            You are ready for rides. New requests will appear with pickup directions.
          </p>
        </div>

        {/* Recent Completed Trips List */}
        {completedList.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-xs font-black text-gray-500 uppercase tracking-wider px-1">
              Recent Completed Trips ({completedList.length})
            </h3>
            {completedList.map((ride, idx) => (
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
