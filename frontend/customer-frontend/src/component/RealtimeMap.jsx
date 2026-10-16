import React, { useEffect, useRef, useState } from 'react';
import { LocateFixed } from 'lucide-react';
import { getDeviceGpsLocation, reverseGeocodeGps } from '../common/locationService';

export default function RealtimeMap({ pickup, destination, pickupCoords, destCoords, selectedRide, onRouteCalculated, onLocateMe, onPickupChange, mode = 'booking' }) {
  const mapRef = useRef(null);
  const leafletInstance = useRef(null);
  const markersRef = useRef([]);
  const routePolylinesRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [currentLiveGps, setCurrentLiveGps] = useState(null);

  const [routes, setRoutes] = useState([]);
  const [isRouting, setIsRouting] = useState(false);

  // Colors for rendering simultaneous routes on map
  const ROUTE_COLORS = ['#007AFF', '#FF9500', '#34C759', '#AF52DE'];

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

    // Automatically get live device GPS coordinates
    getDeviceGpsLocation().then((gps) => {
      if (gps?.lat && gps?.lon) {
        setCurrentLiveGps({ lat: gps.lat, lng: gps.lon });
        if (!pickup && onPickupChange) {
          onPickupChange(gps.address, { lat: gps.lat, lng: gps.lon });
        }
      }
    }).catch((err) => {
      console.warn('Live GPS fetch notice:', err);
    });

    return () => {
      if (leafletInstance.current) {
        leafletInstance.current.remove();
        leafletInstance.current = null;
      }
    };
  }, []);

  // Initialize Map dynamically with GPS coordinates
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || leafletInstance.current) return;

    const L = window.L;
    if (!L) return;

    const initMapWithCoords = (lat, lng) => {
      if (leafletInstance.current) return;
      const map = L.map(mapRef.current, {
        center: [lat, lng],
        zoom: 15,
        zoomControl: false,
        attributionControl: false,
      });

      // Custom Backend Map Tile API
      L.tileLayer('/api/v1/services/tiles/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);

      leafletInstance.current = map;
    };

    if (pickupCoords?.lat && pickupCoords?.lng) {
      initMapWithCoords(pickupCoords.lat, pickupCoords.lng);
    } else if (currentLiveGps?.lat && currentLiveGps?.lng) {
      initMapWithCoords(currentLiveGps.lat, currentLiveGps.lng);
    } else {
      getDeviceGpsLocation().then((gps) => {
        initMapWithCoords(gps.lat, gps.lon);
      }).catch(() => {
        initMapWithCoords(28.6139, 77.2090);
      });
    }
  }, [mapLoaded, pickupCoords, currentLiveGps]);

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

  // Fetch & Render ALL Routes Simultaneously on Map & Handle Map Dragging
  useEffect(() => {
    let isCancelled = false;

    if (!mapLoaded || !leafletInstance.current || !mapRef.current) return;

    const L = window.L;
    const map = leafletInstance.current;
    if (!L || !map || !map._container || !map._panes) return;

    // Clear existing markers & route polylines safely
    try {
      markersRef.current.forEach((m) => {
        if (m && map.hasLayer && map.hasLayer(m)) map.removeLayer(m);
      });
      markersRef.current = [];

      routePolylinesRef.current.forEach((poly) => {
        if (poly && map.hasLayer && map.hasLayer(poly)) map.removeLayer(poly);
      });
      routePolylinesRef.current = [];
    } catch (e) {
      console.warn('Map cleanup notice:', e);
    }

    const activeLat = parseFloat(pickupCoords?.lat || currentLiveGps?.lat);
    const activeLng = parseFloat(pickupCoords?.lng || currentLiveGps?.lng);

    if (isNaN(activeLat) || isNaN(activeLng)) return;

    const pLat = activeLat;
    const pLng = activeLng;

    // Smoothly center map view to user's pickup location
    if (!isNaN(pLat) && !isNaN(pLng) && (!destCoords?.lat || !destCoords?.lng)) {
      try {
        if (map._container) {
          map.invalidateSize();
          map.setView([pLat, pLng], 15);
        }
      } catch (e) {}
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

    try {
      const liveGpsMarker = L.marker([pLat, pLng], { icon: liveGpsIcon, zIndexOffset: 2000 })
        .addTo(map);
      markersRef.current.push(liveGpsMarker);
    } catch (e) {}

    // 1. Pickup Location Teardrop Pin Marker - ONLY added when destination is active (avoiding duplicate pin with center overlay)
    const dLat = parseFloat(destCoords?.lat);
    const dLng = parseFloat(destCoords?.lng);
    const hasValidDest = !isNaN(dLat) && !isNaN(dLng);

    if (hasValidDest) {
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

      try {
        const pickupMarker = L.marker([pLat, pLng], { icon: pickupIcon, zIndexOffset: 3000 })
          .addTo(map);
        markersRef.current.push(pickupMarker);
      } catch (e) {}
    }
    bounds.extend([pLat, pLng]);

    // 2. Real-time Nearby Partners with Green Accent Pins
    const vehicleIcon = selectedRide === 'bike' ? '🏍️' : selectedRide === 'auto' ? '🛺' : selectedRide === 'suv' ? '🚙' : '🚗';
    const nearbyCabs = [
      { lat: pLat + 0.0025, lng: pLng + 0.002, icon: vehicleIcon, name: `${selectedRide.toUpperCase()} (1m away)` },
      { lat: pLat - 0.0018, lng: pLng + 0.0035, icon: vehicleIcon, name: `${selectedRide.toUpperCase()} (3m away)` },
      { lat: pLat + 0.0032, lng: pLng - 0.0025, icon: vehicleIcon, name: `${selectedRide.toUpperCase()} (4m away)` },
      { lat: pLat - 0.0028, lng: pLng - 0.002, icon: vehicleIcon, name: `${selectedRide.toUpperCase()} (2m away)` }
    ];

    nearbyCabs.forEach((cab) => {
      try {
        const cabIcon = L.divIcon({
          className: 'custom-cab-pin',
          html: `<div style="background: white; border: 2.5px solid #22C55E; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 16px; box-shadow: 0 4px 14px rgba(34,197,94,0.35); transform: scale(1.05); transition: all 0.3s ease;">${cab.icon}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const cabMarker = L.marker([cab.lat, cab.lng], { icon: cabIcon })
          .addTo(map);

        markersRef.current.push(cabMarker);
      } catch (e) {}
    });

    // 3. Destination Marker & Simultaneous Multi-Route Rendering
    if (hasValidDest) {
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

      try {
        const destMarker = L.marker([dLat, dLng], { icon: destIcon, zIndexOffset: 3000 })
          .addTo(map);

        markersRef.current.push(destMarker);
      } catch (e) {}

      bounds.extend([dLat, dLng]);
      setIsRouting(true);

      // Immediately fit map bounds to center Pickup and Destination pins cleanly
      const initialRouteBounds = L.latLngBounds([
        [pLat, pLng],
        [dLat, dLng]
      ]);
      if (initialRouteBounds.isValid && initialRouteBounds.isValid()) {
        try {
          if (map._container) {
            map.invalidateSize();
            map.fitBounds(initialRouteBounds, {
              paddingTopLeft: [40, 70],
              paddingBottomRight: [40, 40],
              maxZoom: 15
            });
          }
        } catch (e) {}
      }

      // Query Multi-Route Driving Engine via Django REST Framework Backend Proxy API
      const backendRouteUrl = `/api/v1/services/location/route/?pLat=${pLat}&pLng=${pLng}&dLat=${dLat}&dLng=${dLng}`;

      fetch(backendRouteUrl)
        .then((res) => res.json())
        .then((data) => {
          if (isCancelled || !leafletInstance.current || !mapRef.current || !map._container || !map._panes) return;

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

            if (!isCancelled) {
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
                try {
                  if (map._panes && map._panes.overlayPane) {
                    const polyline = L.polyline(rt.latLngs, {
                      color: rt.color,
                      weight: rt.index === 0 ? 7 : 5,
                      opacity: 0.9,
                      lineCap: 'round',
                      lineJoin: 'round'
                    }).addTo(map);

                    routePolylinesRef.current.push(polyline);
                    rt.latLngs.forEach(([lLat, lLng]) => routeBounds.extend([lLat, lLng]));
                  }
                } catch (e) {}
              });

              if (routeBounds.isValid && routeBounds.isValid()) {
                try {
                  if (map._container) {
                    map.invalidateSize();
                    map.fitBounds(routeBounds, {
                      padding: [25, 25],
                      maxZoom: 15
                    });
                  }
                } catch (e) {}
              }
            }
          }
        })
        .catch((err) => {
          if (isCancelled || !leafletInstance.current || !mapRef.current || !map._container) return;
          console.error('OSRM Multi-Route Error:', err);
          if (hasValidDest) {
            const fitB = L.latLngBounds([[pLat, pLng], [dLat, dLng]]);
            if (fitB.isValid && fitB.isValid()) {
              try {
                if (map._container) {
                  map.invalidateSize();
                  map.fitBounds(fitB, {
                    padding: [25, 25],
                    maxZoom: 15
                  });
                }
              } catch (e) {}
            }
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setIsRouting(false);
          }
        });
    } else {
      try {
        if (map._container) {
          map.invalidateSize();
          map.setView([pLat, pLng], 15);
        }
      } catch (e) {}
      setRoutes([]);
    }

    // Map drag and click listeners to detect and update pickup location in real-time
    const handleCenterChange = async () => {
      if (isCancelled || !map || !map._container || (destCoords?.lat && destCoords?.lng)) return;
      const center = map.getCenter();
      const lat = center.lat;
      const lng = center.lng;
      if (onPickupChange) {
        onPickupChange('Detecting location...', { lat, lng });
        try {
          const address = await reverseGeocodeGps(lat, lng);
          if (!isCancelled) onPickupChange(address, { lat, lng });
        } catch (err) {
          if (!isCancelled) onPickupChange(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, { lat, lng });
        }
      }
    };

    const handleMapClick = async (e) => {
      if (isCancelled || !map || !map._container || (destCoords?.lat && destCoords?.lng)) return;
      const { lat, lng } = e.latlng;
      map.panTo([lat, lng]);
      if (onPickupChange) {
        onPickupChange('Detecting location...', { lat, lng });
        try {
          const address = await reverseGeocodeGps(lat, lng);
          if (!isCancelled) onPickupChange(address, { lat, lng });
        } catch (err) {
          if (!isCancelled) onPickupChange(`Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, { lat, lng });
        }
      }
    };

    map.on('dragend', handleCenterChange);
    map.on('click', handleMapClick);

    return () => {
      isCancelled = true;
      if (map && map._container) {
        map.off('dragend', handleCenterChange);
        map.off('click', handleMapClick);
      }
    };
  }, [mapLoaded, pickupCoords, destCoords, selectedRide]);

  return (
    <div className="w-full h-full min-h-[220px] bg-gray-100 rounded-3xl overflow-hidden shadow-md relative">
      {/* Map Header Status & Mode Indicator (Positioned nicely below radar pill when searching) */}
      <div className={`absolute left-3 right-3 z-[400] flex items-center justify-between pointer-events-none gap-2 ${mode === 'searching' ? 'top-16' : 'top-3'}`}>
        <div className="bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full border border-gray-200/80 shadow-md flex items-center gap-2 pointer-events-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
          <span className="text-xs font-black text-gray-900 capitalize flex items-center gap-1.5">
            {selectedRide === 'bike' ? '🏍️ Bike Routes' : selectedRide === 'auto' ? '🛺 Auto Routes' : '🚗 Cab Routes'}
            {isRouting && ' (Routing...)'}
          </span>
        </div>

        <button
          type="button"
          onClick={async () => {
            if (onLocateMe) {
              onLocateMe();
            }
            try {
              const gps = await getDeviceGpsLocation(true);
              if (gps?.lat && gps?.lon) {
                if (onPickupChange) {
                  onPickupChange(gps.address, { lat: gps.lat, lng: gps.lon });
                }
                if (leafletInstance.current) {
                  leafletInstance.current.invalidateSize();
                  leafletInstance.current.flyTo([gps.lat, gps.lon], 16, {
                    animate: true,
                    duration: 0.8
                  });
                }
              }
            } catch (e) {
              console.warn('Locate button notice:', e);
            }
          }}
          className="w-10 h-10 bg-white hover:bg-gray-50 text-gray-800 rounded-full border border-gray-200/80 shadow-md pointer-events-auto transition-all active:scale-95 cursor-pointer flex items-center justify-center font-bold"
          title="Recenter Map to Current GPS Location"
        >
          <LocateFixed className="w-4.5 h-4.5 text-emerald-600 animate-pulse" />
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
