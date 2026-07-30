/**
 * RaahGo Location Service
 * All Location & Autocomplete requests are proxied via Django REST Framework Backend (/api/v1/services/location/...)
 */

// 1. Fetch Autocomplete Suggestions via Django Backend Endpoint
export const fetchLocationSuggestions = async (query, userCoords = null) => {
  if (!query || query.trim().length < 1) return [];

  const trimmed = query.trim();

  try {
    let url = `/api/v1/services/services/location/search/?q=${encodeURIComponent(trimmed)}`;

    if (userCoords?.lat && userCoords?.lon) {
      url += `&lat=${userCoords.lat}&lon=${userCoords.lon}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.error('Backend location search fetch error:', err);
  }

  return [];
};

// 2. Reverse Geocode GPS Coordinates via Django Backend Endpoint
export const reverseGeocodeGps = async (lat, lon) => {
  try {
    const url = `/api/v1/services/services/location/reverse/?lat=${lat}&lon=${lon}`;
    const response = await fetch(url);

    if (response.ok) {
      const data = await response.json();
      return data.address || `GPS (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    }
  } catch (err) {
    console.error('Backend reverse geocode fetch error:', err);
  }

  return `Current GPS Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
};

// 3. Get Device GPS Location & Reverse Geocode via Django Backend
export const getDeviceGpsLocation = () => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        const accuracy = position.coords.accuracy.toFixed(0);

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
        reject(error);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  });
};
