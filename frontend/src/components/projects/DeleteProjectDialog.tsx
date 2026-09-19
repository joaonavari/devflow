import { captureDialogOpener, restoreDialogFocus, isDialogBackdropClick } from '../ui/dialog-focus';
import { useEffect, useRef } from 'react';

interface DeleteProjectDialogProps {
  open: boolean;
  projectName: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteProjectDialog({
  open,
  projectName,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteProjectDialogProps) {
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
      aria-labelledby="delete-project-title"
      aria-describedby="delete-project-description"
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
      <h2 id="delete-project-title">Excluir {projectName}?</h2>
      <p id="delete-project-description">
        Os dados deste projeto serão removidos definitivamente. Esta ação não pode ser desfeita.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={onClose}
          disabled={pending}
          autoFocus
        >
          Cancelar
        </button>
        <button
          className="danger-button"
          type="button"
          data-project-action="confirm-delete"
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? 'Excluindo…' : 'Excluir permanentemente'}
        </button>
      </div>
    </dialog>
  );
}
