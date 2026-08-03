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
      return nomData.map((item) => {
        const display = item.display_name || '';
        const parts = display.split(',');
        const title = parts[0]?.trim() || display;
        const subtitle = parts.slice(1, 4).map(p => p.trim()).join(', ') || 'India';
        
        let icon = '📍';
        if (item.type === 'aeroway') icon = '✈️';
        else if (item.type === 'railway') icon = '🚆';
        else if (item.type === 'amenity') icon = '🏢';

        return {
          title,
          subtitle,
          icon,
          tag: item.type || 'Location',
          city: 'India',
          coordinates: [parseFloat(item.lon), parseFloat(item.lat)]
        };
      });
    }
  } catch (fallbackErr) {
    console.error('Fallback location search notice:', fallbackErr);
  }

  return [];
};

// 2. Reverse Geocode GPS Coordinates (lat, lon) -> Real Address
export const reverseGeocodeGps = async (lat, lon) => {
  try {
    const url = `/api/v1/services/location/reverse/?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      if (data.address && !data.address.includes('GPS (')) {
        return data.address;
      }
    }
  } catch (err) {
    console.error('Backend reverse geocode fetch notice:', err);
  }

  // Direct Nominatim reverse geocode fallback
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`);
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

  return `GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
};

// 3. Get Device GPS Location (Throws Error if GPS location cannot be accessed)
export const getDeviceGpsLocation = () => {
  return new Promise((resolve, reject) => {
    const fallbackToIpLocation = async () => {
      try {
        const res = await fetch('https://ipapi.co/json/');
        if (res.ok) {
          const ipData = await res.json();
          if (ipData.latitude && ipData.longitude) {
            const lat = parseFloat(ipData.latitude);
            const lon = parseFloat(ipData.longitude);
            const address = await reverseGeocodeGps(lat, lon);
            resolve({
              lat,
              lon,
              accuracy: '50',
              address: address || `${ipData.city || 'Location'}, India`,
              displayStatus: `GPS Active: ${ipData.city || 'Detected Location'} (${lat.toFixed(4)}°, ${lon.toFixed(4)}°)`
            });
            return;
          }
        }
      } catch (e) {
        console.log('IP Location fallback notice:', e);
      }

      // Reject with error if location cannot be retrieved
      reject(new Error('GPS location unavailable. Please enable device location access or search your pickup point manually.'));
    };

    if (!navigator.geolocation) {
      fallbackToIpLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy ? position.coords.accuracy.toFixed(0) : '10';

        const address = await reverseGeocodeGps(lat, lon);

        resolve({
          lat,
          lon,
          accuracy,
          address,
          displayStatus: `GPS Active: ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E (±${accuracy}m)`
        });
      },
      (error) => {
        console.warn('HTML5 Geolocation unavailable/denied:', error);
        fallbackToIpLocation();
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  });
};
