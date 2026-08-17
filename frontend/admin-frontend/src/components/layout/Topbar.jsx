import { Menu, Search, Bell, Settings, Sun } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export default function Topbar({ collapsed, onToggle }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className={`topbar${collapsed ? ' collapsed' : ''}`}>
      <button className="topbar-toggle" onClick={onToggle} aria-label="Toggle sidebar">
        <Menu size={20} />
      </button>

      <div className="topbar-search">
        <Search size={15} className="topbar-search-icon" />
        <input type="text" placeholder="Search customers, drivers, rides..." />
      </div>

      <div className="topbar-actions">
        <button className="topbar-btn" title="Notifications" onClick={() => navigate('/notifications')}>
          <Bell size={16} />
          <span className="topbar-badge" />
        </button>
        <button className="topbar-btn" title="Settings" onClick={() => navigate('/settings')}>
          <Settings size={16} />
        </button>

        <div className="topbar-divider" />

        <div className="topbar-profile" onClick={() => navigate('/admin/users')}>
          <div className="user-avatar avatar-sm">{user?.avatar || 'A'}</div>
          <div className="topbar-profile-info">
            <strong>{user?.name || 'Admin'}</strong>
            <span>{user?.role || 'Super Admin'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
