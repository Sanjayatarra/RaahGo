import { useState, useEffect, useCallback } from 'react';

/**
 * Generic data-fetching hook.
 * @param {Function} apiFn  - async function that returns an axios response
 * @param {any[]} deps      - dependency array (re-fetch when these change)
 * @returns {{ data, loading, error, refetch }}
 */
export function useApi(apiFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    if (!apiFn) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiFn();
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Spinner shown while loading.
 */
export function LoadingState() {
  return (
    <div className="loading-overlay">
      <div className="spinner" />
    </div>
  );
}

/**
 * Error state with retry button.
 */
export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">⚠️</div>
      <h3>Failed to load data</h3>
      <p style={{ marginBottom: 16 }}>{message || 'An error occurred. Please try again.'}</p>
      {onRetry && (
        <button className="btn btn-primary" onClick={onRetry}>Retry</button>
      )}
    </div>
  );
}
