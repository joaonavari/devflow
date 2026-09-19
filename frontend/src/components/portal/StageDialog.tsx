import { useSubmitOnce } from '../ui/useSubmitOnce';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { X } from 'lucide-react';
import {
  saveStage,
  stageFormSchema,
  stageLabels,
  portalErrorMessage,
  stageStatusSchema,
  type Stage,
  type StageInput,
} from '../../portal/portal-api';
import { FormField } from '../auth/FormField';
import { IconButton } from '../ui/IconButton';

export function StageDialog({
  projectId,
  stage,
  onClose,
  onSaved,
}: {
  projectId: string;
  stage: Stage | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<StageInput>({
    resolver: zodResolver(stageFormSchema),
    defaultValues: stage ?? { title: '', status: 'PENDING', isClientVisible: false },
  });
  const mutation = useMutation({
    mutationFn: (input: StageInput) => saveStage(projectId, input, stage?.id),
  });
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    dialog?.querySelector('input')?.focus();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);
  const submit = useSubmitOnce(async (input: StageInput) => {
    try {
      await mutation.mutateAsync(input);
      await onSaved();
      onClose();
    } catch {
      /* Mutation displays the error. */
    }
  });
  return (
    <dialog
      ref={ref}
      className="task-dialog"
      aria-labelledby={`${id}-title`}
      onCancel={(e) => {
        e.preventDefault();
        if (!mutation.isPending) onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="navigation-label">Timeline do projeto</p>
          <h2 id={`${id}-title`}>{stage ? 'Editar etapa' : 'Adicionar etapa'}</h2>
          <p>Mostre ao cliente os marcos que você escolher.</p>
        </div>
        <IconButton label="Fechar etapa" disabled={mutation.isPending} onClick={onClose}>
          <X size={19} aria-hidden="true" />
        </IconButton>
      </div>
      <form className="task-form" noValidate onSubmit={(e) => void handleSubmit(submit)(e)}>
        <FormField
          label="Título da etapa"
          maxLength={160}
          required
          {...register('title')}
          error={errors.title?.message}
        />
        <div className="form-field">
          <label htmlFor={`${id}-status`}>Status da etapa</label>
          <select id={`${id}-status`} {...register('status')}>
            {stageStatusSchema.options.map((status) => (
              <option key={status} value={status}>
                {stageLabels[status]}
              </option>
            ))}
          </select>
        </div>
        <label className="task-visibility">
          <input type="checkbox" {...register('isClientVisible')} />
          <span>
            <strong>Visível para o cliente</strong>
            <small>Exibe o título e o status no portal.</small>
          </span>
        </label>
        {mutation.isError && (
          <p role="alert" className="form-error">
            {portalErrorMessage(mutation.error)}
          </p>
        )}
        <div className="dialog-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            className="primary-button"
            type="submit"
            data-stage-action="save"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando…' : 'Salvar etapa'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
