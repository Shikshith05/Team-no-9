// An in-page confirmation dialog (B23), used instead of window.confirm so it
// matches the app's styling and can show a server error. Focus moves to the
// safe choice (Cancel) when it opens, stays inside it, Escape cancels, and focus
// goes back to the button that opened it when it closes.
import { useEffect, useId, useRef } from 'react';

export default function ConfirmDialog({ title, children, confirmLabel, busyLabel, busy = false, error, onConfirm, onCancel }) {
  const titleId = useId();
  const textId = useId();
  const dialogRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    cancelRef.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  function handleKeyDown(event) {
    if (event.key === 'Escape' && !busy) {
      event.stopPropagation();
      onCancel();
      return;
    }
    if (event.key !== 'Tab') return;
    const buttons = [...dialogRef.current.querySelectorAll('button:not([disabled])')];
    if (buttons.length === 0) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="dialog-backdrop" onKeyDown={handleKeyDown}>
      <div
        ref={dialogRef}
        className="card dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        data-testid="confirm-dialog"
      >
        <h2 id={titleId} className="notice-title">
          {title}
        </h2>
        <div id={textId} className="muted">
          {children}
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button type="button" className="button button-danger" onClick={onConfirm} disabled={busy}>
            {busy ? busyLabel : confirmLabel}
          </button>
          <button ref={cancelRef} type="button" className="button button-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
