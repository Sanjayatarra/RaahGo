import React, { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';
import { Car, Shield, Sparkles, CheckCircle2, UserCheck, LogOut } from 'lucide-react';

export default function Auth() {
  const [activeTab, setActiveTab] = useState('login'); // 'login' | 'signup'
  const [user, setUser] = useState(null);

  const handleAuthSuccess = (data) => {
    setUser({
      name: data.name || (data.identifier.includes('@') ? data.identifier.split('@')[0] : 'Customer'),
      identifier: data.identifier,
      authMethod: data.authMethod,
      mode: data.type,
      loggedInAt: new Date().toLocaleTimeString(),
    });
  };

  const handleLogout = () => {
    setUser(null);
    setActiveTab('login');
  };

  return (
    <div className="min-h-screen w-full bg-[#F8F9FA] text-[#1C1C1E] flex flex-col justify-between relative font-sans">
      {/* Header with #FFC000 Amber Accent */}
      <header className="w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between z-10 border-b border-[#E5E5EA] bg-white">
        <div className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-10 rounded-xl bg-[#FFC000] text-black flex items-center justify-center shadow-md shadow-[#FFC000]/25">
            <Car className="w-6 h-6 text-black" />
          </div>
          <div>
            <span className="text-xl font-extrabold tracking-wider text-[#1C1C1E]">
              RaahGo
            </span>
            <span className="text-[10px] block font-semibold uppercase tracking-widest text-[#636366]">
              Customer Portal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="hidden sm:flex items-center gap-1.5 text-[#3A3A3C] bg-[#F8F9FA] border border-[#E5E5EA] px-3.5 py-1.5 rounded-full font-medium">
            <Shield className="w-3.5 h-3.5 text-[#FFC000]" /> Safe & Secure Rides
          </span>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 z-10 my-6">
        {user ? (
          /* Authenticated Dashboard Welcome View */
          <div className="w-full max-w-md bg-white border border-[#E5E5EA] rounded-3xl p-8 shadow-xl text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 bg-[#FFC000] rounded-full flex items-center justify-center mx-auto shadow-lg shadow-[#FFC000]/30">
              <UserCheck className="w-10 h-10 text-black" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#FFF3D1] border border-[#FFC000]/40 text-[#4A3500] text-xs font-bold mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#8A6500]" /> Authentication Successful
              </div>
              <h2 className="text-2xl font-extrabold text-[#1C1C1E]">Welcome back, {user.name}!</h2>
              <p className="text-xs text-[#636366] mt-1.5">
                Logged in via <span className="text-black font-bold capitalize">{user.authMethod}</span>: {user.identifier}
              </p>
            </div>

            <div className="bg-[#F8F9FA] p-4 rounded-2xl border border-[#E5E5EA] text-left text-xs space-y-2 text-[#3A3A3C]">
              <div className="flex justify-between border-b border-[#E5E5EA] pb-2">
                <span className="text-[#636366]">Account Type</span>
                <span className="font-bold text-black">Customer Account</span>
              </div>
              <div className="flex justify-between border-b border-[#E5E5EA] pb-2">
                <span className="text-[#636366]">Action</span>
                <span className="font-bold text-black capitalize">{user.mode} completed</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#636366]">Session Started</span>
                <span className="font-semibold text-[#1C1C1E]">{user.loggedInAt}</span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="w-full py-3.5 px-4 bg-[#F8F9FA] hover:bg-[#E5E5EA] border border-[#E5E5EA] text-[#1C1C1E] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4 text-[#636366]" /> Log Out
            </button>
          </div>
        ) : (
          /* Customer Auth Card */
          <div className="w-full max-w-md">
            <div className="bg-white border border-[#E5E5EA] rounded-3xl p-6 sm:p-8 shadow-xl relative">
              {/* Sign In vs Sign Up Tabs */}
              <div className="flex bg-[#F8F9FA] p-1.5 rounded-2xl border border-[#E5E5EA] mb-6">
                <button
                  onClick={() => setActiveTab('login')}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-200 ${
                    activeTab === 'login'
                      ? 'bg-[#FFC000] text-black shadow-sm'
                      : 'text-[#636366] hover:text-[#1C1C1E]'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setActiveTab('signup')}
                  className={`flex-1 py-2.5 text-xs font-extrabold rounded-xl transition-all duration-200 ${
                    activeTab === 'signup'
                      ? 'bg-[#FFC000] text-black shadow-sm'
                      : 'text-[#636366] hover:text-[#1C1C1E]'
                  }`}
                >
                  Sign Up
                </button>
              </div>

              {/* Tab Form Component */}
              {activeTab === 'login' ? (
                <LoginForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToSignup={() => setActiveTab('signup')}
                />
              ) : (
                <SignupForm
                  onSuccess={handleAuthSuccess}
                  onSwitchToLogin={() => setActiveTab('login')}
                />
              )}
            </div>

            {/* Security Note */}
            <p className="text-center text-[11px] text-[#636366] mt-4 flex items-center justify-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#FFC000]" />
              <span>Instant OTP authentication powered by RaahGo Security</span>
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-4 border-t border-[#E5E5EA] text-[11px] text-[#636366] bg-white z-10">
        &copy; {new Date().getFullYear()} RaahGo Customer Portal. All rights reserved.
      </footer>
    </div>
  );
}
