import React, { useState, useEffect } from 'react';
import { Mail, Phone, User, ArrowRight, CheckSquare, Square, ShieldCheck } from 'lucide-react';
import OtpInput from './OtpInput';

// Standard Phone Number Formatter (e.g. 98765 43210)
const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

export default function SignupForm({ onSuccess, onSwitchToLogin }) {
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
        const res = await fetch('/api/v1/driver/google-auth/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: response.credential })
        });

        if (res.ok) {
          const data = await res.json();
          if (data.access) localStorage.setItem('driver_access_token', data.access);
          if (data.refresh) localStorage.setItem('driver_refresh_token', data.refresh);

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
      setError('You must accept the Driver partner terms & conditions');
      return false;
    }
    return true;
  };

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');

    if (!validateInput()) return;

    setIsLoading(true);
    const cleanTarget = authMethod === 'mobile' ? mobileNumber.replace(/\D/g, '') : emailAddress.trim();
    const payload = authMethod === 'mobile'
      ? { phone_number: cleanTarget, purpose: 'Register', role: 'Driver' }
      : { email: cleanTarget, purpose: 'Register', role: 'Driver' };

    try {
      const response = await fetch('/api/v1/driver/send-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        setShowOtp(true);
        if (data.otp) console.log('[Django Backend] Sent Driver Signup OTP:', data.otp);
      } else {
        setError(data.error || 'Failed to send OTP.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (otpCode) => {
    setError('');
    const cleanTarget = authMethod === 'mobile' ? mobileNumber.replace(/\D/g, '') : emailAddress.trim();
    const payload = authMethod === 'mobile'
      ? { phone_number: cleanTarget, otp: otpCode, role: 'Driver' }
      : { email: cleanTarget, otp: otpCode, role: 'Driver' };

    try {
      const response = await fetch('/api/v1/driver/verify-otp/', {
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

        localStorage.setItem('driver_access_token', jwtAccess);
        localStorage.setItem('driver_refresh_token', jwtRefresh);

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
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFC000]/15 text-black font-extrabold text-[11px] rounded-full uppercase tracking-wider mb-2 border border-[#FFC000]/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Driver Partner Registration
            </div>
            <h2 className="text-2xl font-extrabold text-[#1C1C1E] tracking-tight">Become a RaahGo Captain</h2>
            <p className="text-xs text-[#636366] mt-1">Register with your phone number or Gmail</p>
          </div>

          {/* Native Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleAuthClick}
            disabled={googleLoading}
            className="w-full py-3 px-4 bg-white hover:bg-[#F8F9FA] border border-[#E5E5EA] rounded-xl text-[#1C1C1E] text-xs font-bold transition-all duration-200 flex items-center justify-center gap-3 hover:border-[#C7C7CC] active:scale-[0.99] cursor-pointer"
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
            <div className="border-t border-[#E5E5EA] w-full"></div>
            <span className="bg-white px-3 text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider absolute">
              OR REGISTER WITH
            </span>
          </div>

          {/* Toggle between Mobile & Email */}
          <div className="flex bg-[#F8F9FA] p-1 rounded-xl border border-[#E5E5EA]">
            <button
              type="button"
              onClick={() => {
                setAuthMethod('mobile');
                setError('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                authMethod === 'mobile'
                  ? 'bg-[#FFC000] text-black shadow-xs'
                  : 'text-[#636366] hover:text-[#1C1C1E]'
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
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer ${
                authMethod === 'email'
                  ? 'bg-[#FFC000] text-[#1C1C1E] shadow-xs'
                  : 'text-[#636366] hover:text-[#1C1C1E]'
              }`}
            >
              <Mail className="w-3.5 h-3.5" /> Gmail / Email
            </button>
          </div>

          {/* Signup form */}
          <form onSubmit={handleSendOtp} className="space-y-3.5">
            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold text-[#3A3A3C] mb-1">
                Driver Full Name
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#636366]" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  placeholder="Sanjay Soni"
                  className="w-full bg-white text-[#1C1C1E] font-bold placeholder:font-normal placeholder:text-[#8E8E93] text-sm rounded-xl py-2.5 pl-10 pr-4 border border-[#E5E5EA] focus:border-[#FFC000] focus:ring-2 focus:ring-[#FFC000]/20 transition-all duration-200 focus:outline-none"
                />
              </div>
            </div>

            {/* Mobile / Gmail Input */}
            <div>
              <label className="block text-xs font-bold text-[#3A3A3C] mb-1">
                {authMethod === 'mobile' ? 'Mobile Number' : 'Gmail / Email Address'}
              </label>
              <div className="relative">
                {authMethod === 'mobile' ? (
                  <>
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center text-[#3A3A3C] font-bold text-base border-r border-[#E5E5EA] pr-2.5 h-6">
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
                      className={`w-full bg-white text-[#1C1C1E] font-extrabold text-base sm:text-lg tracking-wide placeholder:font-normal placeholder:text-[#8E8E93] placeholder:tracking-normal rounded-xl py-2 pl-14 pr-3 border transition-all duration-200 focus:outline-none ${
                        error
                          ? 'border-[#FF3B30] focus:ring-2 focus:ring-[#FF3B30]/20'
                          : 'border-[#E5E5EA] focus:border-[#FFC000] focus:ring-2 focus:ring-[#FFC000]/20'
                      }`}
                    />
                  </>
                ) : (
                  <>
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-5 text-[#636366]" />
                    <input
                      type="email"
                      value={emailAddress}
                      onChange={(e) => {
                        setEmailAddress(e.target.value);
                        if (error) setError('');
                      }}
                      placeholder="driver@gmail.com"
                      className={`w-full bg-white text-[#1C1C1E] font-bold text-base tracking-wide placeholder:font-normal placeholder:text-[#8E8E93] placeholder:tracking-normal rounded-xl py-2 pl-10 pr-3 border transition-all duration-200 focus:outline-none ${
                        error
                          ? 'border-[#FF3B30] focus:ring-2 focus:ring-[#FF3B30]/20'
                          : 'border-[#E5E5EA] focus:border-[#FFC000] focus:ring-2 focus:ring-[#FFC000]/20'
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
                className="text-black transition-colors cursor-pointer"
              >
                {agreeTerms ? (
                  <CheckSquare className="w-4 h-4 text-black fill-[#FFC000]" />
                ) : (
                  <Square className="w-4 h-4 text-[#8E8E93]" />
                )}
              </button>
              <label className="text-[11px] text-[#636366] leading-tight select-none">
                I agree to the Driver Partner{' '}
                <a href="#terms" className="text-[#1C1C1E] font-bold underline">
                  Terms of Service
                </a>{' '}
                and{' '}
                <a href="#privacy" className="text-[#1C1C1E] font-bold underline">
                  Privacy Policy
                </a>
              </label>
            </div>

            {error && <p className="text-xs text-[#FF3B30] font-medium">{error}</p>}

            {/* Submit button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-[#FFC000] to-[#FF9F0A] hover:from-[#e6ad00] hover:to-[#e68f00] active:scale-[0.99] text-black font-extrabold text-sm rounded-xl shadow-lg shadow-[#FFC000]/30 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer"
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
          <p className="text-center text-xs text-[#636366] pt-1">
            Already registered as Captain?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-[#1C1C1E] font-bold hover:underline transition-colors cursor-pointer"
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
            console.log('Resending Driver Signup OTP to:', identifier);
          }}
        />
      )}
    </div>
  );
}
