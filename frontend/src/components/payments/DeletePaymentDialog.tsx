import { AlertTriangle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { Payment } from '../../payments/payment-api';
import { formatMoney } from '../../payments/payment-format';

interface DeletePaymentDialogProps {
  payment: Payment | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeletePaymentDialog({
  payment,
  pending,
  error,
  onClose,
  onConfirm,
}: DeletePaymentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (payment && !dialog.open) dialog.showModal();
    if (!payment && dialog.open) dialog.close();
  }, [payment]);
  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="delete-payment-title"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
    >
      <div className="confirm-dialog-icon" aria-hidden="true">
        <AlertTriangle size={21} />
      </div>
      <h2 id="delete-payment-title">Excluir cobrança?</h2>
      <p>
        <strong>{payment?.description}</strong>, no valor de{' '}
        {formatMoney(payment?.amount ?? '0.00')}, será removida permanentemente.
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
          data-payment-action="confirm-delete"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? 'Excluindo…' : 'Excluir permanentemente'}
        </button>
      </div>
    </dialog>
  );
}
