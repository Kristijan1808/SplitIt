import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import "./ConfirmationModal.css";

type ConfirmationModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
};

export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  danger = false
}: ConfirmationModalProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCancel();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="confirmationModalBackdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        className="confirmationModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmation-modal-title"
        aria-describedby="confirmation-modal-message"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="confirmationModalClose"
          onClick={onCancel}
          aria-label="Close"
        >
          <X size={19} />
        </button>

        <div className={`confirmationModalIcon${danger ? " danger" : ""}`}>
          <AlertTriangle size={24} />
        </div>

        <h2 id="confirmation-modal-title">{title}</h2>
        <p id="confirmation-modal-message">{message}</p>

        <div className="confirmationModalActions">
          <button
            type="button"
            className="confirmationModalCancel"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirmationModalConfirm${danger ? " danger" : ""}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
