import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Mail, Phone, User, ArrowRight, CheckSquare, Square } from 'lucide-react';
import OtpInput from './OtpInput';

// Standard Phone Number Formatter (e.g. 98765 43210)
const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

export default function SignupForm({ onSuccess, onSwitchToLogin }) {
  const location = useLocation();
  const [authMethod, setAuthMethod] = useState('mobile'); // 'mobile' | 'email'
  const [name, setName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showOtp, setShowOtp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);

  const identifier = authMethod === 'mobile' ? mobileNumber : emailAddress;

  useEffect(() => {
    if (location.state?.prefill) {
      const prefill = location.state.prefill;
      if (prefill.includes('@')) {
        setAuthMethod('email');
        setEmailAddress(prefill);
      } else {
        setAuthMethod('mobile');
        setMobileNumber(formatPhone(prefill));
      }
    }
  }, [location.state]);

  useEffect(() => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: "230188895926-tahfl2kalg.apps.googleusercontent.com",
          callback: handleGoogleResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      } catch (e) {
        console.log('Google GSI Init:', e);
      }
    }
  }, []);

  const handleGoogleResponse = async (response) => {
    if (response?.credential) {
      setGoogleLoading(true);
      setError('');
      try {
        const res = await fetch('/api/v1/customer/google-auth/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: response.credential })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.access) localStorage.setItem('access_token', data.access);
          if (data.refresh) localStorage.setItem('refresh_token', data.refresh);

          if (onSuccess) {
            onSuccess({
              type: 'signup',
              authMethod: 'google',
              jwtAccess: data.access,
              jwtRefresh: data.refresh,
              user: data.user
            });
          }
        } else {
          const errData = await res.json().catch(() => ({}));
          setError(errData.error || 'Google authentication failed. Please enter your details below.');
          setAuthMethod('email');
        }
      } catch (err) {
        setError('Network error during Google authentication.');
      } finally {
        setGoogleLoading(false);
      }
    } else {
      setError('Google Sign-Up was not confirmed.');
      setGoogleLoading(false);
    }
  };

  const handleGoogleAuthClick = () => {
    setError('');
    setGoogleLoading(true);

    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: "230188895926-tahfl2kalg.apps.googleusercontent.com",
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.prompt((notification) => {
        setGoogleLoading(false);
        if (
          notification.isNotDisplayed() ||
          notification.isSkippedMoment() ||
          notification.isDismissedMoment()
        ) {
          setError('Google authorization incomplete. Please enter your Gmail / Email address below.');
          setAuthMethod('email');
        }
      });
    } else {
      setGoogleLoading(false);
      setError('Google SDK unavailable. Please enter your Gmail / Email address below.');
      setAuthMethod('email');
    }
  };

  const validateInput = () => {
    if (!name.trim()) {
      setError('Please enter your full name');
      return false;
    }
    if (authMethod === 'mobile') {
      const rawValue = mobileNumber.replace(/\D/g, '');
      if (!mobileNumber.trim()) {
        setError('Please enter your mobile number');
        return false;
      }
      if (rawValue.length < 10) {
        setError('Please enter a valid 10-digit mobile number');
        return false;
      }
    } else {
      if (!emailAddress.trim()) {
        setError('Please enter your Gmail / Email address');
        return false;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(emailAddress)) {
        setError('Please enter a valid email address');
        return false;
      }
    }
    if (!agreeTerms) {
      setError('You must accept the terms and conditions');
      return false;
    }
    return true;
  };

  // Hit Django REST Framework Send OTP API Endpoint
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!validateInput()) return;

    setIsLoading(true);
    const cleanTarget = authMethod === 'mobile' ? mobileNumber.replace(/\D/g, '') : emailAddress.trim();
    const payload = authMethod === 'mobile'
      ? { phone_number: cleanTarget, purpose: 'Register', role: 'Customer' }
      : { email: cleanTarget, purpose: 'Register', role: 'Customer' };

    try {
      const response = await fetch('/api/v1/customer/send-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setShowOtp(true);
        if (data.otp) console.log('[Django Backend] Sent Signup OTP:', data.otp);
      } else {
        setError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Hit Django REST Framework Verify OTP API Endpoint -> Transition to CompleteProfileForm
  const handleVerifyOtp = async (otpCode) => {
    setError('');
    const cleanTarget = authMethod === 'mobile' ? mobileNumber.replace(/\D/g, '') : emailAddress.trim();
    const payload = authMethod === 'mobile'
      ? { phone_number: cleanTarget, otp: otpCode, role: 'Customer' }
      : { email: cleanTarget, otp: otpCode, role: 'Customer' };

    try {
      const response = await fetch('/api/v1/customer/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (response.ok) {
        const jwtAccess = data.access;
        const jwtRefresh = data.refresh;
        const backendUser = data.user;

        if (!jwtAccess || !jwtRefresh) {
          setError('Authentication failed: Server did not return valid JWT tokens.');
          return;
        }

        localStorage.setItem('access_token', jwtAccess);
        localStorage.setItem('refresh_token', jwtRefresh);

        if (onSuccess) {
          onSuccess({
            type: 'signup',
            name,
            identifier,
            authMethod,
            otp: otpCode,
            jwtAccess,
            jwtRefresh,
            user: backendUser
          });
        }
      } else {
        setError(data.error || 'Incorrect OTP code. Please try again.');
      }
    } catch (err) {
      setError('Network error while verifying OTP.');
    }
  };

  return (
    <div className="w-full">
      {!showOtp ? (
        <div className="space-y-5 animate-fade-in">
          {/* Header text */}
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Create Your Account</h2>
            <p className="text-xs text-gray-500 mt-1">Join RaahGo with Mobile Number or Gmail</p>
          </div>

          {/* Native Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleAuthClick}
            disabled={googleLoading}
            className="w-full py-3 px-4 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl text-gray-900 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-3 hover:border-gray-300 active:scale-95"
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
            <span>Sign up with Google / Gmail</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-gray-200 w-full"></div>
            <span className="bg-white px-3 text-xs font-bold text-gray-400 uppercase tracking-wider absolute">
              OR SIGN UP WITH
            </span>
          </div>

          {/* Toggle between Mobile & Email */}
          <div className="flex bg-gray-50 p-1 rounded-xl border border-gray-200">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('mobile');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                authMethod === 'mobile'
                  ? 'bg-yellow-400 text-black shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Phone className="w-3.5 h-3.5" /> Mobile Number
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMethod('email');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 ${
                authMethod === 'email'
                  ? 'bg-yellow-400 text-black shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <Mail className="w-3.5 h-3.5" /> Gmail / Email
            </button>
          </div>

          {/* Signup form */}
          <form onSubmit={handleSendOtp} className="space-y-3.5">
            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="John Doe"
                  className="w-full bg-white text-gray-900 font-bold placeholder:font-normal placeholder:text-gray-400 text-sm rounded-xl py-2.5 pl-10 pr-4 border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all duration-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Mobile / Gmail Input */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {authMethod === 'mobile' ? 'Mobile Number' : 'Gmail / Email Address'}
              </label>
              <div className="relative">
                {authMethod === 'mobile' ? (
                  <>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-gray-700 font-bold text-base border-r border-gray-200 pr-2.5 h-6">
                      <span>+91</span>
                    </div>
                    <input
                      type="tel"
                      value={mobileNumber}
                      maxLength={11}
                      onChange={(e) => {
                        let val = formatPhone(e.target.value);
                        setMobileNumber(val);
                        if (error) setError('');
                      }}
                      placeholder="98765 43210"
                      className={`w-full bg-white text-gray-900 font-extrabold text-base sm:text-lg tracking-wide placeholder:font-normal placeholder:text-gray-400 placeholder:tracking-normal rounded-xl py-2 pl-14 pr-3 border transition-all duration-200 focus:outline-none ${
                        error
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                      }`}
                    />
                  </>
                ) : (
                  <>
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-5 text-gray-500" />
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => {
                        setEmailAddress(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="name@gmail.com"
                      className={`w-full bg-white text-gray-900 font-bold text-base tracking-wide placeholder:font-normal placeholder:text-gray-400 placeholder:tracking-normal rounded-xl py-2 pl-10 pr-3 border transition-all duration-200 focus:outline-none ${
                        error
                          ? 'border-red-500 focus:ring-2 focus:ring-red-500/20'
                          : 'border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
                      }`}
                    />
                  </>
                )}
              </div>
            </div>

            {/* Terms checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setAgreeTerms(!agreeTerms)}
                className="text-black transition-colors"
              >
                {agreeTerms ? (
                  <CheckSquare className="w-4 h-4 text-black fill-yellow-400" />
                ) : (
                  <Square className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <label className="text-xs text-gray-500 leading-tight select-none">
                I agree to the{' '}
                <a href="#terms" className="text-gray-900 font-bold underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="text-gray-900 font-bold underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 active:scale-95 text-black font-extrabold text-sm rounded-xl shadow-lg shadow-yellow-400/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                  <span>Generating OTP...</span>
                </>
              ) : (
                <>
                  <span>Send OTP Verification</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          {/* Switch to Login */}
          <p className="text-center text-xs text-gray-500 pt-1">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-gray-900 font-bold hover:underline transition-colors"
            >
              Sign in instead
            </button>
          </p>
        </div>
      ) : (
        /* OTP Verification Panel */
        <OtpInput
          identifier={identifier}
          type={authMethod}
          externalError={error}
          onBack={() => setShowOtp(false)}
          onVerify={handleVerifyOtp}
          onResend={() => {
            console.log('Resending Signup OTP to:', identifier);
          }}
        />
      )}
    </div>
  );
}
