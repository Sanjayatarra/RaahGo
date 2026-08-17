import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X, FileText, ArrowRight } from 'lucide-react';

/**
 * Common Alert Modal for Driver App
 * Replaces ugly browser window.alert() with a premium, accessible modal.
 */
export default function AlertModal({
  isOpen,
  onClose,
  title = 'Notice',
  message = '',
  type = 'error', // 'error' | 'warning' | 'success' | 'info'
  actionText,
  onAction,
  closeText,
}) {
  if (!isOpen) return null;

  const isKycError = typeof message === 'string' && (message.toLowerCase().includes('kyc') || message.toLowerCase().includes('document'));

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-8 h-8 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="w-8 h-8 text-amber-500" />;
      case 'info':
        return <Info className="w-8 h-8 text-blue-500" />;
      case 'error':
      default:
        return <AlertCircle className="w-8 h-8 text-red-500" />;
    }
  };

  const getHeaderBg = () => {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-900 border-emerald-100';
      case 'warning':
        return 'bg-amber-50 text-amber-900 border-amber-100';
      case 'info':
        return 'bg-blue-50 text-blue-900 border-blue-100';
      case 'error':
      default:
        return 'bg-red-50 text-red-900 border-red-100';
    }
  };

  const buttonText = closeText || (actionText ? 'Cancel' : 'OK');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className={`p-5 flex items-start gap-3.5 border-b ${getHeaderBg()}`}>
          <div className="p-2 rounded-xl bg-white shadow-xs shrink-0">
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0 pr-2">
            <h3 className="text-base sm:text-lg font-bold tracking-tight text-gray-900">
              {title}
            </h3>
            <p className="text-xs text-gray-600 mt-0.5">
              RaahGo Driver Operations Notice
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-black/5 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          <p className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
            {message}
          </p>

          {isKycError && (
            <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl flex items-start gap-2.5 text-xs text-amber-900">
              <FileText className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Action Required:</strong> Please verify that your Driving License, RC, Vehicle Insurance, and profile details are approved by Admin.
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row-reverse gap-2 sm:gap-3">
          {actionText && onAction ? (
            <button
              type="button"
              onClick={() => {
                onAction();
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors shadow-xs flex items-center justify-center gap-2"
            >
              <span>{actionText}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            className={`w-full ${actionText ? 'sm:w-auto' : 'sm:w-full'} px-5 py-2.5 text-sm font-bold rounded-xl transition-all ${
              actionText
                ? 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-100'
                : 'bg-[#FFC000] text-black hover:bg-[#E5AC00] shadow-xs active:scale-[0.99]'
            }`}
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
