import { captureDialogOpener, restoreDialogFocus, isDialogBackdropClick } from '../ui/dialog-focus';
import { useSubmitOnce } from '../ui/useSubmitOnce';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useAuth } from '../../auth/auth-context';
import type { Client } from '../../clients/client-api';
import { createProject, ProjectApiError, projectKeys } from '../../projects/project-api';
import { projectFormSchema, type ProjectFormInput } from '../../projects/project-schemas';
import { IconButton } from '../ui/IconButton';
import { ProjectFormFields } from './ProjectFormFields';

interface ProjectCreateDialogProps {
  open: boolean;
  clients: Pick<Client, 'id' | 'name' | 'archivedAt'>[];
  onClose: () => void;
  onCreated: (name: string) => void;
}

const defaults: ProjectFormInput = {
  clientId: '',
  name: '',
  description: '',
  status: 'PLANNING',
  startDate: '',
  dueDate: '',
  budget: '0.00',
  progress: 0,
  progressMode: 'MANUAL',
};

export function ProjectCreateDialog({
  open,
  clients,
  onClose,
  onCreated,
}: ProjectCreateDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    control,
    formState: { errors },
  } = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: defaults,
  });
  const mutation = useMutation({ mutationFn: createProject });
  const progressMode = useWatch({ control, name: 'progressMode' });

  useEffect(() => {
    const dialog = dialogRef.current;
    const opener = captureDialogOpener(dialog);
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[name="name"]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
    return () => {
      restoreDialogFocus(opener, dialog);
    };
  }, [open]);

  function close() {
    if (mutation.isPending) return;
    mutation.reset();
    reset(defaults);
    onClose();
  }

  const submit = useSubmitOnce(async (input: ProjectFormInput) => {
    try {
      const created = await mutation.mutateAsync(input);
      if (user) await queryClient.invalidateQueries({ queryKey: projectKeys.all(user.id) });
      reset(defaults);
      onCreated(created.name);
      onClose();
    } catch (error) {
      if (error instanceof ProjectApiError) {
        for (const field of error.fields) {
          if (field.field in defaults) {
            setError(field.field as keyof ProjectFormInput, { message: field.message });
          }
        }
        setError('root', { message: error.message });
      } else {
        setError('root', { message: 'Não foi possível criar o projeto. Tente novamente.' });
      }
    }
  });

  return (
    <dialog
      ref={dialogRef}
      className="project-dialog"
      aria-labelledby="create-project-title"
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (isDialogBackdropClick(event)) close();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="navigation-label">Nova entrega</p>
          <h2 id="create-project-title">Cadastrar projeto</h2>
          <p>Defina escopo, cliente, prazo e acompanhamento inicial.</p>
        </div>
        <IconButton label="Fechar cadastro" onClick={close} disabled={mutation.isPending}>
          <X size={19} strokeWidth={1.7} aria-hidden="true" />
        </IconButton>
      </div>
      <form
        className="project-form"
        noValidate
        aria-busy={mutation.isPending}
        onSubmit={(event) => void handleSubmit(submit)(event)}
      >
        <ProjectFormFields
          register={register}
          errors={errors}
          clients={clients}
          progressMode={progressMode}
          autoFocusName
        />
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <div className="dialog-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={close}
            disabled={mutation.isPending}
          >
            Cancelar
          </button>
          <button
            className="primary-button"
            type="submit"
            data-project-action="create"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando…' : 'Cadastrar projeto'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
