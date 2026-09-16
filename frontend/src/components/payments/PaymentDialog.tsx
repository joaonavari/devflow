import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../auth/auth-context';
import {
  createPayment,
  PaymentApiError,
  paymentKeys,
  type Payment,
  updatePayment,
} from '../../payments/payment-api';
import { amountForInput } from '../../payments/payment-format';
import { paymentFormSchema, type PaymentFormInput } from '../../payments/payment-schemas';
import type { Project } from '../../projects/project-api';
import { FormField } from '../auth/FormField';
import { IconButton } from '../ui/IconButton';

interface PaymentDialogProps {
  projects: readonly Pick<Project, 'id' | 'name'>[];
  fixedProject?: Pick<Project, 'id' | 'name'>;
  payment?: Payment | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function valuesFrom(projectId: string, payment?: Payment | null): PaymentFormInput {
  return {
    projectId: payment?.projectId ?? projectId,
    description: payment?.description ?? '',
    amount: payment ? amountForInput(payment.amount) : '',
    dueDate: payment?.dueDate ?? '',
  };
}

export function PaymentDialog({
  projects,
  fixedProject,
  payment,
  onClose,
  onSaved,
}: PaymentDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const projectId = payment?.projectId ?? fixedProject?.id ?? projects[0]?.id ?? '';
  const projectSelectId = useId();
  const form = useForm<PaymentFormInput>({
    resolver: zodResolver(paymentFormSchema),
    defaultValues: valuesFrom(projectId, payment),
  });
  const mutation = useMutation({
    mutationFn: (input: PaymentFormInput) =>
      payment ? updatePayment(payment.id, input) : createPayment(input),
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) {
      dialog?.showModal();
      dialog?.querySelector<HTMLElement>('[name="description"]')?.focus();
    }
  }, []);

  function close() {
    if (mutation.isPending) return;
    mutation.reset();
    onClose();
  }

  async function submit(input: PaymentFormInput) {
    try {
      await mutation.mutateAsync(input);
      if (user) await queryClient.invalidateQueries({ queryKey: paymentKeys.all(user.id) });
      onSaved(payment ? 'Cobrança atualizada.' : 'Cobrança criada com sucesso.');
      onClose();
    } catch (error) {
      if (error instanceof PaymentApiError) {
        for (const field of error.fields) {
          if (field.field in form.getValues())
            form.setError(field.field as keyof PaymentFormInput, { message: field.message });
        }
        form.setError('root', { message: error.message });
      } else form.setError('root', { message: 'Não foi possível salvar a cobrança.' });
    }
  }

  const selectedProject = payment?.project ?? fixedProject;
  return (
    <dialog
      ref={dialogRef}
      className="payment-dialog"
      aria-labelledby="payment-dialog-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="navigation-label">{payment ? 'Editar cobrança' : 'Nova cobrança'}</p>
          <h2 id="payment-dialog-title">
            {payment ? 'Ajustar cobrança' : 'Registrar valor previsto'}
          </h2>
          <p>O valor será apresentado em BRL nesta versão.</p>
        </div>
        <IconButton label="Fechar cobrança" onClick={close} disabled={mutation.isPending}>
          <X size={19} strokeWidth={1.7} aria-hidden="true" />
        </IconButton>
      </div>
      <form
        className="payment-form"
        noValidate
        aria-busy={mutation.isPending}
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
      >
        {selectedProject ? (
          <div className="payment-fixed-project">
            <span>Projeto</span>
            <strong>{selectedProject.name}</strong>
            <input type="hidden" {...form.register('projectId')} />
          </div>
        ) : (
          <div className="form-field">
            <label htmlFor={projectSelectId}>Projeto</label>
            <select id={projectSelectId} {...form.register('projectId')}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
            {form.formState.errors.projectId && (
              <p className="field-error">{form.formState.errors.projectId.message}</p>
            )}
          </div>
        )}
        <FormField
          label="Descrição"
          required
          maxLength={300}
          placeholder="Ex.: Entrada do projeto"
          {...form.register('description')}
          error={form.formState.errors.description?.message}
        />
        <FormField
          label="Valor"
          required
          inputMode="decimal"
          placeholder="Ex.: 2500,50"
          {...form.register('amount')}
          error={form.formState.errors.amount?.message}
        />
        <FormField
          label="Vencimento"
          type="date"
          required
          {...form.register('dueDate')}
          error={form.formState.errors.dueDate?.message}
        />
        {form.formState.errors.root && (
          <p className="form-error" role="alert">
            {form.formState.errors.root.message}
          </p>
        )}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={close}>
            Cancelar
          </button>
          <button
            className="primary-button"
            type="submit"
            data-payment-action="save"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando…' : payment ? 'Salvar alterações' : 'Criar cobrança'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
