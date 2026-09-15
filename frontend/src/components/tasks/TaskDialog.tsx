import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../auth/auth-context';
import { projectKeys } from '../../projects/project-api';
import { createTask, TaskApiError, taskKeys, type Task, updateTask } from '../../tasks/task-api';
import { taskPriorityLabels, taskStatusLabels } from '../../tasks/task-format';
import {
  taskFormSchema,
  taskPrioritySchema,
  taskStatusSchema,
  type TaskFormInput,
} from '../../tasks/task-schemas';
import { FormField } from '../auth/FormField';
import { IconButton } from '../ui/IconButton';

interface TaskDialogProps {
  open: boolean;
  projectId: string;
  task?: Task | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

const defaults: TaskFormInput = {
  title: '',
  description: '',
  priority: 'MEDIUM',
  status: 'TODO',
  dueDate: '',
  isClientVisible: false,
};

function valuesFrom(task?: Task | null): TaskFormInput {
  return task
    ? {
        title: task.title,
        description: task.description ?? '',
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate ?? '',
        isClientVisible: task.isClientVisible,
      }
    : defaults;
}

export function TaskDialog({ open, projectId, task, onClose, onSaved }: TaskDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const descriptionId = useId();
  const priorityId = useId();
  const statusId = useId();
  const visibilityId = useId();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<TaskFormInput>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: valuesFrom(task),
  });
  const mutation = useMutation({
    mutationFn: (input: TaskFormInput) =>
      task ? updateTask(task.id, input) : createTask(projectId, input),
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input[name="title"]')?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function close() {
    if (mutation.isPending) return;
    mutation.reset();
    onClose();
  }

  async function submit(input: TaskFormInput) {
    try {
      const saved = await mutation.mutateAsync(input);
      if (user) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: taskKeys.all(user.id) }),
          queryClient.invalidateQueries({ queryKey: projectKeys.all(user.id) }),
        ]);
      }
      onSaved(task ? `${saved.title} foi atualizada.` : `${saved.title} foi criada.`);
      onClose();
    } catch (error) {
      if (error instanceof TaskApiError) {
        for (const field of error.fields) {
          if (field.field in defaults) {
            setError(field.field as keyof TaskFormInput, { message: field.message });
          }
        }
        setError('root', { message: error.message });
      } else {
        setError('root', { message: 'Não foi possível salvar a tarefa.' });
      }
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="task-dialog"
      aria-labelledby="task-dialog-title"
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
          <p className="navigation-label">{task ? 'Editar tarefa' : 'Nova tarefa'}</p>
          <h2 id="task-dialog-title">{task ? task.title : 'Adicionar ao projeto'}</h2>
          <p>Defina execução, prioridade e prazo.</p>
        </div>
        <IconButton label="Fechar tarefa" onClick={close} disabled={mutation.isPending}>
          <X size={19} strokeWidth={1.7} aria-hidden="true" />
        </IconButton>
      </div>
      <form
        className="task-form"
        noValidate
        aria-busy={mutation.isPending}
        onSubmit={(event) => void handleSubmit(submit)(event)}
      >
        <FormField
          label="Título"
          type="text"
          maxLength={160}
          required
          {...register('title')}
          error={errors.title?.message}
        />
        <div className="form-field task-description-field">
          <label htmlFor={descriptionId}>Descrição</label>
          <textarea
            id={descriptionId}
            rows={5}
            maxLength={2000}
            placeholder="Opcional"
            aria-invalid={!!errors.description}
            {...register('description')}
          />
          {errors.description && <p className="field-error">{errors.description.message}</p>}
        </div>
        <div className="task-form-row">
          <div className="form-field">
            <label htmlFor={priorityId}>Prioridade</label>
            <select id={priorityId} {...register('priority')}>
              {taskPrioritySchema.options.map((priority) => (
                <option key={priority} value={priority}>
                  {taskPriorityLabels[priority]}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor={statusId}>Status</label>
            <select id={statusId} {...register('status')}>
              {taskStatusSchema.options.map((status) => (
                <option key={status} value={status}>
                  {taskStatusLabels[status]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <FormField
          label="Prazo"
          type="date"
          {...register('dueDate')}
          error={errors.dueDate?.message}
        />
        <label className="task-visibility" htmlFor={visibilityId}>
          <input id={visibilityId} type="checkbox" {...register('isClientVisible')} />
          <span>
            <strong>Visível para o cliente</strong>
            <small>Prepara esta tarefa para o futuro portal do cliente.</small>
          </span>
        </label>
        {errors.root && (
          <p className="form-error" role="alert">
            {errors.root.message}
          </p>
        )}
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={close}>
            Cancelar
          </button>
          <button
            className="primary-button"
            type="submit"
            data-task-action="save"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando…' : task ? 'Salvar alterações' : 'Criar tarefa'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
