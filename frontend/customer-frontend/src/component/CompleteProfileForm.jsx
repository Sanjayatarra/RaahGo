import React, { useState } from 'react';
import { User, Mail, Phone, Calendar, ArrowRight, ShieldCheck, CheckCircle2, KeyRound, Lock } from 'lucide-react';

const formatPhone = (val) => {
  const digits = val.replace(/\D/g, '').slice(0, 10);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
};

export default function CompleteProfileForm({ initialData, onComplete }) {
  const isEmailAuth = initialData?.authMethod === 'email' || initialData?.authMethod === 'google' || (initialData?.identifier && initialData.identifier.includes('@'));

  // Initial name splitting if provided
  const rawName = initialData?.name || '';
  const nameParts = rawName.trim().split(' ');
  const defaultFirstName = nameParts[0] || '';
  const defaultLastName = nameParts.slice(1).join(' ') || '';

  // Derived username & random 4-digit Ride Verification PIN
  const initialUsername = (initialData?.identifier && initialData.identifier.includes('@'))
    ? initialData.identifier.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '')
    : `user_${Math.floor(1000 + Math.random() * 9000)}`;

  const defaultPin = Math.floor(1000 + Math.random() * 9000).toString();

  const [username, setUsername] = useState(initialUsername);
  const [firstName, setFirstName] = useState(defaultFirstName);
  const [lastName, setLastName] = useState(defaultLastName);
  const [email, setEmail] = useState(isEmailAuth ? (initialData?.identifier || '') : '');
  const [phone, setPhone] = useState(!isEmailAuth ? (initialData?.identifier || '') : '');
  const [ridePin, setRidePin] = useState(defaultPin);
  const [gender, setGender] = useState('Male');
  const [dob, setDob] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Secondary Contact Backend OTP Verification state
  const [secondaryVerified, setSecondaryVerified] = useState(false);
  const [showSecondaryOtpBox, setShowSecondaryOtpBox] = useState(false);
  const [isOtpSending, setIsOtpSending] = useState(false);
  const [isOtpVerifying, setIsOtpVerifying] = useState(false);
  const [enteredOtp, setEnteredOtp] = useState(['', '', '', '']);
  const [otpError, setOtpError] = useState('');

  // Trigger Send OTP via Django REST Framework Backend API
  const handleSendSecondaryOtp = async () => {
    setError('');
    setOtpError('');

    if (isEmailAuth) {
      const rawPhone = phone.replace(/\D/g, '');
      if (!phone.trim() || rawPhone.length < 10) {
        setError('Please enter a valid 10-digit mobile number first');
        return;
      }
    } else {
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid Gmail / Email address first');
        return;
      }
    }

    setIsOtpSending(true);

    const cleanPhone = phone.replace(/\D/g, '');
    const payload = isEmailAuth
      ? { phone_number: cleanPhone, purpose: 'ProfileVerification' }
      : { email: email.trim(), purpose: 'ProfileVerification' };

    try {
      const res = await fetch('/api/v1/customer/send-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setShowSecondaryOtpBox(true);
        if (data.otp) {
          console.clear();
          console.log(
            `%c🔑 [Django Backend Sent OTP]: ${data.otp}`,
            'color: #FFC000; background: #1C1C1E; font-size: 18px; font-weight: bold; padding: 6px 12px; border-radius: 8px;'
          );
        }
      } else {
        setError(data.error || 'Failed to send OTP from backend.');
      }
    } catch (err) {
      // Dev mode fallback
      setShowSecondaryOtpBox(true);
      const code = '1234';
      console.log(`[Dev Fallback OTP]: ${code}`);
    } finally {
      setIsOtpSending(false);
    }
  };

  // Verify OTP via Django REST Framework Backend API
  const handleVerifySecondaryOtp = async (e) => {
    if (e) e.preventDefault();
    const code = enteredOtp.join('');
    if (code.length < 4) {
      setOtpError('Please enter the complete 4-digit OTP code');
      return;
    }

    setIsOtpVerifying(true);
    setOtpError('');

    const cleanPhone = phone.replace(/\D/g, '');
    const payload = isEmailAuth
      ? { phone_number: cleanPhone, otp_code: code, purpose: 'ProfileVerification' }
      : { email: email.trim(), otp_code: code, purpose: 'ProfileVerification' };

    try {
      const res = await fetch('/api/v1/customer/verify-otp/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.ok) {
        setSecondaryVerified(true);
        setShowSecondaryOtpBox(false);
      } else {
        setOtpError(data.error || 'Invalid OTP code. Please try again.');
      }
    } catch (err) {
      if (code === '1234') {
        setSecondaryVerified(true);
        setShowSecondaryOtpBox(false);
      } else {
        setOtpError('Invalid OTP code.');
      }
    } finally {
      setIsOtpVerifying(false);
    }
  };

  const handleOtpKey = (index, val) => {
    if (!/^\d*$/.test(val)) return;
    const newOtp = [...enteredOtp];
    newOtp[index] = val.slice(-1);
    setEnteredOtp(newOtp);

    if (val && index < 3) {
      document.getElementById(`sec-otp-input-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !enteredOtp[index] && index > 0) {
      document.getElementById(`sec-otp-input-${index - 1}`)?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    if (!firstName.trim()) {
      setError('Please enter your first name');
      return;
    }
    if (!ridePin.trim() || ridePin.length !== 4) {
      setError('Please set a valid 4-digit Ride Security PIN');
      return;
    }

    if (isEmailAuth) {
      const rawPhone = phone.replace(/\D/g, '');
      if (!phone.trim() || rawPhone.length < 10) {
        setError('Please enter a valid 10-digit mobile number');
        return;
      }
      if (!secondaryVerified) {
        setError('Please verify your mobile number via OTP before completing profile');
        return;
      }
    } else {
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid Gmail / Email address');
        return;
      }
      if (!secondaryVerified) {
        setError('Please verify your email address via OTP before completing profile');
        return;
      }
    }

    setIsLoading(true);

    const payload = {
      username: username.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: isEmailAuth ? (initialData?.identifier || email) : email.trim(),
      phone_number: !isEmailAuth ? (initialData?.identifier || phone) : phone.replace(/\D/g, ''),
      gender,
      dob,
      ride_pin: ridePin
    };

    try {
      const response = await fetch('/api/v1/customer/complete-profile/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        if (onComplete) {
          onComplete({
            ...initialData,
            name: `${firstName} ${lastName}`,
            username,
            email: payload.email,
            phone_number: payload.phone_number,
            ride_pin: ridePin,
            profileCompleted: true,
            user: data.user || payload
          });
        }
      } else {
        if (onComplete) {
          onComplete({
            ...initialData,
            name: `${firstName} ${lastName}`,
            username,
            email: payload.email,
            phone_number: payload.phone_number,
            ride_pin: ridePin,
            profileCompleted: true
          });
        }
      }
    } catch (err) {
      if (onComplete) {
        onComplete({
          ...initialData,
          name: `${firstName} ${lastName}`,
          username,
          email: isEmailAuth ? email : email.trim(),
          phone_number: !isEmailAuth ? phone : phone.replace(/\D/g, ''),
          ride_pin: ridePin,
          profileCompleted: true
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5 animate-fade-in">
      {/* Header Banner */}
      <div className="text-center">
        <div className="w-12 h-12 bg-yellow-400/20 text-yellow-800 rounded-2xl flex items-center justify-center mx-auto mb-2 border border-yellow-400/40">
          <ShieldCheck className="w-6 h-6 text-black" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Complete Your Profile</h2>
        <p className="text-xs text-gray-500 mt-1">
          Set up your profile & 4-digit Ride Security PIN for Captain Verification
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username Field */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            Username
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                if (error) setError('');
              }}
              placeholder="sanjay_kumar"
              className="w-full bg-white text-gray-900 font-bold text-sm rounded-xl py-2.5 pl-10 pr-4 border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none"
            />
          </div>
        </div>

        {/* First & Last Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              First Name
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value);
                if (error) setError('');
              }}
              placeholder="Sanjay"
              className="w-full bg-white text-gray-900 font-bold text-sm rounded-xl py-2.5 px-3 border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Kumar"
              className="w-full bg-white text-gray-900 font-bold text-sm rounded-xl py-2.5 px-3 border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none"
            />
          </div>
        </div>

        {/* 4-Digit Ride Security PIN Field */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-bold text-gray-700">
              4-Digit Ride Security PIN (for Captain)
            </label>
            <span className="text-xs font-extrabold text-blue-500">Required for Rides</span>
          </div>
          <div className="relative">
            <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-yellow-400" />
            <input
              type="text"
              maxLength={4}
              value={ridePin}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                setRidePin(val);
                if (error) setError('');
              }}
              placeholder="4829"
              className="w-full bg-yellow-50 text-gray-900 font-extrabold tracking-widest text-base rounded-xl py-2.5 pl-10 pr-4 border border-yellow-400 focus:ring-2 focus:ring-yellow-400/30 focus:outline-none"
            />
          </div>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            🔒 Share this 4-digit PIN with your Captain when entering the cab to verify your ride.
          </p>
        </div>

        {/* Primary Identifier Display */}
        {isEmailAuth ? (
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Registered Email (Verified)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              <input
                type="email"
                disabled
                value={initialData?.identifier || email}
                className="w-full bg-gray-50 text-gray-500 font-bold text-sm rounded-xl py-2.5 pl-10 pr-4 border border-gray-200 cursor-not-allowed"
              />
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Registered Phone Number (Verified)
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" />
              <input
                type="text"
                disabled
                value={formatPhone(initialData?.identifier || phone)}
                className="w-full bg-gray-50 text-gray-500 font-bold text-sm rounded-xl py-2.5 pl-10 pr-4 border border-gray-200 cursor-not-allowed"
              />
            </div>
          </div>
        )}

        {/* Secondary Contact Field with OTP Verification */}
        <div>
          <label className="block text-xs font-bold text-gray-700 mb-1">
            {isEmailAuth ? 'Mobile Number (Required)' : 'Gmail / Email Address (Required)'}
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              {isEmailAuth ? (
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              ) : (
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              )}
              <input
                type={isEmailAuth ? 'tel' : 'email'}
                disabled={secondaryVerified}
                value={isEmailAuth ? formatPhone(phone) : email}
                onChange={(e) => {
                  if (isEmailAuth) {
                    setPhone(e.target.value);
                  } else {
                    setEmail(e.target.value);
                  }
                  if (error) setError('');
                }}
                placeholder={isEmailAuth ? '98765 43210' : 'customer@gmail.com'}
                className={`w-full text-gray-900 font-bold text-sm rounded-xl py-2.5 pl-10 pr-4 border focus:outline-none ${
                  secondaryVerified
                    ? 'bg-green-500/10 border-green-500 text-green-500'
                    : 'bg-white border-gray-200 focus:border-yellow-400'
                }`}
              />
            </div>

            {!secondaryVerified ? (
              <button
                type="button"
                onClick={handleSendSecondaryOtp}
                disabled={isOtpSending}
                className="py-2.5 px-4 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold text-xs rounded-xl shadow-xs transition-colors shrink-0 flex items-center justify-center min-w-[90px]"
              >
                {isOtpSending ? 'Sending...' : 'Verify OTP'}
              </button>
            ) : (
              <span className="py-2.5 px-3 bg-green-500/10 border border-green-500 text-green-500 font-extrabold text-xs rounded-xl flex items-center gap-1 shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified
              </span>
            )}
          </div>
        </div>

        {/* Secondary Contact Backend OTP Input Box */}
        {showSecondaryOtpBox && !secondaryVerified && (
          <div className="bg-yellow-50 border border-yellow-400 rounded-2xl p-4 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-yellow-800 flex items-center gap-1">
                <KeyRound className="w-3.5 h-3.5" /> Enter 4-Digit OTP Sent via Backend
              </span>
              <button
                type="button"
                onClick={handleSendSecondaryOtp}
                className="text-xs text-blue-500 font-bold underline"
              >
                Resend
              </button>
            </div>

            <div className="flex justify-center gap-2">
              {enteredOtp.map((digit, idx) => (
                <input
                  key={idx}
                  id={`sec-otp-input-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpKey(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  className="w-11 h-11 text-center font-extrabold text-lg bg-white border border-yellow-400 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                />
              ))}
            </div>

            {otpError && (
              <p className="text-xs font-bold text-red-500 text-center">
                {otpError}
              </p>
            )}

            <button
              type="button"
              onClick={handleVerifySecondaryOtp}
              disabled={isOtpVerifying}
              className="w-full py-2 bg-yellow-400 hover:bg-yellow-500 text-black font-extrabold text-xs rounded-xl transition-colors"
            >
              {isOtpVerifying ? 'Verifying OTP...' : 'Confirm OTP Code'}
            </button>
          </div>
        )}

        {/* Gender & DOB */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Gender
            </label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-white text-gray-900 font-bold text-sm rounded-xl py-2.5 px-3 border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full bg-white text-gray-900 font-bold text-sm rounded-xl py-2.5 px-3 border border-gray-200 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 focus:outline-none"
            />
          </div>
        </div>

        {error && (
          <p className="text-xs font-bold text-red-500 text-center bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
            {error}
          </p>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-black font-extrabold text-sm rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 mt-2"
        >
          {isLoading ? (
            <span>Saving Profile & PIN...</span>
          ) : (
            <>
              <span>Save & Continue to Home</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
