import { useEffect } from 'react';
import './Modal.css';

// Themed replacement for window.prompt/confirm/alert. Closes on Escape or an
// overlay click (via onClose).
export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({ title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, onConfirm, onCancel }) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="modal-actions">
        <button onClick={onCancel}>{cancelLabel}</button>
        <button
          className={danger ? 'btn-delete' : 'btn-primary'}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function Toast({ message, kind = 'success', onDismiss }) {
  if (!message) return null;
  return (
    <div className={`toast toast-${kind}`} role="status">
      <span>{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss">x</button>
    </div>
  );
}
