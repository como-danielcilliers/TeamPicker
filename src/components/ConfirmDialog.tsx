import { useEffect, useId, useRef } from 'react';

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  /** Optional middle button for three-way choices. */
  secondary?: { label: string; onClick: () => void };
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  danger = false,
  secondary,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onCancel();
      }}
    >
      <form
        method="dialog"
        className="dialog-body"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <h2 id={titleId} className="dialog-title">
          {title}
        </h2>
        <p id={messageId} className="dialog-message">
          {message}
        </p>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {cancelLabel}
          </button>
          {secondary && (
            <button type="button" className="btn btn-secondary" onClick={secondary.onClick}>
              {secondary.label}
            </button>
          )}
          <button
            type="submit"
            className={danger ? 'btn btn-danger' : 'btn btn-primary'}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
