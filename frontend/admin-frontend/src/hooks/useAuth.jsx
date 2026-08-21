import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const lastActivityRef = useRef(Date.now());

  const logout = useCallback(async (reason = null) => {
    try { await authAPI.logout(); } catch { /* ignore */ }
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_refresh_token');
    localStorage.removeItem('admin_session_timeout');
    localStorage.removeItem('admin_last_activity');
    setUser(null);
    if (reason === 'session_timeout') {
      window.location.href = '/login?reason=session_timeout';
    }
  }, []);

  const login = async (email, password) => {
    const res = await authAPI.login({ email, password });
    const { access, refresh, session_timeout_minutes, user: userData } = res.data;
    localStorage.setItem('admin_token', access);
    if (refresh) localStorage.setItem('admin_refresh_token', refresh);
    if (session_timeout_minutes) {
      localStorage.setItem('admin_session_timeout', String(session_timeout_minutes));
    }
    const now = Date.now();
    localStorage.setItem('admin_last_activity', String(now));
    lastActivityRef.current = now;
    setUser(userData);
    return true;
  };

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (token) {
      authAPI.me()
        .then((res) => {
          setUser(res.data);
          lastActivityRef.current = Date.now();
          localStorage.setItem('admin_last_activity', String(lastActivityRef.current));
        })
        .catch(() => {
          // Token invalid/expired — clear it
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_refresh_token');
          localStorage.removeItem('admin_session_timeout');
          localStorage.removeItem('admin_last_activity');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // Idle / Inactivity Auto-Logout Mechanism based on session_timeout_minutes
  useEffect(() => {
    if (!user) return;

    // Track user interactions to update last active timestamp
    const recordActivity = () => {
      const now = Date.now();
      // Throttle localStorage writes to once every 10 seconds
      if (now - lastActivityRef.current > 10000) {
        lastActivityRef.current = now;
        localStorage.setItem('admin_last_activity', String(now));
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(evt => window.addEventListener(evt, recordActivity, { passive: true }));

    // Periodic check for inactivity timeout
    const checkInterval = setInterval(() => {
      const timeoutMinutes = parseInt(localStorage.getItem('admin_session_timeout') || '60', 10);
      const timeoutMs = Math.max(1, timeoutMinutes) * 60 * 1000;
      const storedLastActivity = parseInt(localStorage.getItem('admin_last_activity') || String(lastActivityRef.current), 10);
      const elapsed = Date.now() - storedLastActivity;

      if (elapsed >= timeoutMs) {
        console.warn(`Admin session timed out after ${Math.round(elapsed / 60000)}m of inactivity.`);
        clearInterval(checkInterval);
        logout('session_timeout');
      }
    }, 10000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, recordActivity));
      clearInterval(checkInterval);
    };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
