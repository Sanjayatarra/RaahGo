import React, { useState } from 'react';
import { User, X } from 'lucide-react';

export default function GoogleAuthModal({ isOpen, onClose, onSelectAccount }) {
  const [customEmail, setCustomEmail] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Local / Detected accounts matching Google Accounts chooser
  const suggestedAccounts = [
    {
      name: 'Sanjay Soni',
      email: 'sanjay.s@multitvsolution.com',
      avatar: 'S',
      color: 'bg-purple-600'
    }
  ];

  const handleSelect = (account) => {
    onSelectAccount(account.email, account.name);
    onClose();
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) {
      setError('Please enter a valid Gmail / Email address');
      return;
    }
    const derivedName = customEmail.split('@')[0].replace(/[._]/g, ' ');
    const formattedName = derivedName.charAt(0).toUpperCase() + derivedName.slice(1);
    onSelectAccount(customEmail.trim(), formattedName);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-fade-in">
      {/* Google Sign In Modal Box */}
      <div className="bg-neutral-900 text-neutral-200 rounded-2xl w-full max-w-md shadow-2xl border border-neutral-800 overflow-hidden flex flex-col justify-between min-h-[480px]">
        {/* Top bar with Google Branding & Close */}
        <div className="p-5 pb-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#EA4335"
                d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
              />
              <path
                fill="#4285F4"
                d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
              />
              <path
                fill="#FBBC05"
                d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.7 0 12.3 0 15s.7 5.3 1.9 7.7l3.7-2.9z"
              />
              <path
                fill="#34A853"
                d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.4-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
              />
            </svg>
            <span className="text-sm font-medium text-neutral-200">Sign in with Google</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Accounts Chooser Body */}
        <div className="p-6 flex-1 flex flex-col justify-start">
          <h2 className="text-2xl font-normal text-neutral-200 mb-1 tracking-tight">Choose an account</h2>
          <p className="text-sm font-medium text-neutral-200 mb-6">
            to continue to <span className="text-blue-300 font-semibold">raahgo.com</span>
          </p>

          {!showCustomInput ? (
            <div className="space-y-1">
              {/* Local Account List */}
              {suggestedAccounts.map((acc, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelect(acc)}
                  className="w-full py-3 px-2 rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-3.5 text-left group border-b border-neutral-700 last:border-b-0"
                >
                  <div
                    className={`w-9 h-9 rounded-full ${acc.color} text-white font-medium text-base flex items-center justify-center shrink-0`}
                  >
                    {acc.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-neutral-200 truncate group-hover:text-white">
                      {acc.name}
                    </h3>
                    <p className="text-xs text-neutral-300 truncate">{acc.email}</p>
                  </div>
                </button>
              ))}

              <div className="border-t border-neutral-700 pt-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="w-full py-3 px-2 rounded-xl hover:bg-neutral-800 transition-colors flex items-center gap-3.5 text-left group"
                >
                  <div className="w-9 h-9 rounded-full border border-neutral-400 flex items-center justify-center shrink-0 text-neutral-300 group-hover:border-white group-hover:text-white">
                    <User className="w-5 h-5" />
                  </div>
                  <span className="text-sm font-medium text-neutral-200 group-hover:text-white">
                    Use another account
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* Enter Another Account Form */
            <form onSubmit={handleCustomSubmit} className="space-y-4 pt-2 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-neutral-300">
                  Enter your email or phone
                </label>
                <button
                  type="button"
                  onClick={() => setShowCustomInput(false)}
                  className="text-xs font-semibold text-blue-300 hover:underline"
                >
                  Back
                </button>
              </div>
              <input
                type="email"
                value={customEmail}
                onChange={(e) => {
                  setCustomEmail(e.target.value);
                  if (error) setError('');
                }}
                placeholder="sanjay.s@multitvsolution.com"
                className="w-full bg-neutral-950 text-neutral-200 text-sm rounded-lg py-3 px-3.5 border border-neutral-400 focus:border-blue-300 focus:outline-none"
              />
              {error && <p className="text-xs text-red-300 font-medium">{error}</p>}
              <button
                type="submit"
                className="w-full py-2.5 bg-blue-300 hover:bg-blue-400 text-blue-900 font-semibold text-xs rounded-full transition-colors"
              >
                Next
              </button>
            </form>
          )}
        </div>

        {/* Footer Bar matching Google Sign In */}
        <div className="p-4 px-6 border-t border-neutral-800 flex items-center justify-between text-xs text-neutral-400">
          <div className="flex items-center gap-1 cursor-pointer hover:text-neutral-300">
            <span>English (United States)</span>
            <span className="text-xs">▼</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#help" className="hover:text-neutral-300 transition-colors">
              Help
            </a>
            <a href="#privacy" className="hover:text-neutral-300 transition-colors">
              Privacy
            </a>
            <a href="#terms" className="hover:text-neutral-300 transition-colors">
              Terms
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
