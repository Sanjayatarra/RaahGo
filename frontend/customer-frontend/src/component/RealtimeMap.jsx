import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Car, LocateFixed, Compass, Route, ChevronDown, ChevronUp, Clock, Milestone } from 'lucide-react';

export default function RealtimeMap({ pickup, destination, pickupCoords, destCoords, selectedRide, onRouteCalculated, onLocateMe }) {
  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const markersRef = useRef([]);
  const routePolylinesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const [routes, setRoutes] = useState([]);
  const [isRouting, setIsRouting] = useState(false);
  const [showSteps, setShowSteps] = useState(false);

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
    });

    // OpenStreetMap Standard Street Map tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

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

    // Smoothly fly & center map view to user's pickup location
    if (pickupCoords?.lat && pickupCoords?.lng && (!destCoords?.lat || !destCoords?.lng)) {
      map.flyTo([pickupCoords.lat, pickupCoords.lng], 16, { animate: true, duration: 0.8 });
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
      .addTo(map)
      .bindPopup(`<b>Your Live GPS Location</b><br/>${pickup || 'GPS Active'}`);
    
    markersRef.current.push(liveGpsMarker);

    // 1. Pickup Location Teardrop Pin Marker with 📍 Icon
    const pickupPinHtml = `
      <div style="position: relative; width: 44px; height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
        <div style="background-color: #34C759; color: white; width: 38px; height: 38px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 6px 16px rgba(0,0,0,0.4); z-index: 10;">
          <span style="transform: rotate(45deg); font-size: 16px; font-weight: bold;">📍</span>
        </div>
        <div style="width: 16px; height: 5px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: 1px; filter: blur(1px);"></div>
      </div>
    `;

    const pickupIcon = L.divIcon({
      className: 'custom-pickup-pin',
      html: pickupPinHtml,
      iconSize: [44, 54],
      iconAnchor: [22, 54],
    });

    const pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon, zIndexOffset: 3000 })
      .addTo(map)
      .bindPopup(`<b>Pickup Location</b><br/>${pickup || 'Your current location'}`);
    
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
        .addTo(map)
        .bindPopup(`<b>${cab.name}</b>`);

      markersRef.current.push(cabMarker);
    });

    // 3. Destination Marker & Simultaneous Multi-Route Rendering
    if (destCoords?.lat && destCoords?.lng) {
      const dLat = destCoords.lat;
      const dLng = destCoords.lng;

      const destPinHtml = `
        <div style="position: relative; width: 44px; height: 54px; display: flex; flex-direction: column; align-items: center; justify-content: flex-end;">
          <div style="background-color: #FF3B30; color: white; width: 38px; height: 38px; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; border: 3px solid white; box-shadow: 0 6px 16px rgba(0,0,0,0.4); z-index: 10;">
            <span style="transform: rotate(45deg); font-size: 16px; font-weight: bold;">🏁</span>
          </div>
          <div style="width: 16px; height: 5px; background: rgba(0,0,0,0.3); border-radius: 50%; margin-top: 1px; filter: blur(1px);"></div>
        </div>
      `;

      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: destPinHtml,
        iconSize: [44, 54],
        iconAnchor: [22, 54],
      });

      const destMarker = L.marker([dLat, dLng], { icon: destIcon, zIndexOffset: 3000 })
        .addTo(map)
        .bindPopup(`<b>Destination</b><br/>${destination}`);

      markersRef.current.push(destMarker);
      bounds.extend([dLat, dLng]);

      setIsRouting(true);
      
      // Immediately fit map bounds to center Pickup and Destination pins cleanly
      const routeBounds = L.latLngBounds([
        [pLat, pLng],
        [dLat, dLng]
      ]);
      map.invalidateSize();
      map.fitBounds(routeBounds, { padding: [40, 40], maxZoom: 15 });

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

              // Extract turn-by-turn steps
              const rawSteps = route.legs?.[0]?.steps || [];
              const steps = rawSteps.map((step) => {
                const stepDist = step.distance < 1000 ? `${step.distance.toFixed(0)}m` : `${(step.distance / 1000).toFixed(1)}km`;
                const name = step.name || step.ref || 'Unnamed Road';
                const type = step.maneuver?.type || 'turn';
                const modifier = step.maneuver?.modifier || '';

                let instruction = `Continue on ${name}`;
                if (type.includes('turn')) {
                  instruction = `Turn ${modifier || 'onto'} ${name}`;
                } else if (type.includes('depart')) {
                  instruction = `Head towards ${name}`;
                } else if (type.includes('arrive')) {
                  instruction = `Arrive at destination`;
                } else if (type.includes('roundabout') || type.includes('rotary')) {
                  instruction = `Take roundabout onto ${name}`;
                } else if (type.includes('fork') || type.includes('ramp')) {
                  instruction = `Take ramp/fork onto ${name}`;
                }

                return {
                  instruction,
                  distance: stepDist,
                  name
                };
              });

              return {
                index: idx,
                name: `Route ${idx + 1}`,
                summary: route.legs?.[0]?.summary || `Route ${idx + 1}`,
                distanceKm,
                durationMins,
                color: ROUTE_COLORS[idx % ROUTE_COLORS.length],
                latLngs,
                steps
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
            parsedRoutes.forEach((rt) => {
              const polyline = L.polyline(rt.latLngs, {
                color: rt.color,
                weight: rt.index === 0 ? 7 : 5,
                opacity: 0.9,
                lineCap: 'round',
                lineJoin: 'round'
              }).addTo(map);

              polyline.bindPopup(`<b>${rt.name} (${rt.summary})</b><br/>Distance: ${rt.distanceKm} km<br/>Duration: ${rt.durationMins} mins`);

              routePolylinesRef.current.push(polyline);
              rt.latLngs.forEach(([lLat, lLng]) => bounds.extend([lLat, lLng]));
            });

            map.invalidateSize();
            map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
          }
        })
        .catch((err) => {
          console.error('OSRM Multi-Route Error:', err);
          if (destCoords?.lat && destCoords?.lng) {
            const fitB = L.latLngBounds([[pLat, pLng], [destCoords.lat, destCoords.lng]]);
            map.invalidateSize();
            map.fitBounds(fitB, { padding: [40, 40], maxZoom: 15 });
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
    <div className="w-full h-full min-h-[440px] bg-white border border-[#E5E5EA] rounded-3xl overflow-hidden shadow-xl relative flex flex-col">
      {/* Map Header Status & Mode Indicator */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex items-center justify-between pointer-events-none gap-2">
        <div className="bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-[#E5E5EA] shadow-lg flex items-center gap-2 pointer-events-auto">
          <span className="w-2.5 h-2.5 rounded-full bg-[#007AFF] animate-ping"></span>
          <span className="text-xs font-extrabold text-[#1C1C1E] capitalize flex items-center gap-1.5">
            {selectedRide === 'bike' ? '🏍️ Bike Routes' : selectedRide === 'auto' ? '🛺 Auto Routes' : '🚗 Cab Routes'}
            {isRouting && ' (Calculating All Routes...)'}
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onLocateMe) {
              onLocateMe();
            }
            if (leafletInstance.current && pickupCoords?.lat) {
              leafletInstance.current.flyTo([pickupCoords.lat, pickupCoords.lng], 16, {
                animate: true,
                duration: 1
              });
            }
          }}
          className="bg-white hover:bg-[#F8F9FA] text-[#1C1C1E] p-2.5 rounded-2xl border border-[#E5E5EA] shadow-xl pointer-events-auto transition-all active:scale-95 cursor-pointer flex items-center gap-1 font-bold text-xs"
          title="Recenter Map to Current GPS Location"
        >
          <LocateFixed className="w-4 h-4 text-[#007AFF] animate-pulse" />
        </button>
      </div>

      {/* Floating Center Location Pin Overlay */}
      {(!destCoords?.lat || !destCoords?.lng) && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full z-[300] pointer-events-none flex flex-col items-center">
          <div className="bg-[#1C1C1E] text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-xl mb-1 border border-white/20 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse"></span>
            <span>Pickup Point</span>
          </div>
          <div className="w-9 h-9 bg-[#34C759] text-white rounded-full border-2 border-white shadow-2xl flex items-center justify-center font-bold text-base">
            📍
          </div>
          <div className="w-3.5 h-1 bg-black/40 rounded-full blur-[1px] mt-0.5"></div>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div ref={mapRef} className="w-full h-full min-h-[440px] z-10"></div>

      {/* Display ALL Routes Simultaneously in Bottom Summary Panel */}
      {destination && routes.length > 0 && (
        <div className="absolute bottom-4 left-4 right-4 z-[400] bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-[#E5E5EA] shadow-2xl space-y-3 max-h-72 overflow-y-auto animate-fade-in pointer-events-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold text-[#1C1C1E] flex items-center gap-1.5">
              <Route className="w-4 h-4 text-[#007AFF]" />
              <span>All Available Driving Routes ({routes.length})</span>
            </h4>

            {/* Collapsible Turn-by-Turn Steps Toggle */}
            <button
              type="button"
              onClick={() => setShowSteps(!showSteps)}
              className="text-[11px] font-extrabold text-[#007AFF] bg-[#007AFF]/10 hover:bg-[#007AFF]/20 px-3 py-1 rounded-xl flex items-center gap-1 transition-colors"
            >
              <Milestone className="w-3.5 h-3.5" />
              <span>{showSteps ? 'Hide Directions' : 'Turn-by-Turn'}</span>
              {showSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Cards for ALL Routes displayed at the same time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {routes.map((rt, idx) => (
              <div
                key={idx}
                className="p-3 rounded-2xl border bg-[#F8F9FA] flex items-center justify-between transition-all"
                style={{ borderColor: rt.color }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: rt.color }}
                  ></div>
                  <div>
                    <span className="text-xs font-extrabold text-[#1C1C1E] block leading-tight">
                      {rt.name} ({rt.summary})
                    </span>
                    <span className="text-[10px] text-[#636366] font-semibold block mt-0.5">
                      {selectedRide.toUpperCase()} Speed
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-extrabold text-[#1C1C1E] block">{rt.distanceKm} km</span>
                  <span className="text-[11px] font-extrabold text-[#34C759]">{rt.durationMins} mins</span>
                </div>
              </div>
            ))}
          </div>

          {/* Turn-by-Turn Steps Accordion for Main Route */}
          {showSteps && routes[0]?.steps && (
            <div className="pt-2 border-t border-[#E5E5EA] space-y-2 max-h-40 overflow-y-auto">
              <h5 className="text-[11px] font-extrabold text-[#3A3A3C] uppercase tracking-wider">
                Turn-by-Turn Directions ({routes[0].steps.length} steps)
              </h5>
              <div className="divide-y divide-[#F8F9FA]">
                {routes[0].steps.map((step, sIdx) => (
                  <div key={sIdx} className="py-1.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#F8F9FA] text-[#636366] text-[10px] font-extrabold flex items-center justify-center border border-[#E5E5EA]">
                        {sIdx + 1}
                      </span>
                      <span className="font-bold text-[#1C1C1E]">{step.instruction}</span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#636366] shrink-0 ml-2">{step.distance}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
