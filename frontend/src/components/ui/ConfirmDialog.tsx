import { useEffect, useId, useRef } from 'react';
import { captureDialogOpener, restoreDialogFocus } from './dialog-focus';

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const opener = captureDialogOpener(dialog);
    dialog?.showModal();
    dialog?.querySelector('button')?.focus();
    return () => {
      restoreDialogFocus(opener, dialog);
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirmation-dialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <h2 id={`${id}-title`}>{title}</h2>
      <p id={`${id}-description`}>{description}</p>
      <div className="dialog-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Cancelar
        </button>
        <button type="button" className="danger-button" data-confirm-action onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
