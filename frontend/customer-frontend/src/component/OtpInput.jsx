import React, { useState, useRef, useEffect } from 'react';
import { RefreshCw, CheckCircle, ArrowLeft } from 'lucide-react';

export default function OtpInput({ identifier, type, onVerify, onBack, onResend, externalError }) {
  const [otp, setOtp] = useState(['', '', '', '']);
  const [timer, setTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    inputRefs[0].current?.focus();

    const countdown = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          clearInterval(countdown);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdown);
  }, []);

  useEffect(() => {
    if (externalError) {
      setError(externalError);
      setIsLoading(false);
      setIsSuccess(false);
    }
  }, [externalError]);

  const handleChange = (index, value) => {
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    setError('');

    if (value && index < 3) {
      inputRefs[index + 1].current?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs[index - 1].current?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim().slice(0, 4);
    if (/^\d+$/.test(pastedData)) {
      const digits = pastedData.split('');
      const newOtp = [...otp];
      digits.forEach((digit, i) => {
        if (i < 4) newOtp[i] = digit;
      });
      setOtp(newOtp);
      inputRefs[Math.min(digits.length, 3)].current?.focus();
    }
  };

  const handleResendOtp = () => {
    if (!canResend) return;
    setTimer(30);
    setCanResend(false);
    setOtp(['', '', '', '']);
    setError('');
    setIsSuccess(false);
    inputRefs[0].current?.focus();
    if (onResend) onResend();
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length < 4) {
      setError('Please enter the complete 4-digit OTP');
      return;
    }

    setIsLoading(true);
    setError('');
    setIsSuccess(true);

    setTimeout(() => {
      if (onVerify) {
        onVerify(fullOtp);
      }
    }, 400);
  };

  return (
    <div className="w-full space-y-5 animate-fade-in">
      <button
        onClick={onBack}
        type="button"
        className="inline-flex items-center text-xs font-semibold text-gray-500 hover:text-gray-900 transition-colors gap-1.5"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Change {type === 'email' ? 'Email' : 'Mobile Number'}
      </button>

      <div className="text-center">
        <h3 className="text-xl font-bold text-gray-900 mb-1">Enter Verification Code</h3>
        <p className="text-xs text-gray-500">
          We sent a 4-digit OTP to <span className="font-bold text-gray-900">{identifier}</span>
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="flex justify-center gap-3" onPaste={handlePaste}>
          {otp.map((digit, index) => (
            <input
              key={index}
              ref={inputRefs[index]}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              className={`w-12 h-14 text-center text-xl font-bold rounded-xl bg-white border transition-all duration-200 focus:outline-none ${
                error
                  ? 'border-red-500 text-red-500 focus:ring-2 focus:ring-red-500/20'
                  : digit
                  ? 'border-yellow-400 text-gray-900 shadow-sm ring-2 ring-yellow-400/30'
                  : 'border-gray-200 text-gray-900 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20'
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-500 text-center font-medium bg-red-500/10 py-2 px-3 rounded-lg border border-red-500/20">
            {error}
          </p>
        )}

        {isSuccess && !error && (
          <div className="flex items-center justify-center gap-2 text-xs font-bold text-black bg-yellow-400 py-2.5 px-3 rounded-xl shadow-md shadow-yellow-400/20">
            <CheckCircle className="w-4 h-4 text-black animate-bounce" /> OTP Verified Successfully!
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3.5 px-4 bg-yellow-400 hover:bg-yellow-500 active:scale-95 text-black font-bold text-sm rounded-xl shadow-lg shadow-yellow-400/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
              <span>Verifying OTP...</span>
            </>
          ) : (
            <span>Verify & Continue</span>
          )}
        </button>

        <div className="text-center pt-2">
          {canResend ? (
            <button
              type="button"
              onClick={handleResendOtp}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 hover:underline transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5 text-yellow-400" /> Resend OTP Code
            </button>
          ) : (
            <p className="text-xs text-gray-500">
              Didn't receive the code? Resend in{' '}
              <span className="font-bold text-gray-900">{timer}s</span>
            </p>
          )}
        </div>
      </form>
    </div>
  );
}
