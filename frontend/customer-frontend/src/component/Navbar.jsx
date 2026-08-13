import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-white border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
          <div className="bg-yellow-400 text-black px-4 py-1.5 rounded-full font-black text-xl tracking-tight shadow-sm">
            RaahGo
          </div>
        </div>

        {/* Nav Links */}
        <nav className="hidden lg:flex items-center gap-8">
          <a href="#" onClick={(e) => { e.preventDefault(); navigate('/home'); }} className="text-gray-900 font-black text-sm border-b-2 border-yellow-400 pb-1">Home</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-bold text-sm transition-colors">About Us</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-bold text-sm transition-colors">Safety</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-bold text-sm transition-colors">Careers</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-bold text-sm transition-colors">Blog</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-bold text-sm transition-colors">Press</a>
          <a href="#" className="text-gray-600 hover:text-gray-900 font-bold text-sm transition-colors">Contact Us</a>
        </nav>

        {/* Action Buttons */}
        <div className="flex items-center gap-4">
          {user ? (
            <button 
              onClick={onLogout}
              className="px-6 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-black text-sm transition-colors cursor-pointer border-none"
            >
              Logout
            </button>
          ) : (
            <button 
              onClick={() => navigate('/login')}
              className="px-6 py-2.5 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-black text-sm transition-colors cursor-pointer border-none"
            >
              Login
            </button>
          )}
          <button className="hidden lg:block px-6 py-2.5 rounded-full bg-black text-white font-black text-sm hover:bg-gray-900 transition-colors shadow-lg shadow-black/20 cursor-pointer border-none">
            Download App
          </button>
        </div>
      </div>
    </header>
  );
}
