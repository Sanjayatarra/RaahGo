import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import CompleteProfileForm from './CompleteProfileForm';
import HomePage from './HomePage';
import BookRidePage from './BookRidePage';
import { Car, Shield, Sparkles, LogOut } from 'lucide-react';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active view based on URL path
  const getTabFromPath = (pathname) => {
    if (pathname === '/signup') return 'signup';
    if (pathname === '/complete-profile') return 'complete-profile';
    if (pathname === '/book-ride') return 'book-ride';
    if (pathname === '/home') return 'home';
    return 'login';
  };

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('raahgo_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [pendingAuthData, setPendingAuthData] = useState(null);
  const pathView = getTabFromPath(location.pathname);

  // Sync route path & authentication
  useEffect(() => {
    if (location.pathname === '/complete-profile') {
      if (!user) {
        navigate('/login', { replace: true });
      }
    }
  }, [location.pathname, user, navigate]);

  const handleAuthSuccess = (data) => {
    const initialName = data.name || (data.user?.first_name ? `${data.user.first_name} ${data.user.last_name || ''}`.trim() : (data.identifier?.includes('@') ? data.identifier.split('@')[0] : 'Customer'));
    const authData = {
      ...data,
      name: initialName,
      loggedInAt: new Date().toLocaleTimeString(),
    };

    setUser(authData);
    localStorage.setItem('raahgo_user', JSON.stringify(authData));

    // Check if there is a pending booking to resume
    const pendingBooking = localStorage.getItem('pending_booking');
    if (pendingBooking) {
      try {
        const parsed = JSON.parse(pendingBooking);
        if (parsed && (parsed.pickup || parsed.destination)) {
          navigate('/book-ride');
          return;
        }
      } catch (e) {}
    }
    // Immediate navigation to /home to book a ride
    navigate('/home');
  };

  const handleProfileComplete = (completedData) => {
    setUser(completedData);
    localStorage.setItem('raahgo_user', JSON.stringify(completedData));
    const pendingBooking = localStorage.getItem('pending_booking');
    if (pendingBooking) {
      try {
        const parsed = JSON.parse(pendingBooking);
        if (parsed && (parsed.pickup || parsed.destination)) {
          navigate('/book-ride');
          return;
        }
      } catch (e) {}
    }
    navigate('/home');
  };

  const handleLogout = () => {
    setUser(null);
    setPendingAuthData(null);
    localStorage.removeItem('raahgo_user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  // Render Full-Width Home Page when on /home
  if (pathView === 'home') {
    return <HomePage user={user} onLogout={handleLogout} />;
  }

  // Render Standalone Book Ride Page when on /book-ride
  if (pathView === 'book-ride') {
    return <BookRidePage user={user} onLogout={handleLogout} />;
  }

  const activeUser = user || pendingAuthData;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-slate-50 via-emerald-50/20 to-slate-100 text-gray-900 flex flex-col justify-between relative font-sans">
      {/* Glassmorphic Header */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex items-center justify-between z-10 glass-nav border-b border-white/80 rounded-b-3xl mt-0 shadow-sm">
        <div className="flex items-center gap-3 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-600 to-[#063B28] text-white flex items-center justify-center shadow-lg shadow-emerald-700/20 group-hover:scale-105 transition-all border border-white/20">
            <Car className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-gray-900 flex items-center gap-1.5">
              RaahGo
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            </span>
            <span className="text-[10px] block font-extrabold uppercase tracking-widest text-[#16A34A]">
              Customer Portal
            </span>
          </div>
        </div>

        {/* Right Header Navigation */}
        <div className="flex items-center gap-4 text-xs">
          {activeUser ? (
            <div className="flex items-center gap-3 glass-panel px-3.5 py-1.5 rounded-full border border-white/80">
              <div className="w-7 h-7 rounded-full bg-[#063B28] text-white font-extrabold flex items-center justify-center text-xs shadow-sm">
                {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <span className="font-extrabold text-gray-900 hidden sm:inline">
                {activeUser.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-gray-500 hover:text-red-500 font-bold transition-colors ml-1"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className={`px-5 py-2.5 rounded-2xl font-bold transition-all text-xs cursor-pointer ${pathView === 'login'
                    ? 'bg-[#063B28] text-white shadow-md'
                    : 'bg-white/80 text-gray-700 hover:bg-white border border-gray-200/80'
                  }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className={`px-5 py-2.5 rounded-2xl font-bold transition-all text-xs cursor-pointer ${pathView === 'signup'
                    ? 'bg-[#063B28] text-white shadow-md'
                    : 'bg-white/80 text-gray-700 hover:bg-white border border-gray-200/80'
                  }`}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Form Container according to URL route */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-6">
        {pathView === 'complete-profile' ? (
          <CompleteProfileForm
            initialData={pendingAuthData}
            onComplete={handleProfileComplete}
          />
        ) : (
          <div className="w-full max-w-md">
            <div className="glass-panel rounded-[32px] p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.08)] border border-white/80 relative">
              {pathView === 'signup' ? (
                <SignupForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => navigate('/login')}
                />
              ) : (
                <LoginForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToSignup={(prefill) => {
                    if (typeof prefill === 'string' && prefill.trim()) {
                      navigate('/signup', { state: { prefill } });
                    } else {
                      navigate('/signup');
                    }
                  }}
                />
              )}
            </div>

            <p className="text-center text-xs text-gray-500 font-medium mt-4 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
              <span>Instant OTP authentication powered by RaahGo Security</span>
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 text-xs text-gray-500 glass-nav border-t border-white/80 z-10">
        &copy; {new Date().getFullYear()} RaahGo Customer Portal. All rights reserved.
      </footer>
    </div>
  );
}
