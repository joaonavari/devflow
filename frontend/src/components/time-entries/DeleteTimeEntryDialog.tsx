import { captureDialogOpener, restoreDialogFocus } from '../ui/dialog-focus';
import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { formatDuration } from '../../time-entries/time-entry-format';
import type { TimeEntry } from '../../time-entries/time-entry-api';

interface DeleteTimeEntryDialogProps {
  entry: TimeEntry | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteTimeEntryDialog({
  entry,
  pending,
  error,
  onClose,
  onConfirm,
}: DeleteTimeEntryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = captureDialogOpener(dialog);
    if (!dialog) return;
    if (entry && !dialog.open) dialog.showModal();
    if (!entry && dialog.open) dialog.close();
    return () => {
      restoreDialogFocus(opener, dialog);
    };
  }, [entry]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="delete-time-entry-title"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <div className="confirm-dialog-icon" aria-hidden="true">
        <AlertTriangle size={21} />
      </div>
      <h2 id="delete-time-entry-title">Excluir registro de horas?</h2>
      <p>
        O registro de <strong>{formatDuration(entry?.durationMinutes ?? 0)}</strong> será removido
        permanentemente. Esta ação não pode ser desfeita.
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
          data-time-action="confirm-delete"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? 'Excluindo…' : 'Excluir permanentemente'}
        </button>
      </div>
    </dialog>
  );
}
