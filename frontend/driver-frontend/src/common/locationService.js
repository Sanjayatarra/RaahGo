/**
 * RaahGo Driver GPS & Geolocation Service
 * High-accuracy device GPS tracking with manual location selection, search autocomplete, and reverse geocoding.
 */

// 1. Search Autocomplete Suggestions for Cities / Landmarks / Addresses
export const fetchLocationSuggestions = async (query, userCoords = null) => {
  if (!query || query.trim().length < 1) return [];

  const trimmed = query.trim();

  // 1. Try Backend Location Search API
  try {
    let url = `/api/v1/services/location/search/?q=${encodeURIComponent(trimmed)}`;
    if (userCoords?.lat && userCoords?.lng) {
      url += `&lat=${userCoords.lat}&lon=${userCoords.lng}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    // continue to fallback
  }

  // 2. Direct OpenStreetMap Nominatim search fallback
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=8&countrycodes=in`;
    const res = await fetch(nomUrl);
    if (res.ok) {
      const nomData = await res.json();
      return nomData.map((item) => {
        const display = item.display_name || '';
        const parts = display.split(',');
        const title = parts[0]?.trim() || display;
        const subtitle = parts.slice(1, 4).map((p) => p.trim()).join(', ') || 'India';
        const itemLat = parseFloat(item.lat);
        const itemLon = parseFloat(item.lon);

        return {
          title,
          subtitle,
          display_name: display,
          city: parts[parts.length - 2]?.trim() || 'India',
          coordinates: [itemLon, itemLat],
          lat: itemLat,
          lng: itemLon
        };
      });
    }
  } catch (e) {
    console.log('Location search fallback notice:', e);
  }

  return [];
};

// 2. Reverse Geocode GPS Coordinates (lat, lng) -> Real Address / City Name
export const reverseGeocodeGps = async (lat, lng) => {
  if (!lat || !lng) return '';

  // 1. Try Backend API Reverse Geocode
  try {
    const url = `/api/v1/services/location/reverse/?lat=${lat}&lon=${lng}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (data.address && !data.address.includes('Location (') && !data.address.includes('GPS (')) {
        return data.address;
      }
    }
  } catch (err) {
    // continue to fallback
  }

  // 2. Direct BigDataCloud Client Reverse Geocode
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.principalSubdivision || '';
      const city = data.city || data.localityInfo?.administrative?.[2]?.name || '';
      const state = data.principalSubdivision || '';
      const parts = [locality, city, state].filter((v, i, a) => v && a.indexOf(v) === i);
      if (parts.length > 0) return parts.join(', ');
    }
  } catch (e) {
    // continue to fallback
  }

  // 3. Direct OpenStreetMap Nominatim reverse geocode
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=18`
    );
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
    // fallback
  }

  return `Atarra, Banda, Uttar Pradesh`;
};

// 3. Primary Location Resolver: Device GPS -> Saved Storage -> Default Location (Atarra, Banda, UP)
export const getDriverDeviceLocation = () => {
  return new Promise(async (resolve) => {
    // Check localStorage cache first
    let cachedLocation = null;
    try {
      const saved = localStorage.getItem('raahgo_driver_location');
      if (saved) {
        cachedLocation = JSON.parse(saved);
      }
    } catch (e) {}

    const handleFallback = async () => {
      // 1. If user previously had a valid location in cache
      if (cachedLocation && cachedLocation.lat && cachedLocation.lng && cachedLocation.lat !== 25.290689) {
        resolve({
          ...cachedLocation,
          source: 'cache'
        });
        return;
      }

      // 2. IP-based location fallback for mobile on HTTP
      try {
        const res = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client');
        if (res.ok) {
          const data = await res.json();
          if (data.latitude && data.longitude) {
            const locality = data.locality || data.city || data.principalSubdivision || '';
            const city = data.city || '';
            const state = data.principalSubdivision || '';
            const parts = [locality, city, state].filter((v, i, a) => v && a.indexOf(v) === i);
            const address = parts.join(', ') || `${city || 'India'}, ${state || ''}`;
            const ipLoc = {
              lat: Number(data.latitude.toFixed(7)),
              lng: Number(data.longitude.toFixed(7)),
              accuracy: '500',
              address,
              source: 'ip'
            };
            try {
              localStorage.setItem('raahgo_driver_location', JSON.stringify(ipLoc));
            } catch (e) {}
            resolve(ipLoc);
            return;
          }
        }
      } catch (e) {}

      // 3. Default fallback
      const defaultLoc = {
        lat: 28.6139,
        lng: 77.2090,
        address: 'Connaught Place, New Delhi',
        accuracy: '1000',
        source: 'default'
      };
      resolve(defaultLoc);
    };

    if (!navigator.geolocation) {
      handleFallback();
      return;
    }

    // High accuracy first, then fallback to low accuracy
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(7));
        const lng = Number(pos.coords.longitude.toFixed(7));
        const accuracy = pos.coords.accuracy ? pos.coords.accuracy.toFixed(0) : '10';
        const address = await reverseGeocodeGps(lat, lng);
        const result = {
          lat,
          lng,
          accuracy,
          address: address || `GPS Location`,
          source: 'gps'
        };
        try {
          localStorage.setItem('raahgo_driver_location', JSON.stringify(result));
        } catch (e) {}
        resolve(result);
      },
      (err) => {
        console.warn('[DriverLocation] High accuracy failed, trying low accuracy fallback:', err.message);
        navigator.geolocation.getCurrentPosition(
          async (pos2) => {
            const lat = Number(pos2.coords.latitude.toFixed(7));
            const lng = Number(pos2.coords.longitude.toFixed(7));
            const accuracy = pos2.coords.accuracy ? pos2.coords.accuracy.toFixed(0) : '20';
            const address = await reverseGeocodeGps(lat, lng);
            const result = {
              lat,
              lng,
              accuracy,
              address: address || `Network Location`,
              source: 'gps'
            };
            try {
              localStorage.setItem('raahgo_driver_location', JSON.stringify(result));
            } catch (e) {}
            resolve(result);
          },
          () => {
            handleFallback();
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );
  });
};

// 4. Realtime Continuous GPS Watcher
export const startDriverLocationWatch = (onLocationUpdate, onError) => {
  if (!navigator.geolocation) {
    if (onError) onError(new Error('Geolocation is not supported'));
    return null;
  }

  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const lat = Number(pos.coords.latitude.toFixed(7));
      const lng = Number(pos.coords.longitude.toFixed(7));
      const accuracy = pos.coords.accuracy ? pos.coords.accuracy.toFixed(0) : '10';
      const heading = pos.coords.heading || 0;
      const speed = pos.coords.speed || 0;

      const loc = { lat, lng, accuracy, heading, speed, source: 'gps' };
      try {
        localStorage.setItem('raahgo_driver_location', JSON.stringify(loc));
      } catch (e) {}

      if (onLocationUpdate) onLocationUpdate(loc);
    },
    (err) => {
      console.warn('Driver live GPS watch notice:', err);
      if (onError) onError(err);
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000
    }
  );

  return watchId;
};

export const clearDriverLocationWatch = (watchId) => {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
};
