import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** A native modal <dialog>: focus trapping, Escape and the backdrop come free. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      onCancel={(e) => {
        // Escape: let our state own the closing rather than the browser.
        e.preventDefault();
        onCancel();
      }}
      onClick={(e) => {
        // A click on the backdrop lands on the dialog element itself.
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <h2 id="confirm-title">{title}</h2>
      <p id="confirm-message">{message}</p>
      <div className="confirm__actions">
        <button type="button" className="btn-text" onClick={onCancel} autoFocus>
          Cancel
        </button>
        <button type="button" className="btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
