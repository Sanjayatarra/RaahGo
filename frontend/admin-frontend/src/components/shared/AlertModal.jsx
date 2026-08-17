import React from 'react';
import { AlertCircle, CheckCircle, AlertTriangle, Info, X } from 'lucide-react';
import Modal from './Modal';

/**
 * Reusable Alert / Confirm / Prompt Modal for Admin Frontend
 */
export default function AlertModal({
  isOpen,
  onClose,
  title = 'Notice',
  message = '',
  type = 'info', // 'info' | 'success' | 'warning' | 'error'
  confirmText = 'OK',
  cancelText,
  onConfirm,
}) {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle size={22} color="var(--status-active)" />;
      case 'warning':
        return <AlertTriangle size={22} color="var(--accent-yellow)" />;
      case 'error':
        return <AlertCircle size={22} color="var(--accent-pink)" />;
      case 'info':
      default:
        return <Info size={22} color="var(--accent-primary)" />;
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {getIcon()}
          <span>{title}</span>
        </div>
      }
      onClose={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
          {cancelText && (
            <button className="btn btn-secondary btn-sm" onClick={onClose}>
              {cancelText}
            </button>
          )}
          <button
            className={`btn btn-sm ${
              type === 'error' ? 'btn-danger' : type === 'warning' ? 'btn-warning' : 'btn-primary'
            }`}
            onClick={() => {
              if (onConfirm) onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6, padding: '8px 0' }}>
        {message}
      </div>
    </Modal>
  );
}
