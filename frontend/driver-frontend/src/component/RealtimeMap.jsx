import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapPin, Navigation, Car, LocateFixed, Compass, Route, Clock } from 'lucide-react';

export default function RealtimeMap({
  pickup,
  destination,
  pickupCoords,
  destCoords,
  captainLocation,
  activeRide,
  nearbyBookings = [],
  mode = 'pickup',
  onRouteCalculated
}) {
  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const captainMarkerRef = useRef(null);
  const destMarkerRef = useRef(null);
  const nearbyMarkersRef = useRef([]);
  const routePolylineRef = useRef(null);
  const lastRouteKeyRef = useRef('');
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isRouting, setIsRouting] = useState(false);

  // Default coords (Gurugram/Delhi NCR)
  const defaultLat = 28.4415;
  const defaultLng = 77.0395;

  // 1. Resolve actual origin and destination coordinates
  const resolvedOriginLat = parseFloat(pickupCoords?.lat ?? captainLocation?.lat ?? activeRide?.pickup_latitude ?? defaultLat);
  const resolvedOriginLng = parseFloat(pickupCoords?.lng ?? captainLocation?.lng ?? activeRide?.pickup_longitude ?? defaultLng);

  const resolvedDestLat = destCoords?.lat != null
    ? parseFloat(destCoords.lat)
    : (mode === 'in_trip' ? parseFloat(activeRide?.dropoff_latitude) : parseFloat(activeRide?.pickup_latitude));

  const resolvedDestLng = destCoords?.lng != null
    ? parseFloat(destCoords.lng)
    : (mode === 'in_trip' ? parseFloat(activeRide?.dropoff_longitude) : parseFloat(activeRide?.pickup_longitude));

  const hasDestination = !isNaN(resolvedDestLat) && !isNaN(resolvedDestLng) && (resolvedDestLat !== resolvedOriginLat || resolvedDestLng !== resolvedOriginLng);

  // Load Leaflet assets once
  useEffect(() => {
    if (window.L) {
      setMapLoaded(true);
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;
    script.onload = () => setMapLoaded(true);
    document.head.appendChild(script);

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  // Initialize Map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || leafletInstance.current) return;

    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current, {
      center: [resolvedOriginLat, resolvedOriginLng],
      zoom: 14,
      zoomControl: false,
    });

    // RaahGo Map Tiles
    L.tileLayer('/api/v1/services/tiles/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    leafletInstance.current = map;
  }, [mapLoaded]);

  // Recenter map bounds to show both Captain and Destination
  const handleRecenter = useCallback(() => {
    const map = leafletInstance.current;
    const L = window.L;
    if (!map || !L) return;

    const bounds = L.latLngBounds();
    bounds.extend([resolvedOriginLat, resolvedOriginLng]);
    if (hasDestination) {
      bounds.extend([resolvedDestLat, resolvedDestLng]);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
    } else {
      map.setView([resolvedOriginLat, resolvedOriginLng], 15);
    }
  }, [resolvedOriginLat, resolvedOriginLng, resolvedDestLat, resolvedDestLng, hasDestination]);

  // Update Markers & Route Polyline (Without flickering or loop)
  useEffect(() => {
    if (!mapLoaded || !leafletInstance.current) return;
    const L = window.L;
    const map = leafletInstance.current;
    if (!L || !map) return;

    // ── 1. Captain Location Marker ──
    const captainIconHtml = mode === 'in_trip'
      ? `<div style="background:#10B981;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:18px;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.35);">🟢</div>`
      : `<div style="background:#FFC000;color:black;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;border:3px solid #000;box-shadow:0 4px 14px rgba(0,0,0,0.4);">🛺</div>`;

    const captainIcon = L.divIcon({
      className: 'captain-marker-icon',
      html: captainIconHtml,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
    });

    if (!captainMarkerRef.current) {
      captainMarkerRef.current = L.marker([resolvedOriginLat, resolvedOriginLng], { icon: captainIcon })
        .addTo(map)
        .bindPopup(`<b>Captain Current Location</b><br/>${pickup || 'Your GPS position'}`);
    } else {
      captainMarkerRef.current.setLatLng([resolvedOriginLat, resolvedOriginLng]);
      captainMarkerRef.current.setIcon(captainIcon);
    }

    // ── 2. Destination / Pickup Target Marker ──
    if (hasDestination) {
      const destIconHtml = mode === 'in_trip'
        ? `<div style="background:#EF4444;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.35);">🔴</div>`
        : `<div style="background:#10B981;color:white;width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;border:3px solid white;box-shadow:0 4px 14px rgba(0,0,0,0.35);">📍</div>`;

      const destIcon = L.divIcon({
        className: 'dest-marker-icon',
        html: destIconHtml,
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      if (!destMarkerRef.current) {
        destMarkerRef.current = L.marker([resolvedDestLat, resolvedDestLng], { icon: destIcon })
          .addTo(map)
          .bindPopup(`<b>${mode === 'in_trip' ? 'Dropoff Destination' : 'Customer Pickup'}</b><br/>${destination || pickup || ''}`);
      } else {
        destMarkerRef.current.setLatLng([resolvedDestLat, resolvedDestLng]);
        destMarkerRef.current.setIcon(destIcon);
      }
    } else if (destMarkerRef.current) {
      map.removeLayer(destMarkerRef.current);
      destMarkerRef.current = null;
    }

    // ── 3. Render Nearby Bookings (for Home Map view) ──
    if (nearbyBookings.length > 0 && !hasDestination) {
      nearbyMarkersRef.current.forEach((m) => map.removeLayer(m));
      nearbyMarkersRef.current = [];

      nearbyBookings.forEach((b) => {
        const bLat = parseFloat(b.pickup_latitude);
        const bLng = parseFloat(b.pickup_longitude);
        if (bLat && bLng) {
          const reqIcon = L.divIcon({
            className: 'nearby-req-icon',
            html: `<div style="background:#FFC000;color:black;padding:3px 7px;border-radius:12px;font-weight:900;font-size:11px;border:2px solid black;box-shadow:0 2px 8px rgba(0,0,0,0.3);white-space:nowrap;">₹${b.fare || b.total_fare || 180}</div>`,
            iconAnchor: [20, 15],
          });
          const marker = L.marker([bLat, bLng], { icon: reqIcon })
            .addTo(map)
            .bindPopup(`<b>₹${b.fare || b.total_fare || 180} • ${b.vehicle_type || 'Ride'}</b><br/>${b.pickup_address || 'Pickup'}`);
          nearbyMarkersRef.current.push(marker);
        }
      });
    }

    // ── 4. Route Calculation (Only if key changes) ──
    if (hasDestination) {
      const currentRouteKey = `${resolvedOriginLat.toFixed(4)},${resolvedOriginLng.toFixed(4)}->${resolvedDestLat.toFixed(4)},${resolvedDestLng.toFixed(4)}_${mode}`;

      if (lastRouteKeyRef.current === currentRouteKey && routePolylineRef.current) {
        // Route already drawn for this pair, no re-fetching needed
        return;
      }

      lastRouteKeyRef.current = currentRouteKey;
      setIsRouting(true);

      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${resolvedOriginLng},${resolvedOriginLat};${resolvedDestLng},${resolvedDestLat}?overview=full&geometries=geojson&steps=true`;

      fetch(osrmUrl)
        .then((res) => res.json())
        .then((data) => {
          setIsRouting(false);
          if (!map || !map.getContainer()) return;

          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const mainRoute = data.routes[0];
            const coordinates = mainRoute.geometry.coordinates.map((coord) => [coord[1], coord[0]]);

            if (routePolylineRef.current) {
              map.removeLayer(routePolylineRef.current);
            }

            routePolylineRef.current = L.polyline(coordinates, {
              color: '#007AFF',
              weight: 6,
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(map);

            const bounds = L.latLngBounds();
            bounds.extend([resolvedOriginLat, resolvedOriginLng]);
            bounds.extend([resolvedDestLat, resolvedDestLng]);
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });

            const distKm = (mainRoute.distance / 1000).toFixed(1);
            const durationMins = Math.max(2, Math.round(mainRoute.duration / 60));

            if (onRouteCalculated) {
              onRouteCalculated({ distanceKm: distKm, durationMins });
            }
          }
        })
        .catch((err) => {
          setIsRouting(false);
          if (!map || !map.getContainer()) return;
          console.log('OSRM routing fallback:', err);

          if (routePolylineRef.current) {
            map.removeLayer(routePolylineRef.current);
          }

          routePolylineRef.current = L.polyline([[resolvedOriginLat, resolvedOriginLng], [resolvedDestLat, resolvedDestLng]], {
            color: '#007AFF',
            weight: 5,
            dashArray: '8, 8',
          }).addTo(map);

          const bounds = L.latLngBounds();
          bounds.extend([resolvedOriginLat, resolvedOriginLng]);
          bounds.extend([resolvedDestLat, resolvedDestLng]);
          map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
        });
    } else {
      if (routePolylineRef.current) {
        map.removeLayer(routePolylineRef.current);
        routePolylineRef.current = null;
      }
      map.setView([resolvedOriginLat, resolvedOriginLng], 15);
    }
  }, [
    mapLoaded,
    resolvedOriginLat,
    resolvedOriginLng,
    resolvedDestLat,
    resolvedDestLng,
    hasDestination,
    mode,
    nearbyBookings.length
  ]);

  return (
    <div className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-gray-200">
      {/* Leaflet Map Div */}
      <div ref={mapRef} className="w-full h-full min-h-[300px] z-10" />

      {/* Loading Overlay */}
      {isRouting && (
        <div className="absolute top-3 left-3 z-20 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md border border-gray-200 flex items-center gap-2 text-xs font-extrabold text-gray-800 animate-pulse">
          <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span>Routing...</span>
        </div>
      )}

      {/* Mode Badge & Recenter Quick Button */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleRecenter}
          className="bg-white/95 hover:bg-white text-gray-800 p-2 rounded-xl shadow-md border border-gray-200 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
          title="Recenter Map to Fit Captain and Customer"
        >
          <LocateFixed className="w-3.5 h-3.5 text-blue-600" />
        </button>

        
      </div>
    </div>
  );
}
