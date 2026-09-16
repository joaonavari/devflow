import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../auth/auth-context';
import type { Project } from '../../projects/project-api';
import {
  createTimeEntry,
  TimeEntryApiError,
  timeEntryKeys,
  type TimeEntry,
  updateTimeEntry,
} from '../../time-entries/time-entry-api';
import { durationParts, todayInTimeZone } from '../../time-entries/time-entry-format';
import {
  timeEntryFormSchema,
  type TimeEntryFormInput,
} from '../../time-entries/time-entry-schemas';
import { FormField } from '../auth/FormField';
import { IconButton } from '../ui/IconButton';

interface TimeEntryDialogProps {
  projects: readonly Pick<Project, 'id' | 'name'>[];
  fixedProject?: Pick<Project, 'id' | 'name'>;
  entry?: TimeEntry | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}

function valuesFrom(
  timeZone: string,
  projectId: string,
  entry?: TimeEntry | null,
): TimeEntryFormInput {
  const duration = durationParts(entry?.durationMinutes ?? 0);
  return {
    projectId: entry?.projectId ?? projectId,
    workDate: entry?.workDate ?? todayInTimeZone(timeZone),
    hours: duration.hours,
    minutes: duration.minutes,
    description: entry?.description ?? '',
  };
}

export function TimeEntryDialog({
  projects,
  fixedProject,
  entry,
  onClose,
  onSaved,
}: TimeEntryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const projectId = entry?.projectId ?? fixedProject?.id ?? projects[0]?.id ?? '';
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const descriptionId = useId();
  const projectSelectId = useId();
  const form = useForm<TimeEntryFormInput>({
    resolver: zodResolver(timeEntryFormSchema),
    defaultValues: valuesFrom(user?.timezone ?? 'UTC', projectId, entry),
  });
  const mutation = useMutation({
    mutationFn: (input: TimeEntryFormInput) =>
      entry ? updateTimeEntry(entry.id, input) : createTimeEntry(input),
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog?.open) {
      dialog?.showModal();
      dialog?.querySelector<HTMLElement>('[name="workDate"]')?.focus();
    }
  }, []);

  function close() {
    if (mutation.isPending) return;
    mutation.reset();
    onClose();
  }

  async function submit(input: TimeEntryFormInput) {
    try {
      const saved = await mutation.mutateAsync(input);
      if (user) await queryClient.invalidateQueries({ queryKey: timeEntryKeys.all(user.id) });
      onSaved(entry ? 'Registro de horas atualizado.' : 'Tempo registrado com sucesso.');
      onClose();
      return saved;
    } catch (error) {
      if (error instanceof TimeEntryApiError) {
        for (const field of error.fields) {
          const target = field.field === 'durationMinutes' ? 'minutes' : field.field;
          if (target in form.getValues()) {
            form.setError(target as keyof TimeEntryFormInput, { message: field.message });
          }
        }
        form.setError('root', { message: error.message });
      } else {
        form.setError('root', { message: 'Não foi possível salvar o registro.' });
      }
    }
  }

  const selectedProject = entry?.project ?? fixedProject;
  return (
    <dialog
      ref={dialogRef}
      className="time-entry-dialog"
      aria-labelledby="time-entry-dialog-title"
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
          <p className="navigation-label">{entry ? 'Editar registro' : 'Novo registro'}</p>
          <h2 id="time-entry-dialog-title">
            {entry ? 'Ajustar tempo trabalhado' : 'Registrar tempo'}
          </h2>
          <p>Informe a data, duração e um resumo opcional.</p>
        </div>
        <IconButton label="Fechar registro de horas" onClick={close} disabled={mutation.isPending}>
          <X size={19} strokeWidth={1.7} aria-hidden="true" />
        </IconButton>
      </div>
      <form
        className="time-entry-form"
        noValidate
        aria-busy={mutation.isPending}
        onSubmit={(event) => void form.handleSubmit(submit)(event)}
      >
        {selectedProject ? (
          <div className="time-entry-fixed-project">
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
          label="Data do trabalho"
          type="date"
          required
          {...form.register('workDate')}
          error={form.formState.errors.workDate?.message}
        />
        <fieldset className="duration-fields">
          <legend>Duração</legend>
          <FormField
            label="Horas"
            type="number"
            min={0}
            max={24}
            step={1}
            required
            {...form.register('hours', { valueAsNumber: true })}
            error={form.formState.errors.hours?.message}
          />
          <FormField
            label="Minutos"
            type="number"
            min={0}
            max={59}
            step={1}
            required
            {...form.register('minutes', { valueAsNumber: true })}
            error={form.formState.errors.minutes?.message}
          />
        </fieldset>
        <div className="form-field time-entry-description-field">
          <label htmlFor={descriptionId}>Descrição</label>
          <textarea
            id={descriptionId}
            rows={4}
            maxLength={1000}
            placeholder="Opcional — descreva o trabalho realizado"
            aria-invalid={!!form.formState.errors.description}
            {...form.register('description')}
          />
          {form.formState.errors.description && (
            <p className="field-error">{form.formState.errors.description.message}</p>
          )}
        </div>
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
            data-time-action="save"
            disabled={mutation.isPending}
          >
            {mutation.isPending ? 'Salvando…' : entry ? 'Salvar alterações' : 'Registrar tempo'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
