import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Car, LocateFixed, Compass, Route, Clock, Milestone } from 'lucide-react';

export default function RealtimeMap({ pickup, destination, pickupCoords, destCoords, mode = 'pickup', onRouteCalculated }) {
  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const markersRef = useRef([]);
  const routePolylinesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [isRouting, setIsRouting] = useState(false);

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
      zoom: 14,
      zoomControl: false,
    });

    // Clean, modern OpenStreetMap CartoDB tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    leafletInstance.current = map;
  }, [mapLoaded]);

  // Fetch & Render Route on Map
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

    const bounds = L.latLngBounds();

    // 1. Origin Marker (Green Pin for Pickup or Taxi for Captain)
    const originIcon = L.divIcon({
      className: 'custom-pickup-pin',
      html: mode === 'in_trip' 
        ? `<div style="background-color: #34C759; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">🟢</div>`
        : `<div style="background-color: #FFC000; color: black; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; border: 3px solid black; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">🛺</div>`,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const originMarker = L.marker([pLat, pLng], { icon: originIcon })
      .addTo(map)
      .bindPopup(mode === 'in_trip' ? `<b>Pickup Point</b><br/>${pickup || 'Passenger Location'}` : `<b>Captain Current Location</b>`);
    
    markersRef.current.push(originMarker);
    bounds.extend([pLat, pLng]);

    // 2. Destination Marker (Red Pin for Dropoff or Pickup Pin for Navigation)
    if (destCoords?.lat && destCoords?.lng) {
      const dLat = destCoords.lat;
      const dLng = destCoords.lng;

      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `<div style="background-color: #FF3B30; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 16px; border: 3px solid white; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">🔴</div>`,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const destMarker = L.marker([dLat, dLng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<b>Destination Dropoff</b><br/>${destination || 'Destination Address'}`);

      markersRef.current.push(destMarker);
      bounds.extend([dLat, dLng]);

      // Fetch Real-time OSRM Driving Route
      setIsRouting(true);
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson&steps=true`;

      fetch(osrmUrl)
        .then((res) => res.json())
        .then((data) => {
          setIsRouting(false);
          if (!map || !map.getContainer()) return;

          if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            const mainRoute = data.routes[0];
            const coordinates = mainRoute.geometry.coordinates.map((coord) => [coord[1], coord[0]]);

            // Render Route Polyline
            const polyline = L.polyline(coordinates, {
              color: '#007AFF',
              weight: 6,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }).addTo(map);

            routePolylinesRef.current.push(polyline);

            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
            }

            const distKm = (mainRoute.distance / 1000).toFixed(1);
            const durationMins = Math.max(2, Math.round((mainRoute.duration / 60) * 1.0));

            if (onRouteCalculated) {
              onRouteCalculated({ distanceKm: distKm, durationMins });
            }
          }
        })
        .catch((err) => {
          setIsRouting(false);
          if (!map || !map.getContainer()) return;
          console.log('OSRM Routing Notice:', err);
          // Fallback straight line
          const fallbackPolyline = L.polyline([[pLat, pLng], [dLat, dLng]], {
            color: '#007AFF',
            weight: 5,
            dashArray: '8, 8',
          }).addTo(map);

          routePolylinesRef.current.push(fallbackPolyline);
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [60, 60] });
          }
        });
    } else {
      map.setView([pLat, pLng], 15);
    }
  }, [mapLoaded, pickupCoords, destCoords, mode]);

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-3xl overflow-hidden shadow-xl border border-[#E5E5EA]">
      {/* Leaflet Map Div */}
      <div ref={mapRef} className="w-full h-full min-h-[380px] z-10" />

      {/* Loading Overlay */}
      {isRouting && (
        <div className="absolute top-4 left-4 z-20 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl shadow-lg border border-[#E5E5EA] flex items-center gap-2 text-xs font-bold text-[#1C1C1E]">
          <div className="w-4 h-4 border-2 border-[#007AFF] border-t-transparent rounded-full animate-spin"></div>
          <span>Calculating Navigation Route...</span>
        </div>
      )}

      {/* Mode Badge */}
      <div className="absolute top-4 right-4 z-20 bg-[#1C1C1E]/90 text-white backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg border border-white/20 text-[11px] font-extrabold flex items-center gap-1.5">
        <Compass className="w-3.5 h-3.5 text-[#FFC000]" />
        <span>{mode === 'in_trip' ? '🚗 Trip to Dropoff' : '🛺 Driving to Pickup'}</span>
      </div>
    </div>
  );
}
