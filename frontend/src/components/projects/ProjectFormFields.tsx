import { useId } from 'react';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import type { Client } from '../../clients/client-api';
import { projectStatusLabels } from '../../projects/project-format';
import {
  projectStatusSchema,
  type ProjectFormInput,
  type ProgressMode,
  type ProjectStatus,
} from '../../projects/project-schemas';
import { FormField } from '../auth/FormField';

interface ProjectFormFieldsProps {
  register: UseFormRegister<ProjectFormInput>;
  errors: FieldErrors<ProjectFormInput>;
  clients: Pick<Client, 'id' | 'name' | 'archivedAt'>[];
  autoFocusName?: boolean;
  progressMode: ProgressMode;
}

export function ProjectFormFields({
  register,
  errors,
  clients,
  progressMode,
  autoFocusName = false,
}: ProjectFormFieldsProps) {
  const descriptionId = useId();
  const clientId = useId();
  const statusId = useId();

  return (
    <div className="project-form-fields">
      <FormField
        label="Nome"
        type="text"
        maxLength={120}
        autoFocus={autoFocusName}
        required
        {...register('name')}
        error={errors.name?.message}
      />
      <div className="form-field">
        <label htmlFor={clientId}>Cliente</label>
        <select
          id={clientId}
          required
          aria-invalid={!!errors.clientId}
          aria-describedby={errors.clientId ? `${clientId}-help` : undefined}
          {...register('clientId')}
        >
          <option value="">Selecione um cliente</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
              {client.archivedAt ? ' (arquivado — vínculo atual)' : ''}
            </option>
          ))}
        </select>
        {errors.clientId && (
          <p id={`${clientId}-help`} className="field-error">
            {errors.clientId.message}
          </p>
        )}
      </div>

      <div className="form-field project-description-field">
        <label htmlFor={descriptionId}>Descrição</label>
        <textarea
          id={descriptionId}
          rows={4}
          maxLength={2000}
          placeholder="Opcional"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? `${descriptionId}-help` : undefined}
          {...register('description')}
        />
        {errors.description && (
          <p id={`${descriptionId}-help`} className="field-error">
            {errors.description.message}
          </p>
        )}
      </div>

      <div className="form-field">
        <label htmlFor={statusId}>Status</label>
        <select
          id={statusId}
          aria-invalid={!!errors.status}
          aria-describedby={errors.status ? `${statusId}-help` : undefined}
          {...register('status')}
        >
          {projectStatusSchema.options.map((status: ProjectStatus) => (
            <option key={status} value={status}>
              {projectStatusLabels[status]}
            </option>
          ))}
        </select>
        {errors.status && (
          <p id={`${statusId}-help`} className="field-error">
            {errors.status.message}
          </p>
        )}
      </div>

      <FormField
        label="Data de início"
        type="date"
        required
        {...register('startDate')}
        error={errors.startDate?.message}
      />
      <FormField
        label="Prazo"
        type="date"
        {...register('dueDate')}
        error={errors.dueDate?.message}
      />
      <FormField
        label="Orçamento"
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        required
        {...register('budget')}
        error={errors.budget?.message}
        hint="Use ponto para os centavos."
      />
      <fieldset className="form-field project-progress-mode">
        <legend>Cálculo do progresso</legend>
        <div>
          <label>
            <input type="radio" value="MANUAL" {...register('progressMode')} />
            Manual
          </label>
          <label>
            <input type="radio" value="AUTO" {...register('progressMode')} />
            Automático
          </label>
        </div>
        <span className="field-hint">
          {progressMode === 'AUTO'
            ? 'Tarefas concluídas definem o percentual.'
            : 'Você informa o percentual do projeto.'}
        </span>
      </fieldset>
      <FormField
        label="Progresso (%)"
        type="number"
        min={0}
        max={100}
        step={1}
        required
        disabled={progressMode === 'AUTO'}
        {...register('progress', { valueAsNumber: true })}
        error={errors.progress?.message}
      />
    </div>
  );
}
