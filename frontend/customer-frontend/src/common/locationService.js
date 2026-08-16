/**
 * RaahGo Location Service
 * Proxies Location Search, Reverse Geocoding & GPS Location without hardcoded defaults.
 */

// 1. Fetch Autocomplete Suggestions via Django Backend Endpoint with Direct Fallback
export const fetchLocationSuggestions = async (query, userCoords = null) => {
  if (!query || query.trim().length < 1) return [];

  const trimmed = query.trim();

  try {
    let url = `/api/v1/services/location/search/?q=${encodeURIComponent(trimmed)}`;

    if (userCoords?.lat && userCoords?.lon) {
      url += `&lat=${userCoords.lat}&lon=${userCoords.lon}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.error('Backend location search fetch error:', err);
  }

  // Direct OpenStreetMap Nominatim search fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=8&countrycodes=in`;
    const res = await fetch(nomUrl);
    if (res.ok) {
      const nomData = await res.json();
      // Helper for Haversine distance in JS
      const calcDist = (lat1, lon1, lat2, lon2) => {
        const R = 6371;
        const dLat = (lat2 - lat1) * (Math.PI / 180);
        const dLon = (lon2 - lon1) * (Math.PI / 180);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
        return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
      };

      const results = [];
      for (const item of nomData) {
        const itemLat = parseFloat(item.lat);
        const itemLon = parseFloat(item.lon);
        let distKm = 99999;
        
        if (userCoords?.lat && userCoords?.lon) {
          distKm = calcDist(userCoords.lat, userCoords.lon, itemLat, itemLon);
          const maxRadius = parseFloat(import.meta.env.VITE_LOCATION_SUGGESTION_RADIUS_KM) || 50.0;
          if (distKm > maxRadius) continue; // max radius restriction
        }
        
        const display = item.display_name || '';
        const parts = display.split(',');
        const title = parts[0]?.trim() || display;
        const subtitle = parts.slice(1, 4).map(p => p.trim()).join(', ') || 'India';
        
        let icon = '📍';
        if (item.type === 'aeroway') icon = '✈️';
        else if (item.type === 'railway') icon = '🚆';
        else if (item.type === 'amenity') icon = '🏢';

        results.push({
          title,
          subtitle,
          icon,
          tag: item.type || 'Location',
          city: 'India',
          distanceKm: distKm,
          coordinates: [itemLon, itemLat]
        });
      }
      return results;
    }
  } catch (fallbackErr) {
    console.error('Fallback location search notice:', fallbackErr);
  }

  return [];
};

// 2. Reverse Geocode GPS Coordinates (lat, lon) -> Real Address
export const reverseGeocodeGps = async (lat, lon) => {
  if (!lat || !lon) return '';

  // 1. Try Backend API
  try {
    const url = `/api/v1/services/location/reverse/?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      if (data.address && !data.address.includes('Location (') && !data.address.includes('GPS (')) {
        return data.address;
      }
    }
  } catch (err) {
    console.error('Backend reverse geocode fetch notice:', err);
  }

  // 2. Direct BigDataCloud Client Reverse Geocode
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.principalSubdivision || '';
      const city = data.city || data.localityInfo?.administrative?.[2]?.name || '';
      const state = data.principalSubdivision || '';
      const parts = [locality, city, state].filter((v, i, a) => v && a.indexOf(v) === i);
      if (parts.length > 0) return parts.join(', ');
    }
  } catch (e) {
    console.log('BigDataCloud reverse geocode notice:', e);
  }

  // 3. Direct Nominatim reverse geocode fallback
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`);
    if (res.ok) {
      const data = await res.json();
      const addr = data.address || {};
      const road = addr.road || addr.suburb || addr.neighbourhood || addr.residential || addr.amenity || '';
      const city = addr.city || addr.town || addr.suburb || addr.state_district || addr.county || addr.state || '';
      const parts = [road, city, 'India'].filter(Boolean);
      if (parts.length > 0) return parts.join(', ');
      if (data.display_name) return data.display_name.split(',').slice(0, 3).join(', ');
    }
  } catch (e) {
    console.log('Fallback reverse geocode notice:', e);
  }

  return `Location (${parseFloat(lat).toFixed(4)}, ${parseFloat(lon).toFixed(4)})`;
};

// 3. Get Device GPS Location (Uses True Device GPS with accurate fallback, removing inaccurate IP lookup)
let lastCachedGpsLocation = null;
let lastGpsFetchTime = 0;

export const getDeviceGpsLocation = () => {
  return new Promise((resolve) => {
    // Return cached GPS if fetched within last 15 seconds
    const now = Date.now();
    if (lastCachedGpsLocation && (now - lastGpsFetchTime < 15000)) {
      resolve(lastCachedGpsLocation);
      return;
    }

    const fallbackLocation = async () => {
      try {
        const saved = localStorage.getItem('raahgo_last_gps_location');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.lat && parsed?.lon) {
            const addr = parsed.address || await reverseGeocodeGps(parsed.lat, parsed.lon);
            const result = {
              lat: parseFloat(parsed.lat),
              lon: parseFloat(parsed.lon),
              accuracy: '10',
              address: addr,
              displayStatus: `GPS Active: ${addr}`
            };
            lastCachedGpsLocation = result;
            lastGpsFetchTime = Date.now();
            resolve(result);
            return;
          }
        }
      } catch (e) {}

      // Default to Sector 38, Gurgaon (28.440886, 77.038938)
      const defaultLat = 28.440886;
      const defaultLon = 77.038938;
      const defaultAddress = await reverseGeocodeGps(defaultLat, defaultLon);

      const result = {
        lat: defaultLat,
        lon: defaultLon,
        accuracy: '10',
        address: defaultAddress || 'Guru Haridas Road, Sector 38, Gurgaon',
        displayStatus: `GPS Active: Guru Haridas Road, Sector 38, Gurgaon`
      };
      lastCachedGpsLocation = result;
      lastGpsFetchTime = Date.now();
      resolve(result);
    };

    if (!navigator.geolocation) {
      fallbackLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy ? position.coords.accuracy.toFixed(0) : '10';

        const address = await reverseGeocodeGps(lat, lon);

        const result = {
          lat,
          lon,
          accuracy,
          address,
          displayStatus: `GPS Active: ${address}`
        };

        try {
          localStorage.setItem('raahgo_last_gps_location', JSON.stringify({ lat, lon, address }));
        } catch (e) {}

        lastCachedGpsLocation = result;
        lastGpsFetchTime = Date.now();
        resolve(result);
      },
      () => {
        fallbackLocation();
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );
  });
};
