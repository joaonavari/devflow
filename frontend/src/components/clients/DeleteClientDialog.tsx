import { captureDialogOpener, restoreDialogFocus, isDialogBackdropClick } from '../ui/dialog-focus';
import { useEffect, useRef } from 'react';

interface DeleteClientDialogProps {
  open: boolean;
  clientName: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteClientDialog({
  open,
  clientName,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteClientDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = captureDialogOpener(dialog);
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    return () => {
      restoreDialogFocus(opener, dialog);
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirmation-dialog"
      aria-labelledby="delete-client-title"
      aria-describedby="delete-client-description"
      onClose={() => {
        if (!pending) onClose();
      }}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      onClick={(event) => {
        if (isDialogBackdropClick(event) && !pending) onClose();
      }}
    >
      <p className="navigation-label">Ação permanente</p>
      <h2 id="delete-client-title">Excluir {clientName}?</h2>
      <p id="delete-client-description">
        Todos os dados deste cliente serão removidos definitivamente. Esta ação não pode ser
        desfeita.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          type="button"
          className="secondary-button"
          onClick={onClose}
          disabled={pending}
          autoFocus
        >
          Cancelar
        </button>
        <button
          type="button"
          className="danger-button"
          data-client-action="confirm-delete"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? 'Excluindo…' : 'Excluir permanentemente'}
        </button>
      </div>
    </dialog>
  );
}
