import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <header className="w-full glass-nav sticky top-0 z-50 transition-all">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => navigate('/')}>
          <div className="bg-gradient-to-r from-emerald-600 to-[#063B28] text-white px-5 py-2 rounded-full font-black text-xl tracking-tight shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-all flex items-center gap-1.5 border border-white/20">
            <span>RaahGo</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-8">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/home'); }} className="text-[#063B28] font-black text-sm border-b-2 border-emerald-500 pb-1">Home</a>
          <a href="#" className="text-gray-600 hover:text-[#063B28] font-bold text-sm transition-colors">About Us</a>
          <a href="#" className="text-gray-600 hover:text-[#063B28] font-bold text-sm transition-colors">Safety</a>
          <a href="#" className="text-gray-600 hover:text-[#063B28] font-bold text-sm transition-colors">Careers</a>
          <a href="#" className="text-gray-600 hover:text-[#063B28] font-bold text-sm transition-colors">Blog</a>
          <a href="#" className="text-gray-600 hover:text-[#063B28] font-bold text-sm transition-colors">Contact Us</a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {user ? (
            <button 
              onClick={onLogout}
              className="px-5 py-2.5 rounded-full bg-white/80 hover:bg-white text-gray-800 font-bold text-sm transition-all shadow-xs border border-gray-200/80 cursor-pointer backdrop-blur-md active:scale-95"
            >
              Logout
            </button>
          ) : (
            <button 
              onClick={() => navigate('/login')}
              className="px-5 py-2.5 rounded-full bg-white/80 hover:bg-white text-gray-800 font-bold text-sm transition-all shadow-xs border border-gray-200/80 cursor-pointer backdrop-blur-md active:scale-95"
            >
              Login
            </button>
          )}
          <button className="hidden lg:flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#063B28] text-white font-extrabold text-sm hover:bg-[#084A33] transition-all shadow-lg shadow-[#063B28]/20 cursor-pointer border border-emerald-600/30 active:scale-95">
            Download App
          </button>
        </div>
      </div>
    </header>
  );
}
