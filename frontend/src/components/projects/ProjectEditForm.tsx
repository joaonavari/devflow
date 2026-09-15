import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../auth/auth-context';
import type { Client } from '../../clients/client-api';
import {
  type Project,
  ProjectApiError,
  projectKeys,
  updateProject,
} from '../../projects/project-api';
import { projectFormSchema, type ProjectFormInput } from '../../projects/project-schemas';
import { ProjectFormFields } from './ProjectFormFields';

interface ProjectEditFormProps {
  project: Project;
  clients: Pick<Client, 'id' | 'name' | 'archivedAt'>[];
  onSaved: (project: Project) => void;
}

function valuesFrom(project: Project): ProjectFormInput {
  return {
    clientId: project.clientId,
    name: project.name,
    description: project.description ?? '',
    status: project.status,
    startDate: project.startDate,
    dueDate: project.dueDate ?? '',
    budget: project.budget,
    progress: project.progress,
  };
}

export function ProjectEditForm({ project, clients, onSaved }: ProjectEditFormProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const availableClients = clients.some((client) => client.id === project.client.id)
    ? clients
    : [...clients, project.client];
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: valuesFrom(project),
  });
  const mutation = useMutation({
    mutationFn: (input: ProjectFormInput) => updateProject(project.id, input),
  });

  async function submit(input: ProjectFormInput) {
    try {
      const updated = await mutation.mutateAsync(input);
      reset(valuesFrom(updated));
      if (user) {
        queryClient.setQueryData(projectKeys.detail(user.id, project.id), updated);
        await queryClient.invalidateQueries({ queryKey: projectKeys.all(user.id) });
      }
      onSaved(updated);
    } catch (error) {
      if (error instanceof ProjectApiError) {
        for (const field of error.fields) {
          if (field.field in valuesFrom(project)) {
            setError(field.field as keyof ProjectFormInput, { message: field.message });
          }
        }
        setError('root', { message: error.message });
      } else {
        setError('root', { message: 'Não foi possível salvar as alterações.' });
      }
    }
  }

  return (
    <form
      className="project-detail-form"
      noValidate
      aria-busy={mutation.isPending}
      onSubmit={(event) => void handleSubmit(submit)(event)}
    >
      <ProjectFormFields register={register} errors={errors} clients={availableClients} />
      {errors.root && (
        <p className="form-error" role="alert">
          {errors.root.message}
        </p>
      )}
      <div className="detail-form-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={!isDirty || mutation.isPending}
          onClick={() => {
            reset();
          }}
        >
          Descartar
        </button>
        <button
          type="submit"
          className="primary-button"
          data-project-action="save"
          disabled={!isDirty || mutation.isPending}
        >
          {mutation.isPending ? 'Salvando…' : 'Salvar alterações'}
        </button>
      </div>
    </form>
  );
}
