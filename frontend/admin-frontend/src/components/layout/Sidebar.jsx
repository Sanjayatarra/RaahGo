import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, Car, Users, UserCheck, Wrench,
  DollarSign, Tag, Headphones, Bell, MapPin, Package,
  Truck, BarChart3, Shield, ClipboardList, Settings,
  ChevronDown, LogOut, Star, Activity, Zap, Navigation
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV = [
  {
    label: null,
    items: [
      { icon: LayoutDashboard, label: 'Dashboard', to: '/' },
    ]
  },
  {
    label: 'Operations',
    items: [
      { icon: Map, label: 'Live Map', to: '/operations/live-map' },
      { icon: Activity, label: 'Live Rides', to: '/operations/live-rides' },
      { icon: Car, label: 'All Rides', to: '/operations/rides' },
      { icon: Navigation, label: 'Scheduled Rides', to: '/operations/scheduled' },
    ]
  },
  {
    label: 'Customers',
    items: [
      { icon: Users, label: 'All Customers', to: '/customers' },
      { icon: Zap, label: 'Wallets', to: '/customers/wallets' },
      { icon: Headphones, label: 'Complaints', to: '/customers/complaints' },
    ]
  },
  {
    label: 'Drivers',
    items: [
      { icon: UserCheck, label: 'All Drivers', to: '/drivers' },
      { icon: ClipboardList, label: 'Pending Approval', to: '/drivers/pending' },
      { icon: Shield, label: 'Documents', to: '/drivers/documents' },
      { icon: Car, label: 'Vehicles', to: '/vehicles' },
      { icon: DollarSign, label: 'Earnings', to: '/drivers/earnings' },
      { icon: Star, label: 'Ratings', to: '/drivers/ratings' },
    ]
  },
  {
    label: 'Services',
    items: [
      { icon: Wrench, label: 'All Services', to: '/services' },
      { icon: Package, label: 'Parcels', to: '/parcels' },
      { icon: Truck, label: 'Movers', to: '/movers' },
    ]
  },
  {
    label: 'Pricing',
    items: [
      { icon: DollarSign, label: 'Fare Management', to: '/pricing/fare' },
      { icon: Zap, label: 'Surge Pricing', to: '/pricing/surge' },
      { icon: Tag, label: 'Cancellation', to: '/pricing/cancellation' },
    ]
  },
  {
    label: 'Payments',
    items: [
      { icon: DollarSign, label: 'Transactions', to: '/payments' },
      { icon: Activity, label: 'Refunds', to: '/payments/refunds' },
      { icon: UserCheck, label: 'Driver Payouts', to: '/payments/payouts' },
      { icon: BarChart3, label: 'Commission', to: '/payments/commission' },
    ]
  },
  {
    label: 'Offers',
    items: [
      { icon: Tag, label: 'Coupons', to: '/offers/coupons' },
      { icon: Users, label: 'Referrals', to: '/offers/referrals' },
    ]
  },
  {
    label: 'Support',
    items: [
      { icon: Headphones, label: 'Tickets', to: '/support/tickets' },
      { icon: ClipboardList, label: 'Complaints', to: '/support/complaints' },
      { icon: Shield, label: 'SOS / Emergency', to: '/support/sos' },
    ]
  },
  {
    label: 'Other',
    items: [
      { icon: Bell, label: 'Notifications', to: '/notifications' },
      { icon: Star, label: 'Ratings', to: '/ratings' },
      { icon: MapPin, label: 'Cities & Zones', to: '/locations' },
      { icon: BarChart3, label: 'Reports', to: '/reports' },
    ]
  },
  {
    label: 'Admin',
    items: [
      { icon: Users, label: 'Admin Users', to: '/admin/users' },
      { icon: Shield, label: 'Roles', to: '/admin/roles' },
      { icon: ClipboardList, label: 'Audit Logs', to: '/audit' },
      { icon: Settings, label: 'Settings', to: '/settings' },
    ]
  },
];

function NavGroup({ group, collapsed }) {
  const [open, setOpen] = useState(true);

  if (!group.label) {
    return (
      <div className="sidebar-section">
        {group.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="sidebar-item-icon"><item.icon size={18} /></span>
            <span className="sidebar-item-text">{item.label}</span>
          </NavLink>
        ))}
      </div>
    );
  }

  return (
    <div className="sidebar-section">
      {!collapsed && (
        <div className="sidebar-group-toggle" onClick={() => setOpen(!open)}>
          <span className="sidebar-section-label">{group.label}</span>
          <ChevronDown size={14} className={`chevron${open ? ' open' : ''}`} />
        </div>
      )}
      {collapsed && <div style={{ height: 8 }} />}
      {(open || collapsed) && group.items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `sidebar-item${isActive ? ' active' : ''}`}
          title={collapsed ? item.label : undefined}
        >
          <span className="sidebar-item-icon"><item.icon size={18} /></span>
          <span className="sidebar-item-text">{item.label}</span>
        </NavLink>
      ))}
    </div>
  );
}

export default function Sidebar({ collapsed }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`sidebar${collapsed ? ' collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">R</div>
        <div className="sidebar-logo-text">
          <h1>RaahGo</h1>
          <span>Admin Panel</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV.map((group, i) => (
          <NavGroup key={i} group={group} collapsed={collapsed} />
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" onClick={handleLogout} title="Logout">
          <div className="user-avatar">{user?.avatar || 'A'}</div>
          <div className="user-info">
            <strong>{user?.name || 'Admin'}</strong>
            <span>{user?.role || 'Super Admin'}</span>
          </div>
          <LogOut size={15} style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--text-muted)' }} />
        </div>
      </div>
    </div>
  );
}
