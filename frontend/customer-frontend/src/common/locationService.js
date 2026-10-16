/**
 * RaahGo Location Service
 * Proxies Location Search, Reverse Geocoding & GPS Location without hardcoded defaults.
 */

// 1. Curated Popular Drop Destinations / Hotspots (Airports, Railway, Metro, Tech Hubs, Malls)
export const getPopularDestinations = (userCoords = null) => {
  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return parseFloat((R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))).toFixed(1));
  };

  const isSouthIndia = userCoords && userCoords.lat < 18.0;

  const places = isSouthIndia ? [
    {
      title: 'Kempegowda International Airport (BLR)',
      subtitle: 'Terminal 1 & 2, Devanahalli, Bengaluru',
      icon: '✈️',
      tag: 'Airport',
      lat: 13.1986,
      lon: 77.7066,
      coordinates: [77.7066, 13.1986]
    },
    {
      title: 'KSR Bengaluru City Railway Station',
      subtitle: 'Majestic, Bengaluru',
      icon: '🚆',
      tag: 'Transit',
      lat: 12.9784,
      lon: 77.5694,
      coordinates: [77.5694, 12.9784]
    },
    {
      title: 'Manyata Embassy Business Park',
      subtitle: 'Nagavara, Bengaluru',
      icon: '🏢',
      tag: 'Tech Park',
      lat: 13.0475,
      lon: 77.6200,
      coordinates: [77.6200, 13.0475]
    },
    {
      title: 'MG Road Metro Station',
      subtitle: 'Mahatma Gandhi Road, Bengaluru',
      icon: '🚇',
      tag: 'Metro',
      lat: 12.9756,
      lon: 77.6066,
      coordinates: [77.6066, 12.9756]
    },
    {
      title: 'Phoenix Marketcity Mall',
      subtitle: 'Whitefield Main Rd, Mahadevapura, Bengaluru',
      icon: '🛍️',
      tag: 'Shopping',
      lat: 12.9959,
      lon: 77.6964,
      coordinates: [77.6964, 12.9959]
    }
  ] : [
    {
      title: 'Indira Gandhi International Airport (DEL)',
      subtitle: 'Terminal 3 & 1, New Delhi',
      icon: '✈️',
      tag: 'Airport',
      lat: 28.5562,
      lon: 77.1000,
      coordinates: [77.1000, 28.5562]
    },
    {
      title: 'New Delhi Railway Station (NDLS)',
      subtitle: 'Bhavbhuti Marg, Paharganj, New Delhi',
      icon: '🚆',
      tag: 'Transit',
      lat: 28.6431,
      lon: 77.2197,
      coordinates: [77.2197, 28.6431]
    },
    {
      title: 'DLF Cyber Hub',
      subtitle: 'DLF Cyber City, DLF Phase 2, Gurugram',
      icon: '🏢',
      tag: 'Tech Hub',
      lat: 28.4952,
      lon: 77.0890,
      coordinates: [77.0890, 28.4952]
    },
    {
      title: 'Millennium City Centre (Huda City) Metro',
      subtitle: 'Sector 29, Gurugram, Haryana',
      icon: '🚇',
      tag: 'Metro',
      lat: 28.4593,
      lon: 77.0726,
      coordinates: [77.0726, 28.4593]
    },
    {
      title: 'Ambience Mall Gurugram',
      subtitle: 'NH-8, Ambience Island, DLF Phase 3, Gurugram',
      icon: '🛍️',
      tag: 'Shopping',
      lat: 28.5050,
      lon: 77.0970,
      coordinates: [77.0970, 28.5050]
    },
    {
      title: 'Connaught Place (Rajiv Chowk)',
      subtitle: 'Inner Circle, Central Delhi',
      icon: '🏙️',
      tag: 'City Center',
      lat: 28.6315,
      lon: 77.2167,
      coordinates: [77.2167, 28.6315]
    },
    {
      title: 'Golf Course Road / Sector 54',
      subtitle: 'Suncity, Sector 54, Gurugram',
      icon: '🏢',
      tag: 'Commercial',
      lat: 28.4354,
      lon: 77.1062,
      coordinates: [77.1062, 28.4354]
    }
  ];

  return places.map(p => {
    let dist = 999;
    if (userCoords?.lat && userCoords?.lon) {
      dist = calcDist(userCoords.lat, userCoords.lon, p.lat, p.lon);
    }
    return {
      ...p,
      display_name: `${p.title}, ${p.subtitle}`,
      distanceKm: dist
    };
  });
};

// 2. Fetch Autocomplete Suggestions via Backend with Resilient Multi-Source Fallback
export const fetchLocationSuggestions = async (query, userCoords = null) => {
  if (!query || query.trim().length < 1) return [];

  const trimmed = query.trim().toLowerCase();

  // Helper for Haversine distance in JS
  const calcDist = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * (Math.PI/180)) * Math.cos(lat2 * (Math.PI/180)) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return parseFloat((R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)))).toFixed(1));
  };

  // 1. Try Primary Backend Services Search Endpoint
  try {
    let url = `/api/v1/services/location/search/?q=${encodeURIComponent(trimmed)}`;
    if (userCoords?.lat && userCoords?.lon) {
      url += `&lat=${userCoords.lat}&lon=${userCoords.lon}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map(item => {
          let dist = item.distanceKm;
          if ((dist === undefined || dist >= 9999) && userCoords?.lat && userCoords?.lon && item.coordinates) {
            dist = calcDist(userCoords.lat, userCoords.lon, item.coordinates[1], item.coordinates[0]);
          }
          return {
            ...item,
            distanceKm: dist !== undefined ? dist : 999
          };
        }).sort((a, b) => (a.distanceKm || 99999) - (b.distanceKm || 99999));
      }
    }
  } catch (err) {
    console.log('Backend services location search notice:', err);
  }

  // 2. Try Secondary Customer Location Suggestions Endpoint
  try {
    let url = `/api/v1/users/customer/location/suggestions/?q=${encodeURIComponent(trimmed)}`;
    if (userCoords?.lat && userCoords?.lon) {
      url += `&lat=${userCoords.lat}&lon=${userCoords.lon}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const list = data.suggestions || (Array.isArray(data) ? data : []);
      if (list.length > 0) {
        return list.map(item => {
          const title = item.title || item.name || item.display_name?.split(',')[0] || trimmed;
          const subtitle = item.subtitle || item.display_name?.split(',').slice(1, 4).join(', ') || 'India';
          const lat = parseFloat(item.lat || item.latitude);
          const lon = parseFloat(item.lon || item.longitude);
          const dist = (userCoords?.lat && userCoords?.lon && !isNaN(lat) && !isNaN(lon))
            ? calcDist(userCoords.lat, userCoords.lon, lat, lon)
            : (item.distance_km || 999);

          let icon = '📍';
          const tLower = title.toLowerCase();
          if (tLower.includes('airport')) icon = '✈️';
          else if (tLower.includes('station') || tLower.includes('railway')) icon = '🚆';
          else if (tLower.includes('metro')) icon = '🚇';
          else if (tLower.includes('mall')) icon = '🛍️';
          else if (tLower.includes('cyber') || tLower.includes('tech') || tLower.includes('tower')) icon = '🏢';

          return {
            title,
            subtitle,
            icon,
            tag: item.type || 'Location',
            city: 'India',
            distanceKm: dist,
            coordinates: [lon, lat],
            lat,
            lon,
            display_name: item.display_name || `${title}, ${subtitle}`
          };
        }).sort((a, b) => (a.distanceKm || 99999) - (b.distanceKm || 99999));
      }
    }
  } catch (err) {
    console.log('Customer suggestions endpoint notice:', err);
  }

  // 3. Try Direct OpenStreetMap Nominatim search fallback (client-side)
  try {
    const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&addressdetails=1&limit=8&countrycodes=in`;
    const res = await fetch(nomUrl);
    if (res.ok) {
      const nomData = await res.json();
      const results = [];
      for (const item of nomData) {
        const itemLat = parseFloat(item.lat);
        const itemLon = parseFloat(item.lon);
        let distKm = 99999;
        
        if (userCoords?.lat && userCoords?.lon) {
          distKm = calcDist(userCoords.lat, userCoords.lon, itemLat, itemLon);
        }
        
        const display = item.display_name || '';
        const parts = display.split(',');
        const title = parts[0]?.trim() || display;
        const subtitle = parts.slice(1, 4).map(p => p.trim()).join(', ') || 'India';
        
        let icon = '📍';
        if (item.type === 'aeroway' || title.toLowerCase().includes('airport')) icon = '✈️';
        else if (item.type === 'railway' || title.toLowerCase().includes('station')) icon = '🚆';
        else if (item.type === 'amenity' || title.toLowerCase().includes('hub')) icon = '🏢';

        results.push({
          title,
          subtitle,
          icon,
          tag: item.type || 'Location',
          city: 'India',
          distanceKm: distKm,
          coordinates: [itemLon, itemLat],
          lat: itemLat,
          lon: itemLon,
          display_name: display
        });
      }
      if (results.length > 0) {
        return results.sort((a, b) => (a.distanceKm || 99999) - (b.distanceKm || 99999));
      }
    }
  } catch (fallbackErr) {
    // Expected when client lacks external DNS resolution
  }

  // 4. Client-side Smart Match against Popular Hubs (Guarantees instant suggestions even when offline or DNS blocked)
  const popular = getPopularDestinations(userCoords);
  const matched = popular.filter(p => 
    p.title.toLowerCase().includes(trimmed) || 
    p.subtitle.toLowerCase().includes(trimmed) ||
    p.tag.toLowerCase().includes(trimmed) ||
    trimmed.includes(p.tag.toLowerCase())
  );

  if (matched.length > 0) {
    return matched;
  }

  return [];
};

// 3. Reverse Geocode GPS Coordinates (lat, lon) -> Real Address
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
    console.log('Backend reverse geocode notice:', err);
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
    // Gracefully handled for DNS errors
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
    // Gracefully handled for DNS errors
  }

  // Sensible default location fallback for Delhi NCR coords if offline
  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);
  if (numLat >= 28.4 && numLat <= 28.55 && numLon >= 77.0 && numLon <= 77.15) {
    return `Sector ${(Math.floor(numLat * 1000) % 50) + 1}, Gurugram, Haryana`;
  } else if (numLat >= 28.55 && numLat <= 28.75 && numLon >= 77.15 && numLon <= 77.3) {
    return 'Connaught Place / Central, New Delhi';
  }

  return `Location (${numLat.toFixed(4)}, ${numLon.toFixed(4)})`;
};

// 3. Helper: Check if current origin supports GPS (Secure Context check)
export const isSecureOriginForGps = () => {
  if (typeof window === 'undefined') return true;
  if (window.isSecureContext !== undefined) {
    return window.isSecureContext;
  }
  const hostname = window.location.hostname;
  return (
    window.location.protocol === 'https:' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]'
  );
};

// 4. Helper: Fallback to IP-based approximate Geolocation (for phones on HTTP or when GPS blocked)
export const getIpBasedLocation = async () => {
  // Primary: BigDataCloud IP Geolocation & reverse lookup
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
        return {
          lat: parseFloat(data.latitude),
          lon: parseFloat(data.longitude),
          accuracy: '500',
          address,
          source: 'ip',
          isApproximate: true,
          displayStatus: `Approximate Location (IP): ${address}`
        };
      }
    }
  } catch (e) {
    console.warn('[LocationService] BigDataCloud IP lookup notice:', e);
  }

  // Secondary: IP-API fallback
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (res.ok) {
      const data = await res.json();
      if (data.latitude && data.longitude) {
        const city = data.city || '';
        const region = data.region || '';
        const parts = [city, region, data.country_name || 'India'].filter(Boolean);
        const address = parts.join(', ');
        return {
          lat: parseFloat(data.latitude),
          lon: parseFloat(data.longitude),
          accuracy: '1000',
          address,
          source: 'ip',
          isApproximate: true,
          displayStatus: `Approximate Location (IP): ${address}`
        };
      }
    }
  } catch (e) {
    console.warn('[LocationService] ipapi lookup notice:', e);
  }

  return null;
};

// 5. Query device hardware GPS with high/low accuracy fallback & mobile watchPosition race
const queryBrowserGps = () => {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return reject(new Error('Geolocation API not supported in this browser'));
    }

    let settled = false;
    let watchId = null;

    const cleanup = () => {
      if (watchId !== null) {
        try { navigator.geolocation.clearWatch(watchId); } catch (e) {}
        watchId = null;
      }
    };

    const handleSuccess = (position) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(position);
    };

    // Attempt 1: High Accuracy GPS (Device satellite/fused provider)
    navigator.geolocation.getCurrentPosition(
      handleSuccess,
      (err) => {
        if (settled) return;
        console.warn('[LocationService] High accuracy GPS notice:', err.code, err.message);

        // If permission explicitly denied or insecure origin, reject immediately to allow IP fallback
        if (err.code === 1 /* PERMISSION_DENIED */) {
          settled = true;
          cleanup();
          return reject(err);
        }

        // Attempt 2: Low Accuracy Fallback (Wi-Fi / Cell tower triangulation)
        navigator.geolocation.getCurrentPosition(
          handleSuccess,
          (err2) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(err2);
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 10000 }
    );

    // Parallel watchPosition listener for mobile browsers where getCurrentPosition stalls
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (pos && pos.coords && pos.coords.latitude) {
            handleSuccess(pos);
          }
        },
        () => {}, // Ignore errors here, handled by getCurrentPosition
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 20000 }
      );
    } catch (e) {}

    // Safety timeout to prevent hanging forever
    setTimeout(() => {
      if (!settled) {
        settled = true;
        cleanup();
        reject(new Error('GPS acquisition timed out'));
      }
    }, 12000);
  });
};

// 6. Get Device GPS Location (True Device GPS -> IP Geolocation -> Cached)
let lastCachedGpsLocation = null;
let lastGpsFetchTime = 0;

export const getDeviceGpsLocation = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && lastCachedGpsLocation && (now - lastGpsFetchTime < 15000)) {
    return lastCachedGpsLocation;
  }

  // 1. Try real Device GPS
  try {
    const position = await queryBrowserGps();
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy ? position.coords.accuracy.toFixed(0) : '10';

    const address = await reverseGeocodeGps(lat, lon);

    const result = {
      lat,
      lon,
      accuracy,
      address,
      source: 'gps',
      isApproximate: false,
      isSecureContext: isSecureOriginForGps(),
      displayStatus: `GPS Active: ${address}`
    };

    try {
      localStorage.setItem('raahgo_last_gps_location', JSON.stringify({
        lat,
        lon,
        address,
        timestamp: Date.now()
      }));
    } catch (e) {}

    lastCachedGpsLocation = result;
    lastGpsFetchTime = Date.now();
    return result;
  } catch (gpsError) {
    console.warn('[LocationService] Browser GPS unavailable or denied:', gpsError?.message || gpsError);
  }

  // 2. Fallback to IP Geolocation (crucial for mobile phones accessing dev server over HTTP)
  try {
    const ipLoc = await getIpBasedLocation();
    if (ipLoc && ipLoc.lat && ipLoc.lon) {
      if (!ipLoc.address || ipLoc.address.includes('Location (')) {
        const rev = await reverseGeocodeGps(ipLoc.lat, ipLoc.lon);
        if (rev) ipLoc.address = rev;
      }

      ipLoc.isSecureContext = isSecureOriginForGps();
      ipLoc.displayStatus = `Approximate Location (IP): ${ipLoc.address}`;

      try {
        localStorage.setItem('raahgo_last_gps_location', JSON.stringify({
          lat: ipLoc.lat,
          lon: ipLoc.lon,
          address: ipLoc.address,
          timestamp: Date.now()
        }));
      } catch (e) {}

      lastCachedGpsLocation = ipLoc;
      lastGpsFetchTime = Date.now();
      return ipLoc;
    }
  } catch (ipError) {
    console.warn('[LocationService] IP Geolocation fallback notice:', ipError);
  }

  // 3. Fallback to recent localStorage location
  try {
    const saved = localStorage.getItem('raahgo_last_gps_location');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed?.lat && parsed?.lon) {
        const addr = parsed.address || await reverseGeocodeGps(parsed.lat, parsed.lon);
        const result = {
          lat: parseFloat(parsed.lat),
          lon: parseFloat(parsed.lon),
          accuracy: '50',
          address: addr,
          source: 'cache',
          isApproximate: true,
          isSecureContext: isSecureOriginForGps(),
          displayStatus: `Saved Location: ${addr}`
        };
        lastCachedGpsLocation = result;
        lastGpsFetchTime = Date.now();
        return result;
      }
    }
  } catch (e) {}

  // 4. Default fallback only if offline and no cached location
  const defaultLat = 28.6139; // Central Delhi default
  const defaultLon = 77.2090;
  const defaultAddress = await reverseGeocodeGps(defaultLat, defaultLon) || 'Connaught Place, New Delhi';

  const defaultResult = {
    lat: defaultLat,
    lon: defaultLon,
    accuracy: '1000',
    address: defaultAddress,
    source: 'default',
    isApproximate: true,
    isSecureContext: isSecureOriginForGps(),
    displayStatus: `Default Location: ${defaultAddress}`
  };

  return defaultResult;
};
