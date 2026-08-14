import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';

export default function RealtimeMap({ pickup, destination, pickupCoords, destCoords, selectedRide, onRouteCalculated, onLocateMe }) {
  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const markersRef = useRef([]);
  const routePolylinesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [routes, setRoutes] = useState([]);
  const [isRouting, setIsRouting] = useState(false);

  // Colors for rendering simultaneous routes on map
  const ROUTE_COLORS = ['#007AFF', '#FF9500', '#34C759', '#AF52DE'];

  // Default coordinates (Delhi Center)
  const defaultLat = 28.6139;
  const defaultLng = 77.2090;

  useEffect(() => {
    // Load Leaflet CSS & JS dynamically
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.async = true;

    script.onload = () => {
      setMapLoaded(true);
    };

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
      center: [defaultLat, defaultLng],
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    // OpenStreetMap Standard Street Map tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: ''
    }).addTo(map);

    leafletInstance.current = map;
  }, [mapLoaded]);

  // Speed multiplier based on selected vehicle type
  const getVehicleSpeedMultiplier = (rideType) => {
    switch (rideType) {
      case 'bike':
        return 0.82; // Bike is ~18% faster in city traffic by weaving through congestion
      case 'auto':
        return 1.25; // Auto max speed ~35-40km/h (25% longer duration)
      case 'suv':
      case 'sedan':
      default:
        return 1.0; // Standard car speed
    }
  };

  // Fetch & Render ALL Routes Simultaneously on Map
  useEffect(() => {
    if (!mapLoaded || !leafletInstance.current) return;

    const L = window.L;
    const map = leafletInstance.current;
    if (!L || !map) return;

    // Clear existing markers & route polylines
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    routePolylinesRef.current.forEach((poly) => map.removeLayer(poly));
    routePolylinesRef.current = [];

    const pLat = pickupCoords?.lat || defaultLat;
    const pLng = pickupCoords?.lng || defaultLng;

    // Smoothly center map view to user's pickup location (avoid flyTo if map is hidden to prevent NaN crash)
    if (pickupCoords?.lat && pickupCoords?.lng && (!destCoords?.lat || !destCoords?.lng)) {
      const size = map.getSize();
      if (size.x > 0 && size.y > 0) {
        map.flyTo([pickupCoords.lat, pickupCoords.lng], 16, { animate: true, duration: 0.8 });
      } else {
        map.setView([pickupCoords.lat, pickupCoords.lng], 16);
      }
    }

    const bounds = L.latLngBounds();

    // 0. Live GPS Blue Pulsing Radar Icon
    const liveGpsHtml = `
      <div style="position: relative; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 42px; height: 42px; background: rgba(0, 122, 255, 0.35); border-radius: 50%; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
        <div style="position: absolute; width: 24px; height: 24px; background: rgba(0, 122, 255, 0.2); border-radius: 50%;"></div>
        <div style="background-color: #007AFF; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px rgba(0,122,255,0.8); z-index: 5;"></div>
      </div>
    `;

    const liveGpsIcon = L.divIcon({
      className: 'custom-live-gps-dot',
      html: liveGpsHtml,
      iconSize: [48, 48],
      iconAnchor: [24, 24],
    });

    const liveGpsMarker = L.marker([pLat, pLng], { icon: liveGpsIcon, zIndexOffset: 2000 })
      .addTo(map);
    
    markersRef.current.push(liveGpsMarker);

    // 1. Pickup Location Teardrop Pin Marker with Badge
    const pickupPinHtml = `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        <div style="background-color: #34C759; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); z-index: 10;">
          <span style="transform: rotate(45deg); font-size: 15px; font-weight: bold;">📍</span>
        </div>
        <div style="width: 12px; height: 3px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: 1px; filter: blur(1px);"></div>
        <div style="margin-top: 3px; background: #111827; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: nowrap; border: 1px solid rgba(255,255,255,0.2);">
          <span style="width: 5px; height: 5px; border-radius: 50%; background-color: #34C759; display: inline-block;"></span>
          <span>Pickup</span>
        </div>
      </div>
    `;

    const pickupIcon = L.divIcon({
      className: 'custom-pickup-pin',
      html: pickupPinHtml,
      iconSize: [80, 60],
      iconAnchor: [40, 26],
    });

    const pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon, zIndexOffset: 3000 })
      .addTo(map);
    
    markersRef.current.push(pickupMarker);
    bounds.extend([pLat, pLng]);

    // 2. Real-time Nearby Cabs
    const vehicleIcon = selectedRide === 'bike' ? '🏍️' : selectedRide === 'auto' ? '🛺' : selectedRide === 'suv' ? '🚙' : '🚗';
    const nearbyCabs = [
      { lat: pLat + 0.003, lng: pLng + 0.002, icon: vehicleIcon, name: `${selectedRide.toUpperCase()} (1m away)` },
      { lat: pLat - 0.002, lng: pLng + 0.004, icon: vehicleIcon, name: `${selectedRide.toUpperCase()} (3m away)` },
      { lat: pLat + 0.004, lng: pLng - 0.003, icon: vehicleIcon, name: `${selectedRide.toUpperCase()} (4m away)` }
    ];

    nearbyCabs.forEach((cab) => {
      const cabIcon = L.divIcon({
        className: 'custom-cab-pin',
        html: `<div style="background: white; border: 2px solid #FFC000; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); transform: scale(1.1); transition: all 0.3s ease;">${cab.icon}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const cabMarker = L.marker([cab.lat, cab.lng], { icon: cabIcon })
        .addTo(map);

      markersRef.current.push(cabMarker);
    });

    // 3. Destination Marker & Simultaneous Multi-Route Rendering
    if (destCoords?.lat && destCoords?.lng) {
      const dLat = destCoords.lat;
      const dLng = destCoords.lng;

      const destPinHtml = `
        <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
          <div style="background-color: #FF3B30; color: white; width: 34px; height: 34px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 2.5px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.35); z-index: 10;">
            <span style="transform: rotate(45deg); font-size: 15px; font-weight: bold;">🏁</span>
          </div>
          <div style="width: 12px; height: 3px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: 1px; filter: blur(1px);"></div>
          <div style="margin-top: 3px; background: #111827; color: white; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 9999px; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3); white-space: nowrap; border: 1px solid rgba(255,255,255,0.2);">
            <span style="width: 5px; height: 5px; border-radius: 50%; background-color: #FF3B30; display: inline-block;"></span>
            <span>Drop</span>
          </div>
        </div>
      `;

      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: destPinHtml,
        iconSize: [80, 60],
        iconAnchor: [40, 26],
      });

      const destMarker = L.marker([dLat, dLng], { icon: destIcon, zIndexOffset: 3000 })
        .addTo(map);

      markersRef.current.push(destMarker);
      bounds.extend([dLat, dLng]);

      setIsRouting(true);
      
      // Immediately fit map bounds to center Pickup and Destination pins cleanly
      const routeBounds = L.latLngBounds([
        [pLat, pLng],
        [dLat, dLng]
      ]);
      map.invalidateSize();
      map.fitBounds(routeBounds, {
        paddingTopLeft: [40, 70],
        paddingBottomRight: [40, 40],
        maxZoom: 15
      });

      // Query Multi-Route Driving Engine via Django REST Framework Backend Proxy API
      const backendRouteUrl = `/api/v1/services/location/route/?pLat=${pLat}&pLng=${pLng}&dLat=${dLat}&dLng=${dLng}`;

      fetch(backendRouteUrl)
        .then((res) => res.json())
        .then((data) => {
          if (data && data.routes && data.routes.length > 0) {
            const multiplier = getVehicleSpeedMultiplier(selectedRide);

            const parsedRoutes = data.routes.map((route, idx) => {
              const latLngs = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
              const distanceKm = (route.distance / 1000).toFixed(1);
              const durationMins = Math.max(2, Math.round((route.duration / 60) * multiplier));

              return {
                index: idx,
                name: `Route ${idx + 1}`,
                summary: route.legs?.[0]?.summary || `Route ${idx + 1}`,
                distanceKm,
                durationMins,
                color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
                latLngs
              };
            });

            setRoutes(parsedRoutes);
            const mainRoute = parsedRoutes[0];

            if (onRouteCalculated) {
              onRouteCalculated({
                distanceKm: mainRoute.distanceKm,
                durationMins: mainRoute.durationMins,
                allRoutes: parsedRoutes,
                rideType: selectedRide
              });
            }

            // Draw ALL Polylines Simultaneously on the Map!
            const routeBounds = L.latLngBounds();
            routeBounds.extend([pLat, pLng]);
            routeBounds.extend([dLat, dLng]);

            parsedRoutes.forEach((rt) => {
              const polyline = L.polyline(rt.latLngs, {
                color: rt.color,
                weight: rt.index === 0 ? 7 : 5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              routePolylinesRef.current.push(polyline);
              rt.latLngs.forEach(([lLat, lLng]) => routeBounds.extend([lLat, lLng]));
            });

            map.invalidateSize();
            map.fitBounds(routeBounds, {
              padding: [25, 25],
              maxZoom: 15
            });

            setTimeout(() => {
              if (map && routeBounds.isValid()) {
                map.invalidateSize();
                map.fitBounds(routeBounds, {
                  padding: [25, 25],
                  maxZoom: 15
                });
              }
            }, 150);
          }
        })
        .catch((err) => {
          console.error('OSRM Multi-Route Error:', err);
          if (destCoords?.lat && destCoords?.lng) {
            const fitB = L.latLngBounds([[pLat, pLng], [destCoords.lat, destCoords.lng]]);
            map.invalidateSize();
            map.fitBounds(fitB, {
              padding: [25, 25],
              maxZoom: 15
            });
          }
        })
        .finally(() => {
          setIsRouting(false);
        });
    } else {
      map.invalidateSize();
      map.setView([pLat, pLng], 15);
      setRoutes([]);
    }
  }, [mapLoaded, pickup, destination, pickupCoords, destCoords, selectedRide]);

  return (
    <div className="w-full h-full min-h-[220px] bg-gray-100 rounded-3xl overflow-hidden shadow-md relative">
      {/* Map Header Status & Mode Indicator */}
      <div className="absolute top-3 left-3 right-3 z-[400] flex items-center justify-between pointer-events-none gap-2">
        <div className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-200 shadow-md flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
          <span className="text-xs font-extrabold text-gray-900 capitalize flex items-center gap-1.5">
            {selectedRide === 'bike' ? '🏍️ Bike Routes' : selectedRide === 'auto' ? '🛺 Auto Routes' : '🚗 Cab Routes'}
            {isRouting && ' (Routing...)'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onLocateMe) {
              onLocateMe();
            }
            if (leafletInstance.current && pickupCoords?.lat) {
              leafletInstance.current.invalidateSize();
              leafletInstance.current.setView([pickupCoords.lat, pickupCoords.lng], 15);
            }
          }}
          className="bg-white hover:bg-gray-50 text-gray-900 p-2 rounded-full border border-gray-200 shadow-md pointer-events-auto transition-all active:scale-95 cursor-pointer flex items-center gap-1 font-bold text-xs"
          title="Recenter Map to Current GPS Location"
        >
          <LocateFixed className="w-4 h-4 text-blue-500 animate-pulse" />
        </button>
      </div>

      {/* Floating Center Location Pin Overlay (Only when no destination) */}
      {(!destCoords?.lat || !destCoords?.lng) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[300] pointer-events-none flex flex-col items-center">
          <div className="bg-gray-900 text-white text-[11px] font-black px-2.5 py-1 rounded-full shadow-xl mb-1 border border-white/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            <span>Pickup Point</span>
          </div>
          <div className="w-9 h-9 bg-green-500 text-white rounded-full border-2 border-white shadow-2xl flex items-center justify-center font-bold text-base">
            📍
          </div>
          <div className="w-3.5 h-1 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div ref={mapRef} className="absolute inset-0 w-full h-full z-10"></div>
    </div>
  );
}
