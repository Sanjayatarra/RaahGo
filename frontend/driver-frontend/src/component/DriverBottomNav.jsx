import React from 'react';
import { Home, Car, DollarSign, Bell, User } from 'lucide-react';

export default function DriverBottomNav({ activeTab, onChangeTab, activeRidesCount = 0, unreadAlertsCount = 0 }) {
  const NAV_ITEMS = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'rides', label: 'Rides', icon: Car, badge: activeRidesCount },
    { id: 'earnings', label: 'Earnings', icon: DollarSign },
    { id: 'alerts', label: 'Alerts', icon: Bell, badge: unreadAlertsCount },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#E5E5EA] shadow-lg pb-safe">
      <div className="max-w-md sm:max-w-xl mx-auto px-3 py-2 flex items-center justify-around">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-3 sm:px-4 rounded-xl transition-all duration-150 ${
                isActive
                  ? 'text-black font-semibold scale-105'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-xl transition-colors ${
                    isActive ? 'bg-[#FFC000] text-black shadow-xs shadow-[#FFC000]/40' : ''
                  }`}
                >
                  <Icon className="w-5 h-5 sm:w-5 sm:h-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center animate-pulse">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] sm:text-[11px] mt-1 ${isActive ? 'font-bold text-black' : 'font-medium'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-black mt-0.5" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
