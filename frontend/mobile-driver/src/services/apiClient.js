import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

export const clearDriverSession = async () => {
  try {
    await AsyncStorage.multiRemove([
      'driver_access_token',
      'driver_refresh_token',
      'raahgo_driver_user',
    ]);
  } catch (e) {
    console.error('Error clearing driver session:', e);
  }
};

export const getStoredDriverToken = async () => {
  try {
    let token = await AsyncStorage.getItem('driver_access_token');
    if (!token) {
      const savedUserStr = await AsyncStorage.getItem('raahgo_driver_user');
      if (savedUserStr) {
        const u = JSON.parse(savedUserStr);
        token = u.jwtAccess || u.access_token || u.access;
      }
    }
    return token;
  } catch (e) {
    return null;
  }
};

export const fetchWithAuth = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const accessToken = await getStoredDriverToken();
  if (accessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const finalOptions = {
    ...options,
    headers,
  };

  try {
    let response = await fetch(url, finalOptions);

    if (response.status === 401) {
      const refreshToken = await AsyncStorage.getItem('driver_refresh_token');
      if (!refreshToken) {
        await clearDriverSession();
        return response;
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((newToken) => {
            finalOptions.headers['Authorization'] = `Bearer ${newToken}`;
            return fetch(url, finalOptions);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        const refreshRes = await fetch(`${API_BASE_URL}/api/v1/driver/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccess = refreshData.access || refreshData.jwtAccess;

          if (newAccess) {
            await AsyncStorage.setItem('driver_access_token', newAccess);
            if (refreshData.refresh) {
              await AsyncStorage.setItem('driver_refresh_token', refreshData.refresh);
            }
            processQueue(null, newAccess);

            finalOptions.headers['Authorization'] = `Bearer ${newAccess}`;
            return await fetch(url, finalOptions);
          }
        }

        processQueue(new Error('Refresh failed'), null);
        await clearDriverSession();
        return response;
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await clearDriverSession();
        return response;
      } finally {
        isRefreshing = false;
      }
    }

    return response;
  } catch (networkError) {
    console.error('Driver API Network Error:', networkError);
    throw networkError;
  }
};
