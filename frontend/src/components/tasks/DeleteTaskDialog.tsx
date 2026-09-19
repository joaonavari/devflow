import { captureDialogOpener, restoreDialogFocus } from '../ui/dialog-focus';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface DeleteTaskDialogProps {
  taskTitle: string | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTaskDialog({
  taskTitle,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteTaskDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = captureDialogOpener(dialog);
    if (!dialog) return;
    if (taskTitle && !dialog.open) dialog.showModal();
    if (!taskTitle && dialog.open) dialog.close();
    return () => {
      restoreDialogFocus(opener, dialog);
    };
  }, [taskTitle]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="delete-task-title"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <div className="confirm-dialog-icon" aria-hidden="true">
        <AlertTriangle size={21} />
      </div>
      <h2 id="delete-task-title">Excluir tarefa?</h2>
      <p>
        <strong>{taskTitle}</strong> será removida permanentemente. Esta ação não pode ser desfeita.
      </p>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="dialog-actions">
        <button className="secondary-button" type="button" disabled={pending} onClick={onClose}>
          Cancelar
        </button>
        <button
          className="danger-button"
          type="button"
          data-task-action="confirm-delete"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? 'Excluindo…' : 'Excluir permanentemente'}
        </button>
      </div>
    </dialog>
  );
}
