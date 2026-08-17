import React, { useState, useEffect } from 'react';
import {
  Bell, Award, AlertTriangle, CreditCard, Sparkles, Check, CheckCheck,
  Trash2, ArrowRight, ShieldCheck, MapPin, Clock, RefreshCw
} from 'lucide-react';
import { fetchWithAuth } from '../common/apiClient';

export default function DriverAlertsTab({ unreadCount = 0, onMarkAllRead }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/v1/driver/notifications/');
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.results || []);
        setAlerts(list);
      }
    } catch (err) {
      console.log('Error fetching driver notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkRead = async (id) => {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, unread: false, is_read: true } : a))
    );
    try {
      await fetchWithAuth(`/api/v1/driver/notifications/${id}/read/`, { method: 'POST' });
    } catch (err) {
      console.log('Notice marking alert read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    setAlerts((prev) => prev.map((a) => ({ ...a, unread: false, is_read: true })));
    if (onMarkAllRead) onMarkAllRead();
    try {
      await fetchWithAuth('/api/v1/driver/notifications/read-all/', { method: 'POST' });
    } catch (err) {
      console.log('Notice marking all read:', err);
    }
  };

  const handleDeleteAlert = async (id) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    try {
      await fetchWithAuth(`/api/v1/driver/notifications/${id}/`, { method: 'DELETE' });
    } catch (err) {
      console.log('Notice deleting alert:', err);
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'incentive':
      case 'surge':
        return Award;
      case 'payout':
        return CreditCard;
      case 'document':
        return AlertTriangle;
      default:
        return Bell;
    }
  };

  const getAlertColor = (type) => {
    switch (type) {
      case 'incentive':
      case 'surge':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'payout':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'document':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-blue-50 text-blue-700 border-blue-200';
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'unread') return a.unread || !a.is_read;
    if (filter === 'incentives') return a.type === 'incentive' || a.type === 'surge';
    if (filter === 'payouts') return a.type === 'payout';
    if (filter === 'docs') return a.type === 'document';
    return true;
  });

  const unreadAlertsCount = alerts.filter(a => a.unread || !a.is_read).length;

  return (
    <div className="w-full max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Alerts & Inbox
          </h2>
          <p className="text-xs text-gray-500">
            Real notifications, incentive goals, payouts & KYC updates from database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="p-2 rounded-xl bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors shadow-xs"
            title="Refresh Alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {unreadAlertsCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-bold text-gray-700 hover:text-black flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 border border-gray-200"
            >
              <CheckCheck className="w-3.5 h-3.5" /> Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs font-bold">
        {[
          { id: 'all', label: 'All' },
          { id: 'unread', label: 'Unread', badge: unreadAlertsCount },
          { id: 'incentives', label: 'Incentives & Surge' },
          { id: 'payouts', label: 'Payouts' },
          { id: 'docs', label: 'KYC & Expiry' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`py-1.5 px-3 rounded-xl whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              filter === f.id
                ? 'bg-black text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <span>{f.label}</span>
            {f.badge > 0 && (
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center">
                {f.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => {
            const isUnread = alert.unread || !alert.is_read;
            const Icon = getAlertIcon(alert.type);
            const colorClass = getAlertColor(alert.type);

            return (
              <div
                key={alert.id}
                className={`bg-white rounded-2xl border p-4 sm:p-5 space-y-2.5 transition-all shadow-xs relative ${
                  isUnread ? 'border-amber-400/80 bg-amber-50/20 shadow-sm' : 'border-gray-200'
                }`}
              >
                {isUnread && (
                  <span className="absolute top-4 right-4 w-2.5 h-2.5 rounded-full bg-amber-500 ring-4 ring-amber-100" />
                )}

                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 pr-4">
                    <h3 className="font-extrabold text-sm sm:text-base text-gray-900 leading-tight">
                      {alert.title}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-700 mt-1 leading-relaxed">
                      {alert.message || alert.body}
                    </p>
                    <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {alert.time || (alert.created_at ? new Date(alert.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'Live')}
                      </span>
                      {isUnread && (
                        <button
                          onClick={() => handleMarkRead(alert.id)}
                          className="text-xs font-bold text-amber-700 hover:underline"
                        >
                          Mark as read
                        </button>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteAlert(alert.id)}
                    className="text-gray-300 hover:text-red-500 p-1 transition-colors"
                    title="Dismiss alert"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 text-xs text-gray-500">
            {loading ? 'Loading notifications from database…' : 'No alerts found in database for this category.'}
          </div>
        )}
      </div>
    </div>
  );
}
