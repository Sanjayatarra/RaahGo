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

export const clearCustomerSession = async () => {
  try {
    await AsyncStorage.multiRemove([
      'customer_access_token',
      'customer_refresh_token',
      'raahgo_customer_user',
    ]);
  } catch (e) {
    console.error('Error clearing customer session:', e);
  }
};

export const getStoredCustomerToken = async () => {
  try {
    let token = await AsyncStorage.getItem('customer_access_token');
    if (!token) {
      const savedUserStr = await AsyncStorage.getItem('raahgo_customer_user');
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

export const fetchCustomerWithAuth = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const accessToken = await getStoredCustomerToken();
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
      const refreshToken = await AsyncStorage.getItem('customer_refresh_token');
      if (!refreshToken) {
        await clearCustomerSession();
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
        const refreshRes = await fetch(`${API_BASE_URL}/api/v1/customer/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh: refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccess = refreshData.access || refreshData.jwtAccess;

          if (newAccess) {
            await AsyncStorage.setItem('customer_access_token', newAccess);
            if (refreshData.refresh) {
              await AsyncStorage.setItem('customer_refresh_token', refreshData.refresh);
            }
            processQueue(null, newAccess);

            finalOptions.headers['Authorization'] = `Bearer ${newAccess}`;
            return await fetch(url, finalOptions);
          }
        }

        processQueue(new Error('Refresh failed'), null);
        await clearCustomerSession();
        return response;
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        await clearCustomerSession();
        return response;
      } finally {
        isRefreshing = false;
      }
    }

    return response;
  } catch (networkError) {
    console.error('Customer API Network Error:', networkError);
    throw networkError;
  }
};
