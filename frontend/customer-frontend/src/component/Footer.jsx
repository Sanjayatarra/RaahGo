import React from 'react';
import { Play, Apple } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="w-full bg-black text-white pt-20 pb-8 mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex justify-between items-start mb-16">
          {/* App Stores */}
          <div className="flex gap-16">
            <div>
              <h4 className="text-sm font-bold text-gray-300 mb-6">Customer app</h4>
              <div className="space-y-4">
                <button className="w-40 h-[46px] bg-black border border-gray-600 rounded-lg flex items-center justify-center gap-2.5 px-3 hover:bg-gray-900 hover:border-gray-500 transition-colors cursor-pointer group">
                  <Play className="w-6 h-6 text-white group-hover:text-gray-200 fill-white" />
                  <div className="text-left flex flex-col justify-center">
                    <span className="text-[9px] text-gray-300 font-bold leading-none uppercase tracking-wide">Get it on</span>
                    <span className="text-[15px] font-medium text-white leading-tight">Google Play</span>
                  </div>
                </button>
                <button className="w-40 h-[46px] bg-black border border-gray-600 rounded-lg flex items-center justify-center gap-2.5 px-3 hover:bg-gray-900 hover:border-gray-500 transition-colors cursor-pointer group">
                  <Apple className="w-7 h-7 text-white group-hover:text-gray-200 fill-white pb-0.5" />
                  <div className="text-left flex flex-col justify-center">
                    <span className="text-[9px] text-gray-300 font-bold leading-none tracking-wide">Download on the</span>
                    <span className="text-[15px] font-medium text-white leading-tight">App Store</span>
                  </div>
                </button>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-bold text-gray-300 mb-6">Captain app</h4>
              <div className="space-y-4">
                <button className="w-40 h-[46px] bg-black border border-gray-600 rounded-lg flex items-center justify-center gap-2.5 px-3 hover:bg-gray-900 hover:border-gray-500 transition-colors cursor-pointer group">
                  <Play className="w-6 h-6 text-white group-hover:text-gray-200 fill-white" />
                  <div className="text-left flex flex-col justify-center">
                    <span className="text-[9px] text-gray-300 font-bold leading-none uppercase tracking-wide">Get it on</span>
                    <span className="text-[15px] font-medium text-white leading-tight">Google Play</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex gap-16">
            <div className="flex flex-col space-y-3">
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Home</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">About Us</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Careers</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Safety</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Blog</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Press</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Privacy Policy</a>
            </div>
            <div className="flex flex-col space-y-3">
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Customer Terms - Bike Taxi</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Customer Terms - Cabs and Auto</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Corporate Affairs</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Captain Terms - Bike Taxi</a>
              <a href="#" className="text-sm text-gray-400 hover:text-white font-semibold transition-colors">Captain Terms - Cabs and Auto</a>
            </div>
          </div>

          {/* Social */}
          <div>
            <h4 className="text-sm font-bold text-gray-300 mb-6">Follow Us</h4>
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"><span className="text-white text-xs">FB</span></div>
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"><span className="text-white text-xs">TW</span></div>
              <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors"><span className="text-white text-xs">IN</span></div>
            </div>
          </div>
        </div>
        
        <div className="pt-8 border-t border-gray-800 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} RaahGo Technologies. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
