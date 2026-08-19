import Navbar from './Navbar';
import { Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="admin-layout top-nav-layout">
      <Navbar />
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
