import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import type { Project } from '../../projects/project-api';
import {
  deleteTimeEntry,
  listProjectTimeEntries,
  TimeEntryApiError,
  timeEntryKeys,
  type TimeEntry,
} from '../../time-entries/time-entry-api';
import { formatDuration, formatWorkDate } from '../../time-entries/time-entry-format';
import { DeleteTimeEntryDialog } from './DeleteTimeEntryDialog';
import { TimeEntryDialog } from './TimeEntryDialog';

interface ProjectTimeEntriesProps {
  project: Project;
}

export function ProjectTimeEntries({ project }: ProjectTimeEntriesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: timeEntryKeys.project(userId, project.id),
    queryFn: () => listProjectTimeEntries(project.id),
    enabled: Boolean(userId),
  });
  const deleteMutation = useMutation({ mutationFn: deleteTimeEntry });
  const archived = Boolean(project.archivedAt);

  async function remove() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deleting.id);
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: timeEntryKeys.all(userId) });
      setNotice('Registro de horas excluído.');
    } catch (error) {
      setDeleteError(
        error instanceof TimeEntryApiError ? error.message : 'Não foi possível excluir o registro.',
      );
    }
  }

  const entries = query.data?.data.slice(0, 5) ?? [];
  return (
    <section className="project-time-section" aria-labelledby="project-time-title">
      <div className="project-time-heading">
        <div>
          <p className="navigation-label">Tempo</p>
          <h2 id="project-time-title">Horas do projeto</h2>
          <p>Registros recentes e total acumulado.</p>
        </div>
        {!archived && (
          <button
            className="primary-button"
            type="button"
            data-time-action="new-project-entry"
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus size={17} aria-hidden="true" />
            Registrar tempo
          </button>
        )}
      </div>

      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      {archived && (
        <p className="time-read-only">Restaure o projeto para alterar os registros de horas.</p>
      )}
      {query.isPending && (
        <div className="time-section-message" role="status">
          Carregando horas…
        </div>
      )}
      {query.isError && (
        <div className="time-section-message" role="alert">
          <span>Não foi possível carregar as horas.</span>
          <button type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {query.isSuccess && (
        <>
          <div className="project-time-total">
            <Clock3 size={20} aria-hidden="true" />
            <div>
              <span>Total registrado</span>
              <strong data-time-total>{formatDuration(query.data.meta.totalMinutes)}</strong>
            </div>
            <small>{query.data.meta.count} registros</small>
          </div>
          {entries.length === 0 ? (
            <div className="time-section-message">
              <strong>Nenhuma hora registrada</strong>
              <span>Registre o primeiro período trabalhado neste projeto.</span>
            </div>
          ) : (
            <ul className="project-time-list">
              {entries.map((entry) => (
                <li key={entry.id} data-time-entry-id={entry.id}>
                  <time dateTime={entry.workDate}>{formatWorkDate(entry.workDate)}</time>
                  <div>
                    <strong>{entry.description ?? 'Trabalho no projeto'}</strong>
                    <span>{entry.project.client.name}</span>
                  </div>
                  <b>{formatDuration(entry.durationMinutes)}</b>
                  {!archived && (
                    <div className="time-row-actions">
                      <button
                        type="button"
                        aria-label={`Editar registro de ${formatDuration(entry.durationMinutes)}`}
                        onClick={() => {
                          setEditing(entry);
                        }}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir registro de ${formatDuration(entry.durationMinutes)}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(entry);
                        }}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {query.data.meta.count > 5 && (
            <Link className="project-time-all" to={`/horas?projectId=${project.id}`}>
              Ver todos os registros
            </Link>
          )}
        </>
      )}

      {(creating || editing) && (
        <TimeEntryDialog
          key={editing?.id ?? 'new-project-time-entry'}
          projects={[]}
          fixedProject={{ id: project.id, name: project.name }}
          entry={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={(message) => {
            setNotice(message);
          }}
        />
      )}
      <DeleteTimeEntryDialog
        entry={deleting}
        pending={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleting(null);
        }}
        onConfirm={() => void remove()}
      />
    </section>
  );
}
