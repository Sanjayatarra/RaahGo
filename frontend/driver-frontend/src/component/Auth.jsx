import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import CompleteProfileForm from './CompleteProfileForm';
import HomePage from './HomePage';
import { Car, ShieldCheck, Sparkles, LogOut } from 'lucide-react';

export default function Auth() {
  const location = useLocation();
  const navigate = useNavigate();

  const getTabFromPath = (pathname) => {
    if (pathname === '/signup') return 'signup';
    if (pathname === '/complete-profile') return 'complete-profile';
    if (pathname === '/home') return 'home';
    return 'login';
  };

  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('raahgo_driver_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [pendingAuthData, setPendingAuthData] = useState(null);
  const pathView = getTabFromPath(location.pathname);

  useEffect(() => {
    if (location.pathname === '/' || location.pathname === '/home') {
      if (!user) {
        navigate('/login', { replace: true });
      }
    }
  }, [location.pathname, user, navigate]);

  const handleAuthSuccess = (data) => {
    const initialName = data.name || (data.user?.first_name ? `${data.user.first_name} ${data.user.last_name || ''}`.trim() : (data.identifier?.includes('@') ? data.identifier.split('@')[0] : 'Captain'));
    const authData = {
      ...data,
      name: initialName,
      loggedInAt: new Date().toLocaleTimeString(),
    };

    setPendingAuthData(authData);

    if (!data.profileCompleted && !data.user?.vehicle_number) {
      navigate('/complete-profile');
    } else {
      setUser(authData);
      localStorage.setItem('raahgo_driver_user', JSON.stringify(authData));
      navigate('/home');
    }
  };

  const handleProfileComplete = (completedData) => {
    setUser(completedData);
    localStorage.setItem('raahgo_driver_user', JSON.stringify(completedData));
    navigate('/home');
  };

  const handleLogout = () => {
    setUser(null);
    setPendingAuthData(null);
    localStorage.removeItem('raahgo_driver_user');
    localStorage.removeItem('driver_access_token');
    localStorage.removeItem('driver_refresh_token');
    navigate('/login');
  };

  if (pathView === 'home' && user) {
    return <HomePage user={user} onLogout={handleLogout} />;
  }

  const activeUser = user || pendingAuthData;

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] text-[#1C1C1E] flex flex-col justify-between relative font-sans">
      {/* Header */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-5 flex items-center justify-between z-10 border-b border-[#E5E5EA] bg-white">
        <div className="flex items-center gap-2.5 sm:gap-3 cursor-pointer" onClick={() => navigate('/')}>
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#FFC000] text-black flex items-center justify-center shadow-md shadow-[#FFC000]/25">
            <Car className="w-5 h-5 sm:w-6 sm:h-6 text-black" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold tracking-wider text-[#1C1C1E]">
              RaahGo
            </span>
            <span className="text-[9px] sm:text-[10px] block font-semibold uppercase tracking-widest text-[#636366]">
              Driver Partner Portal
            </span>
          </div>
        </div>

        {/* Right Header Navigation */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs">
          {activeUser ? (
            <div className="flex items-center gap-2 sm:gap-3 bg-[#F8F9FA] border border-[#E5E5EA] px-2.5 sm:px-3.5 py-1.5 rounded-full">
              <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-[#FFC000] text-black font-extrabold flex items-center justify-center text-[10px] sm:text-xs shadow-xs">
                {activeUser.name ? activeUser.name.charAt(0).toUpperCase() : 'C'}
              </div>
              <span className="font-extrabold text-[#1C1C1E] hidden sm:inline">
                {activeUser.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[#636366] hover:text-[#FF3B30] font-bold transition-colors ml-0.5 cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                  pathView === 'login'
                    ? 'bg-[#FFC000] text-black shadow-xs'
                    : 'bg-[#F8F9FA] text-[#3A3A3C] hover:bg-[#E5E5EA]'
                }`}
              >
                Log In
              </button>
              <button
                type="button"
                onClick={() => navigate('/signup')}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl font-bold transition-all text-xs cursor-pointer ${
                  pathView === 'signup'
                    ? 'bg-[#FFC000] text-black shadow-xs'
                    : 'bg-[#F8F9FA] text-[#3A3A3C] hover:bg-[#E5E5EA]'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-3 sm:p-6 z-10 my-3 sm:my-6">
        {pathView === 'complete-profile' ? (
          <CompleteProfileForm
            initialData={pendingAuthData}
            onComplete={handleProfileComplete}
          />
        ) : (
          <div className="w-full max-w-md">
            <div className="bg-white border border-[#E5E5EA] rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-xl relative">
              {pathView === 'signup' ? (
                <SignupForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => navigate('/login')}
                />
              ) : (
                <LoginForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToSignup={() => navigate('/signup')}
                />
              )}
            </div>

            <p className="text-center text-[10px] sm:text-[11px] text-[#636366] mt-4 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FFC000]" />
              <span>Instant Driver Verification powered by RaahGo Security</span>
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-3.5 border-t border-[#E5E5EA] text-[10px] sm:text-[11px] text-[#636366] bg-white z-10">
        &copy; {new Date().getFullYear()} RaahGo Driver Partner Portal. All rights reserved.
      </footer>
    </div>
  );
}
