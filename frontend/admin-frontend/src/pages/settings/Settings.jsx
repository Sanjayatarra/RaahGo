import { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle2 } from 'lucide-react';
import PageHeader from '../../components/shared/PageHeader';
import AlertModal from '../../components/shared/AlertModal';
import api from '../../api/client';

const SECTIONS = [
  { key: 'general', label: '⚙️ General', fields: [
    { key: 'app_name', label: 'App Name', type: 'text', value: 'RaahGo' },
    { key: 'support_email', label: 'Support Email', type: 'email', value: 'support@raahgo.in' },
    { key: 'support_phone', label: 'Support Phone', type: 'text', value: '+91 1800-XXX-XXXX' },
    { key: 'timezone', label: 'Timezone', type: 'select', value: 'Asia/Kolkata', options: ['Asia/Kolkata','UTC'] },
    { key: 'location_suggestion_radius_km', label: 'Location Suggestion Radius (km)', type: 'number', value: 50, desc: 'Maximum radius in km for autocomplete pickup/drop suggestions and nearby searches (.env LOCATION_SUGGESTION_RADIUS_KM)' },
  ]},
  { key: 'ride', label: '🚗 Ride', fields: [
    { key: 'max_cancellations', label: 'Max Cancellations (per day)', type: 'number', value: 3 },
    { key: 'customer_wait_time', label: 'Customer Wait Time for Captain (minutes)', type: 'number', value: 5, desc: 'Maximum time customer waits for a captain to accept before ride is auto-cancelled' },
    { key: 'driver_wait_time', label: 'Driver Wait Time (minutes)', type: 'number', value: 5, desc: 'Free waiting time for captain at pickup location before waiting charges apply' },
    { key: 'auto_assign', label: 'Auto-assign Driver', type: 'toggle', value: true },
    { key: 'track_interval', label: 'Live Tracking Interval (seconds)', type: 'number', value: 10 },
  ]},
  { key: 'driver', label: '👤 Driver', fields: [
    { key: 'min_rating', label: 'Minimum Rating to Stay Active', type: 'number', value: 3.5 },
    { key: 'payout_schedule', label: 'Payout Schedule', type: 'select', value: 'weekly', options: ['daily','weekly','monthly'] },
    { key: 'max_complaints', label: 'Max Complaints Before Suspension', type: 'number', value: 5 },
    { key: 'doc_expiry_alert', label: 'Document Expiry Alert (days)', type: 'number', value: 30 },
  ]},
  { key: 'payment', label: '💳 Payment', fields: [
    { key: 'gateway', label: 'Primary Gateway', type: 'select', value: 'razorpay', options: ['razorpay','paytm','stripe'] },
    { key: 'wallet_max', label: 'Max Wallet Balance (₹)', type: 'number', value: 10000 },
    { key: 'cashback_enabled', label: 'Enable Cashback', type: 'toggle', value: true },
    { key: 'auto_refund', label: 'Auto Refund on Cancel', type: 'toggle', value: false },
  ]},
  { key: 'notification', label: '🔔 Notifications', fields: [
    { key: 'push_enabled', label: 'Push Notifications', type: 'toggle', value: true },
    { key: 'sms_enabled', label: 'SMS Notifications', type: 'toggle', value: true },
    { key: 'email_enabled', label: 'Email Notifications', type: 'toggle', value: false },
    { key: 'fcm_key', label: 'FCM Server Key', type: 'text', value: 'AAAA...' },
  ]},
  { key: 'maps', label: '🗺️ Maps', fields: [
    { key: 'maps_provider', label: 'Maps Provider', type: 'select', value: 'openstreetmap', options: ['openstreetmap', 'google'] },
    { key: 'maps_api_key', label: 'Google Maps API Key', type: 'text', value: '' },
    { key: 'location_suggestion_radius_km', label: 'Location Suggestion Radius (km)', type: 'number', value: 50, desc: 'Maximum distance from user coordinates to suggest locations' },
    { key: 'geocoding_enabled', label: 'Geocoding Enabled', type: 'toggle', value: true },
  ]},
  { key: 'security', label: '🔒 Security', fields: [
    { key: '2fa_required', label: 'Require 2FA for Admins', type: 'toggle', value: true },
    { key: 'session_timeout', label: 'Session Timeout (minutes)', type: 'number', value: 60 },
    { key: 'ip_whitelist', label: 'Admin IP Whitelist', type: 'textarea', value: '' },
  ]},
];

export default function Settings() {
  const [activeSection, setActiveSection] = useState('general');
  const [settings, setSettings] = useState(() => {
    const s = {};
    SECTIONS.forEach(sec => {
      sec.fields.forEach(f => { s[f.key] = f.value; });
    });
    return s;
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });

  // Fetch persisted settings from backend
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/admin/settings/');
        if (res.data && typeof res.data === 'object') {
          setSettings(prev => ({
            ...prev,
            ...res.data,
            location_suggestion_radius_km: res.data.location_suggestion_radius_km !== undefined ? res.data.location_suggestion_radius_km : prev.location_suggestion_radius_km
          }));
        }
      } catch (err) {
        console.log('Settings fetch notice:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const section = SECTIONS.find(s => s.key === activeSection);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.post('/api/admin/settings/', settings);
      setSaved(true);
      if (res.data?.settings) {
        setSettings(prev => ({ ...prev, ...res.data.settings }));
      }
      setAlertModal({
        isOpen: true,
        title: 'Settings Saved',
        message: `Global system settings updated successfully. Location suggestion radius is set to ${settings.location_suggestion_radius_km || 50} km.`,
        type: 'success'
      });
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.log('Save settings error:', err);
      setAlertModal({
        isOpen: true,
        title: 'Save Failed',
        message: 'Could not save settings. Please check server connection.',
        type: 'error'
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="System Settings" subtitle="Configure global application settings" breadcrumb={['Settings']} />

      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 24 }}>
        {/* Sidebar */}
        <div className="card" style={{ padding: '10px 8px', alignSelf: 'start' }}>
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 12px', borderRadius: 8, border: 'none',
                background: activeSection === s.key ? 'rgba(108,99,255,0.15)' : 'none',
                color: activeSection === s.key ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontSize: 13, fontWeight: activeSection === s.key ? 600 : 400,
                cursor: 'pointer', transition: 'all 0.15s',
                marginBottom: 2,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700 }}>{section?.label} Settings</h3>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                Update configurations and environment values
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>

          <div style={{ display: 'grid', gap: 20 }}>
            {section?.fields.map(field => (
              <div key={field.key} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label" style={{ marginBottom: 2, fontWeight: 600 }}>{field.label}</label>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {field.desc || `settings.${field.key}`}
                  </p>
                </div>
                <div style={{ flex: 1, maxWidth: 320 }}>
                  {field.type === 'toggle' ? (
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <div
                        onClick={() => setSettings(s => ({ ...s, [field.key]: !s[field.key] }))}
                        style={{
                          width: 44, height: 24, borderRadius: 12,
                          background: settings[field.key] ? 'var(--accent-primary)' : 'var(--bg-input)',
                          border: '1px solid var(--border-light)',
                          position: 'relative', cursor: 'pointer', transition: 'all 0.2s',
                        }}
                      >
                        <div style={{
                          position: 'absolute', top: 2,
                          left: settings[field.key] ? 22 : 2,
                          width: 18, height: 18, borderRadius: '50%',
                          background: 'white', transition: 'left 0.2s',
                        }} />
                      </div>
                      <span style={{ fontSize: 13, color: settings[field.key] ? 'var(--status-active)' : 'var(--text-muted)' }}>
                        {settings[field.key] ? 'Enabled' : 'Disabled'}
                      </span>
                    </label>
                  ) : field.type === 'select' ? (
                    <select
                      className="form-control"
                      value={settings[field.key] || ''}
                      onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.value }))}
                    >
                      {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      className="form-control"
                      rows={3}
                      value={settings[field.key] || ''}
                      onChange={e => setSettings(s => ({ ...s, [field.key]: e.target.value }))}
                      placeholder="One IP per line..."
                    />
                  ) : (
                    <input
                      className="form-control"
                      type={field.type}
                      value={settings[field.key] !== undefined ? settings[field.key] : ''}
                      onChange={e => setSettings(s => ({
                        ...s,
                        [field.key]: field.type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value
                      }))}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={alertModal.isOpen}
        title={alertModal.title}
        message={alertModal.message}
        type={alertModal.type}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
