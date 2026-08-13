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
    
    // Immediate navigation to /home to book a ride
    navigate('/home');
  };

  const handleProfileComplete = (completedData) => {
    setUser(completedData);
    localStorage.setItem('raahgo_user', JSON.stringify(completedData));
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
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 flex flex-col justify-between relative font-sans">
      {/* Header with #FFC000 Amber Accent */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-10 h-10 rounded-xl bg-yellow-400 text-black flex items-center justify-center shadow-md shadow-yellow-400/25">
            <Car className="w-6 h-6 text-black" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-wider text-gray-900">
              RaahGo
            </span>
            <span className="text-xs block font-semibold uppercase tracking-widest text-gray-500">
              Customer Portal
            </span>
          </div>
        </div>

        {/* Right Header Navigation */}
        <div className="flex items-center gap-4 text-xs">
          {activeUser ? (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 px-3.5 py-1.5 rounded-full">
              <div className="w-7 h-7 rounded-full bg-yellow-400 text-black font-extrabold flex items-center justify-center text-xs shadow-sm">
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
                className={`px-4 py-2 rounded-xl font-bold transition-all text-xs ${
                  pathView === 'login'
                    ? 'bg-yellow-400 text-black shadow-xs'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className={`px-4 py-2 rounded-xl font-bold transition-all text-xs ${
                  pathView === 'signup'
                    ? 'bg-yellow-400 text-black shadow-xs'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-200'
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
            <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl relative">
              {pathView === 'signup' ? (
                <SignupForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => navigate('/login')}
                />
              ) : (
                <LoginForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToSignup={(prefill) => navigate('/signup', { state: { prefill } })}
                />
              )}
            </div>

            <p className="text-center text-xs text-gray-500 mt-4 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
              <span>Instant OTP authentication powered by RaahGo Security</span>
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 border-t border-gray-200 text-xs text-gray-500 bg-white z-10">
        &copy; {new Date().getFullYear()} RaahGo Customer Portal. All rights reserved.
      </footer>
    </div>
  );
}
