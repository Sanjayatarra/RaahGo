/**
 * Driver API Client with automatic JWT Token Refresh
 * 1. Driver enters phone number / email -> receives OTP -> verifies OTP.
 * 2. Backend returns real JWT access and refresh tokens.
 * 3. Frontend stores driver_access_token and driver_refresh_token in localStorage.
 * 4. Every authenticated API request includes header: Authorization: Bearer <access_token>.
 * 5. When access token expires (401 response), refresh token is sent to /api/v1/driver/token/refresh/ to obtain a new access token.
 * 6. If the refresh token is invalid or expired, log out the driver and require OTP login again.
 */

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

const handleDriverSessionExpired = () => {
  localStorage.removeItem('driver_access_token');
  localStorage.removeItem('driver_refresh_token');
  localStorage.removeItem('raahgo_driver_user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

export const fetchWithAuth = async (url, options = {}) => {
  const headers = { ...(options.headers || {}) };

  // Attach stored driver access token if available
  let accessToken = localStorage.getItem('driver_access_token');
  if (!accessToken) {
    const savedUserStr = localStorage.getItem('raahgo_driver_user');
    if (savedUserStr) {
      try {
        const u = JSON.parse(savedUserStr);
        accessToken = u.jwtAccess || u.access_token || u.access;
      } catch (e) {}
    }
  }

  if (accessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const finalOptions = {
    ...options,
    headers
  };

  try {
    let response = await fetch(url, finalOptions);

    // If request failed with 401 Unauthorized (Expired Access Token)
    if (response.status === 401) {
      let refreshToken = localStorage.getItem('driver_refresh_token');
      if (!refreshToken) {
        const savedUserStr = localStorage.getItem('raahgo_driver_user');
        if (savedUserStr) {
          try {
            const u = JSON.parse(savedUserStr);
            refreshToken = u.jwtRefresh || u.refresh_token || u.refresh;
          } catch (e) {}
        }
      }

      // If refresh token exists, attempt automatic token refresh
      if (refreshToken) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            finalOptions.headers['Authorization'] = `Bearer ${token}`;
            return fetch(url, finalOptions);
          });
        }

        isRefreshing = true;

        try {
          const refreshRes = await fetch('/api/v1/driver/token/refresh/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh: refreshToken })
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newAccessToken = refreshData.access;

            if (newAccessToken) {
              localStorage.setItem('driver_access_token', newAccessToken);

              // Update stored user object if present
              const savedUserStr = localStorage.getItem('raahgo_driver_user');
              if (savedUserStr) {
                try {
                  const u = JSON.parse(savedUserStr);
                  u.jwtAccess = newAccessToken;
                  u.access_token = newAccessToken;
                  localStorage.setItem('raahgo_driver_user', JSON.stringify(u));
                } catch (e) {}
              }

              processQueue(null, newAccessToken);

              // Retry original request with new access token
              finalOptions.headers['Authorization'] = `Bearer ${newAccessToken}`;
              return await fetch(url, finalOptions);
            }
          }

          // Refresh token invalid or expired -> Logout driver and require OTP login again
          processQueue(new Error('Driver refresh token invalid or expired'));
          handleDriverSessionExpired();
        } catch (refreshErr) {
          processQueue(refreshErr);
          handleDriverSessionExpired();
        } finally {
          isRefreshing = false;
        }
      } else {
        // No refresh token -> Logout driver and require OTP login again
        handleDriverSessionExpired();
      }
    }

    return response;
  } catch (netErr) {
    throw netErr;
  }
};
