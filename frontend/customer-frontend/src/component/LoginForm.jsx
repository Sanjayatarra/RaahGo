import React, { useState } from 'react';
import { Mail, Phone, ArrowRight, AlertCircle } from 'lucide-react';
import OtpInput from './OtpInput';

// Standard Phone Number Formatter (e.g. 98765 43210)
const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

export default function LoginForm({ onSuccess, onSwitchToSignup }) {
  const [authMethod, setAuthMethod] = useState('mobile'); // 'mobile' | 'email'
  const [identifier, setIdentifier] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [notExistAlert, setNotExistAlert] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const validateInput = () => {
    const rawValue = identifier.replace(/\D/g, '');
    if (!identifier.trim()) {
      setError(authMethod === 'mobile' ? 'Please enter your mobile number' : 'Please enter your email address');
      return false;
    }
    if (authMethod === 'mobile') {
      if (rawValue.length < 10) {
        setError('Please enter a valid 10-digit mobile number');
        return false;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(identifier)) {
        setError('Please enter a valid email address');
        return false;
      }
    }
    return true;
  };

  const handleSendOtp = (e) => {
    if (e) e.preventDefault();
    setError('');
    setNotExistAlert(false);

    if (!validateInput()) return;

    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setShowOtp(true);
    }, 600);
  };

  const handleGoogleSignIn = () => {
    setGoogleLoading(true);
    setError('');
    setNotExistAlert(false);
    setTimeout(() => {
      setGoogleLoading(false);
      setAuthMethod('email');
      setIdentifier('demo.user@gmail.com');
      setShowOtp(true);
    }, 1000);
  };

  const handleVerifyOtp = (otpCode) => {
    if (onSuccess) {
      onSuccess({
        type: 'login',
        identifier,
        authMethod,
        otp: otpCode,
      });
    }
  };

  return (
    <div className="w-full relative">
      {/* Floating Z-Index Alert (Does NOT occupy form layout space) */}
      {notExistAlert && (
        <div className="absolute top-[-1%] left-1/2 -translate-x-1/2 z-50 bg-[#FF3B30] text-white text-xs font-extrabold px-4 py-2 rounded-xl shadow-xl border border-red-600 flex items-center gap-2 whitespace-nowrap animate-bounce">
          <AlertCircle className="w-4 h-4 text-white" />
          <span>User Account Not Found!</span>
        </div>
      )}

      {!showOtp ? (
        <div className="space-y-5 animate-fade-in">
          {/* Header text */}
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-[#1C1C1E] tracking-tight">Welcome Back</h2>
            <p className="text-xs text-[#636366] mt-1">Sign in with your phone number or Gmail</p>
          </div>

          {/* Toggle between Mobile & Email */}
          <div className="flex bg-[#F8F9FA] p-1 rounded-xl border border-[#E5E5EA]">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('mobile');
                setIdentifier('');
                setError('');
                setNotExistAlert(false);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${authMethod === 'mobile'
                ? 'bg-[#FFC000] text-black shadow-sm'
                : 'text-[#636366] hover:text-[#1C1C1E]'
                }`}
            >
              <Phone className="w-3.5 h-3.5" /> Mobile Number
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('email');
                setIdentifier('');
                setError('');
                setNotExistAlert(false);
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${authMethod === 'email'
                ? 'bg-[#FFC000] text-black shadow-sm'
                : 'text-[#636366] hover:text-[#1C1C1E]'
                }`}
            >
              <Mail className="w-3.5 h-3.5" /> Gmail / Email
            </button>
          </div>

          {/* Input form */}
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-[#3A3A3C] mb-1.5">
                {authMethod === 'mobile' ? 'Phone Number' : 'Gmail / Email Address'}
              </label>
              <div className="relative">
                {authMethod === 'mobile' ? (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-[#3A3A3C] font-bold text-base border-r border-[#E5E5EA] pr-2.5 h-6">
                    <span>+91</span>
                  </div>
                ) : (
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-5 text-[#636366]" />
                )}
                <input
                  type={authMethod === 'mobile' ? 'tel' : 'email'}
                  value={identifier}
                  maxLength={authMethod === 'mobile' ? 11 : undefined}
                  onChange={(e) => {
                    let val = e.target.value;
                    if (authMethod === 'mobile') {
                      val = formatPhone(val);
                    }
                    setIdentifier(val);
                    if (error) setError('');
                    if (notExistAlert) setNotExistAlert(false);
                  }}
                  placeholder={
                    authMethod === 'mobile'
                      ? '98765 43210'
                      : 'name@gmail.com'
                  }
                  className={`w-full bg-white text-[#1C1C1E] font-extrabold text-base sm:text-lg tracking-wide placeholder:font-normal placeholder:text-[#8E8E93] placeholder:tracking-normal rounded-xl py-2 border transition-all duration-200 focus:outline-none ${authMethod === 'mobile' ? 'pl-14 pr-3' : 'pl-10 pr-3'
                    } ${notExistAlert || error
                      ? 'border-[#FF3B30] focus:ring-2 focus:ring-[#FF3B30]/20'
                      : 'border-[#E5E5EA] focus:border-[#FFC000] focus:ring-2 focus:ring-[#FFC000]/20'
                    }`}
                />
              </div>
              {error && !notExistAlert && (
                <p className="text-xs text-[#FF3B30] mt-1.5 font-medium">{error}</p>
              )}
            </div>

            {/* Send OTP button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFC000] to-[#FF9F0A] hover:from-[#e6ad00] hover:to-[#e68f00] active:scale-[0.99] text-black font-extrabold text-sm rounded-xl shadow-lg shadow-[#FFC000]/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                  <span>Sending OTP...</span>
                </>
              ) : (
                <>
                  <span>Send OTP</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="border-t border-[#E5E5EA] w-full"></div>
            <span className="bg-white px-3 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider absolute">
              OR CONTINUE WITH
            </span>
          </div>

          {/* Gmail / Google Login button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="w-full py-3 px-4 bg-white hover:bg-[#F8F9FA] border border-[#E5E5EA] rounded-xl text-[#1C1C1E] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-3 hover:border-[#C7C7CC] active:scale-[0.99]"
          >
            {googleLoading ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24">
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
            )}
            <span>Sign in with Google / Gmail</span>
          </button>

          {/* Bottom Switcher */}
          <p className="text-center text-xs text-[#636366] pt-2">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-[#1C1C1E] font-bold hover:underline transition-colors"
            >
              Sign up now
            </button>
          </p>
        </div>
      ) : (
        /* OTP Input View */
        <OtpInput
          identifier={identifier}
          type={authMethod}
          onBack={() => setShowOtp(false)}
          onVerify={handleVerifyOtp}
          onResend={() => {
            console.log('Resending OTP to:', identifier);
          }}
        />
      )}
    </div>
  );
}
