import { useState, useRef, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Map, Car, Users, UserCheck, Wrench,
  DollarSign, Tag, Headphones, Bell, MapPin, Package,
  Truck, BarChart3, Shield, ClipboardList, Settings,
  ChevronDown, LogOut, Star, Activity, Zap, Navigation,
  Layers, Search, Menu, X, CreditCard, Sparkles, User
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const NAV_GROUPS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    to: '/',
    icon: LayoutDashboard,
    isDirect: true,
  },
  {
    key: 'operations',
    label: 'Operations',
    icon: Activity,
    color: '#4ECDC4',
    items: [
      { icon: Map, label: 'Live Map', to: '/operations/live-map', desc: 'Real-time GPS tracking of active captains' },
      { icon: Activity, label: 'Live Rides', to: '/operations/live-rides', desc: 'Active in-trip bookings & requests' },
      { icon: Car, label: 'All Rides', to: '/operations/rides', desc: 'Master ride registry & booking records' },
      { icon: Navigation, label: 'Scheduled Rides', to: '/operations/scheduled', desc: 'Pre-booked & advance scheduled trips' },
    ]
  },
  {
    key: 'customers',
    label: 'Customers',
    icon: Users,
    color: '#6C63FF',
    items: [
      { icon: Users, label: 'All Customers', to: '/customers', desc: 'Registered passenger user directory' },
      { icon: Zap, label: 'Wallets', to: '/customers/wallets', desc: 'Customer credits, balances & refunds' },
      { icon: Headphones, label: 'Complaints', to: '/customers/complaints', desc: 'Customer feedback & disputes' },
    ]
  },
  {
    key: 'drivers',
    label: 'Captains',
    icon: UserCheck,
    color: '#FF6B35',
    items: [
      { icon: UserCheck, label: 'All Captains', to: '/drivers', desc: 'Captain directory & compliance records' },
      { icon: ClipboardList, label: 'Pending Approval', to: '/drivers/pending', desc: 'Captain applications awaiting KYC' },
      { icon: Shield, label: 'Documents', to: '/drivers/documents', desc: 'Licenses, RC, Insurance & audits' },
      { icon: Car, label: 'Vehicles', to: '/vehicles', desc: 'Registered vehicles & approvals' },
      { icon: DollarSign, label: 'Earnings', to: '/drivers/earnings', desc: 'Captain pay, incentives & commissions' },
      { icon: Star, label: 'Ratings', to: '/drivers/ratings', desc: 'Captain scores & performance reviews' },
    ]
  },
  {
    key: 'services',
    label: 'Services',
    icon: Wrench,
    color: '#3B82F6',
    items: [
      { icon: Wrench, label: 'All Services', to: '/services', desc: 'Rides, Rentals & specialized services' },
      { icon: Package, label: 'Parcels', to: '/parcels', desc: 'Intracity courier & parcel deliveries' },
      { icon: Truck, label: 'Movers', to: '/movers', desc: 'Logistics trucks & goods carriers' },
    ]
  },
  {
    key: 'pricing',
    label: 'Pricing',
    icon: DollarSign,
    color: '#10B981',
    items: [
      { icon: DollarSign, label: 'Fare Management', to: '/pricing/fare', desc: 'Base fares, per-km rates & wait time' },
      { icon: Zap, label: 'Surge Pricing', to: '/pricing/surge', desc: 'Dynamic surge multipliers & zones' },
      { icon: Tag, label: 'Cancellation', to: '/pricing/cancellation', desc: 'Cancellation policies & penalty rules' },
    ]
  },
  {
    key: 'payments',
    label: 'Payments',
    icon: CreditCard,
    color: '#6366F1',
    items: [
      { icon: DollarSign, label: 'Transactions', to: '/payments', desc: 'Gateway charges & settlement log' },
      { icon: Activity, label: 'Refunds', to: '/payments/refunds', desc: 'Processed & pending refund requests' },
      { icon: UserCheck, label: 'Captain Payouts', to: '/payments/payouts', desc: 'Bank payouts & wallet cashouts' },
      { icon: BarChart3, label: 'Commission', to: '/payments/commission', desc: 'Platform commission breakdowns' },
    ]
  },
  {
    key: 'offers',
    label: 'Offers',
    icon: Tag,
    color: '#EC4899',
    items: [
      { icon: Tag, label: 'Coupons', to: '/offers/coupons', desc: 'Promo codes & passenger discounts' },
      { icon: Users, label: 'Referrals', to: '/offers/referrals', desc: 'Referral reward program management' },
    ]
  },
  {
    key: 'support',
    label: 'Support',
    icon: Headphones,
    color: '#EF4444',
    items: [
      { icon: Headphones, label: 'Tickets', to: '/support/tickets', desc: 'Help desk & user support queries' },
      { icon: ClipboardList, label: 'Complaints', to: '/support/complaints', desc: 'Incident investigations & reports' },
      { icon: Shield, label: 'SOS / Emergency', to: '/support/sos', desc: 'Live ride emergency alerts' },
    ]
  },
  {
    key: 'other',
    label: 'Other',
    icon: Layers,
    color: '#F59E0B',
    items: [
      { icon: Bell, label: 'Notifications', to: '/notifications', desc: 'Push notifications & announcements' },
      { icon: Star, label: 'Ratings', to: '/ratings', desc: 'Platform reviews & feedback feed' },
      { icon: MapPin, label: 'Cities & Zones', to: '/locations', desc: 'Service operational hubs & zones' },
      { icon: BarChart3, label: 'Reports', to: '/reports', desc: 'Analytics exports & business metrics' },
    ]
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: Settings,
    color: '#94A3B8',
    items: [
      { icon: Users, label: 'Admin Users', to: '/admin/users', desc: 'Operations team & staff accounts' },
      { icon: Shield, label: 'Roles', to: '/admin/roles', desc: 'RBAC permissions & access control' },
      { icon: ClipboardList, label: 'Audit Logs', to: '/audit', desc: 'Admin security & event activity log' },
      { icon: Settings, label: 'Settings', to: '/settings', desc: 'Global platform configs & toggles' },
    ]
  },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [activeDropdown, setActiveDropdown] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileAccordion, setMobileAccordion] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const navRef = useRef(null);
  const profileRef = useRef(null);

  // Close dropdowns on outside click or escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) {
        setActiveDropdown(null);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveDropdown(null);
        setProfileOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close dropdowns on route change
  useEffect(() => {
    setActiveDropdown(null);
    setProfileOpen(false);
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const query = searchQuery.trim().toLowerCase();
    if (query.includes('driver') || query.includes('captain')) {
      navigate('/drivers');
    } else if (query.includes('customer') || query.includes('user')) {
      navigate('/customers');
    } else if (query.includes('ride') || query.includes('trip') || query.includes('booking')) {
      navigate('/operations/rides');
    } else if (query.includes('coupon') || query.includes('offer')) {
      navigate('/offers/coupons');
    } else if (query.includes('setting')) {
      navigate('/settings');
    } else if (query.includes('map')) {
      navigate('/operations/live-map');
    } else {
      navigate(`/operations/rides?search=${encodeURIComponent(query)}`);
    }
    setSearchQuery('');
  };

  return (
    <header className="top-navbar" ref={navRef}>
      <div className="top-navbar-container">
        
        {/* ── 1. Brand Logo ── */}
        <div className="top-navbar-brand">
          <NavLink to="/" className="top-navbar-logo">
            <div className="top-navbar-logo-icon">R</div>
            <div className="top-navbar-logo-text">
              <span className="logo-title">RaahGo</span>
            </div>
          </NavLink>
        </div>

        {/* ── 2. Desktop Navigation with Dropdowns ── */}
        <nav className="top-navbar-nav">
          {NAV_GROUPS.map((group) => {
            if (group.isDirect) {
              const isActive = location.pathname === group.to;
              return (
                <NavLink
                  key={group.key}
                  to={group.to}
                  className={`top-nav-link${isActive ? ' active' : ''}`}
                >
                  <group.icon size={15} />
                  <span>{group.label}</span>
                </NavLink>
              );
            }

            // Check if any child route in this group is currently active
            const isGroupActive = group.items?.some((item) => {
              if (item.to === '/') return location.pathname === '/';
              return location.pathname.startsWith(item.to);
            });
            const isOpen = activeDropdown === group.key;
            const isRightAligned = ['pricing', 'payments', 'offers', 'support', 'other', 'admin'].includes(group.key);

            return (
              <div
                key={group.key}
                className={`top-nav-dropdown-wrapper${isOpen ? ' open' : ''}`}
                onMouseEnter={() => setActiveDropdown(group.key)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <button
                  type="button"
                  className={`top-nav-dropdown-trigger${isGroupActive ? ' active' : ''}${isOpen ? ' dropdown-open' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveDropdown(isOpen ? null : group.key);
                  }}
                  aria-expanded={isOpen}
                >
                  <group.icon size={15} color={isGroupActive ? 'var(--accent-primary)' : 'currentColor'} />
                  <span>{group.label}</span>
                  <ChevronDown size={13} className={`chevron-indicator${isOpen ? ' open' : ''}`} />
                </button>

                {/* Dropdown Menu Panel */}
                {isOpen && (
                  <div className={`top-nav-dropdown-menu${isRightAligned ? ' align-right' : ''}`}>
                    <div className="dropdown-menu-header">
                      <span className="dropdown-menu-title" style={{ color: group.color || 'var(--accent-primary)' }}>
                        {group.label}
                      </span>
                      <span className="dropdown-menu-count">{group.items.length} items</span>
                    </div>

                    <div className="dropdown-menu-grid">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isItemActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={`dropdown-menu-item${isItemActive ? ' active' : ''}`}
                            onClick={() => setActiveDropdown(null)}
                          >
                            <div className="dropdown-item-icon" style={{ color: isItemActive ? '#ffffff' : (group.color || 'var(--accent-primary)') }}>
                              <Icon size={16} />
                            </div>
                            <div className="dropdown-item-content">
                              <span className="dropdown-item-label">{item.label}</span>
                              {item.desc && <span className="dropdown-item-desc">{item.desc}</span>}
                            </div>
                          </NavLink>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* ── 3. Right Header Actions & Profile ── */}
        <div className="top-navbar-actions">
          
          {/* Quick Search */}
          <form className="navbar-search-form" onSubmit={handleSearchSubmit}>
            <Search size={14} className="navbar-search-icon" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="navbar-search-input"
            />
          </form>

          {/* Notifications Button */}
          <button
            className="navbar-icon-btn"
            title="Notifications"
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="navbar-btn-badge" />
          </button>

          {/* Settings Shortcut */}
          <button
            className="navbar-icon-btn"
            title="Global Settings"
            onClick={() => navigate('/settings')}
            aria-label="Settings"
          >
            <Settings size={16} />
          </button>

          <div className="navbar-divider" />

          {/* User Profile Pill & Dropdown */}
          <div className="navbar-profile-wrapper" ref={profileRef}>
            <button
              className={`navbar-profile-btn${profileOpen ? ' open' : ''}`}
              onClick={() => setProfileOpen(!profileOpen)}
              aria-label="User profile menu"
            >
              <div className="user-avatar avatar-sm">{user?.avatar || 'A'}</div>
              <div className="navbar-profile-info">
                <strong>{user?.name || 'Admin'}</strong>
                <span>{user?.role || 'Super Admin'}</span>
              </div>
              <ChevronDown size={13} className={`profile-chevron${profileOpen ? ' open' : ''}`} />
            </button>

            {/* Profile Menu Dropdown */}
            {profileOpen && (
              <div className="navbar-profile-dropdown">
                <div className="profile-dropdown-header">
                  <div className="user-avatar avatar-md">{user?.avatar || 'A'}</div>
                  <div className="profile-header-text">
                    <strong>{user?.name || 'Admin User'}</strong>
                    <span>{user?.email || 'admin@raahgo.in'}</span>
                    <span className="role-tag">{user?.role || 'Super Admin'}</span>
                  </div>
                </div>

                <div className="profile-dropdown-divider" />

                <div className="profile-dropdown-links">
                  <button onClick={() => { setProfileOpen(false); navigate('/admin/users'); }} className="profile-dropdown-link">
                    <User size={15} /> Admin Team & Users
                  </button>
                  <button onClick={() => { setProfileOpen(false); navigate('/admin/roles'); }} className="profile-dropdown-link">
                    <Shield size={15} /> Role Permissions
                  </button>
                  <button onClick={() => { setProfileOpen(false); navigate('/audit'); }} className="profile-dropdown-link">
                    <ClipboardList size={15} /> Audit Activity Logs
                  </button>
                  <button onClick={() => { setProfileOpen(false); navigate('/settings'); }} className="profile-dropdown-link">
                    <Settings size={15} /> System Settings
                  </button>
                </div>

                <div className="profile-dropdown-divider" />

                <button onClick={handleLogout} className="profile-logout-btn">
                  <LogOut size={15} /> Log Out
                </button>
              </div>
            )}
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            className="navbar-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

      </div>

      {/* ── 4. Mobile Navigation Drawer / Accordion ── */}
      {mobileMenuOpen && (
        <div className="navbar-mobile-drawer">
          <div className="mobile-drawer-search">
            <form onSubmit={handleSearchSubmit}>
              <Search size={14} className="navbar-search-icon" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </form>
          </div>

          <div className="mobile-drawer-nav">
            {NAV_GROUPS.map((group) => {
              if (group.isDirect) {
                return (
                  <NavLink
                    key={group.key}
                    to={group.to}
                    className={({ isActive }) => `mobile-drawer-item${isActive ? ' active' : ''}`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <group.icon size={16} />
                    <span>{group.label}</span>
                  </NavLink>
                );
              }

              const isAccordionOpen = mobileAccordion === group.key;
              const isGroupActive = group.items?.some((i) => location.pathname.startsWith(i.to));

              return (
                <div key={group.key} className="mobile-drawer-group">
                  <button
                    type="button"
                    className={`mobile-group-header${isGroupActive ? ' active' : ''}`}
                    onClick={() => setMobileAccordion(isAccordionOpen ? null : group.key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <group.icon size={16} color={group.color || 'currentColor'} />
                      <span>{group.label}</span>
                    </div>
                    <ChevronDown size={14} className={`chevron-indicator${isAccordionOpen ? ' open' : ''}`} />
                  </button>

                  {isAccordionOpen && (
                    <div className="mobile-group-children">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const isItemActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            className={`mobile-child-item${isItemActive ? ' active' : ''}`}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <Icon size={14} />
                            <span>{item.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mobile-drawer-footer">
            <button onClick={handleLogout} className="mobile-logout-btn">
              <LogOut size={16} /> Sign Out of Admin Panel
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
