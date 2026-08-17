import { useState } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="admin-layout">
      <Sidebar collapsed={collapsed} />
      <div className={`admin-main${collapsed ? ' collapsed' : ''}`}>
        <Topbar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
