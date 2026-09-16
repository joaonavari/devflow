import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock3, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { DeleteTimeEntryDialog } from '../components/time-entries/DeleteTimeEntryDialog';
import { TimeEntryDialog } from '../components/time-entries/TimeEntryDialog';
import { listProjects, projectKeys } from '../projects/project-api';
import {
  deleteTimeEntry,
  listTimeEntries,
  TimeEntryApiError,
  timeEntryKeys,
  type TimeEntry,
  type TimeEntryFilters,
} from '../time-entries/time-entry-api';
import { formatDuration, formatWorkDate } from '../time-entries/time-entry-format';

const emptyFilters: TimeEntryFilters = {
  search: '',
  projectId: '',
  clientId: '',
  from: '',
  to: '',
};
const activeProjectFilters = {
  view: 'active' as const,
  search: '',
  status: '' as const,
  clientId: '',
};

export function HoursPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<TimeEntry | null>(null);
  const [deleting, setDeleting] = useState<TimeEntry | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const filters: TimeEntryFilters = { search: deferredSearch, projectId, clientId, from, to };
  const query = useQuery({
    queryKey: timeEntryKeys.global(userId, filters),
    queryFn: () => listTimeEntries(filters),
    enabled: Boolean(userId),
  });
  const allQuery = useQuery({
    queryKey: timeEntryKeys.global(userId, emptyFilters),
    queryFn: () => listTimeEntries(emptyFilters),
    enabled: Boolean(userId),
  });
  const projectsQuery = useQuery({
    queryKey: projectKeys.list(userId, activeProjectFilters),
    queryFn: () => listProjects(activeProjectFilters),
    enabled: Boolean(userId),
  });
  const deleteMutation = useMutation({ mutationFn: deleteTimeEntry });
  const entries = useMemo(() => query.data?.data ?? [], [query.data]);
  const activeProjects = useMemo(() => projectsQuery.data?.data ?? [], [projectsQuery.data]);
  const filterProjects = useMemo(() => {
    const values = new Map<string, { id: string; name: string; archived: boolean }>();
    for (const project of activeProjects) {
      values.set(project.id, { id: project.id, name: project.name, archived: false });
    }
    for (const entry of allQuery.data?.data ?? []) {
      values.set(entry.project.id, {
        id: entry.project.id,
        name: entry.project.name,
        archived: Boolean(entry.project.archivedAt),
      });
    }
    return [...values.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }, [activeProjects, allQuery.data]);
  const clients = useMemo(() => {
    const values = new Map<string, { id: string; name: string }>();
    for (const entry of allQuery.data?.data ?? []) {
      values.set(entry.project.client.id, entry.project.client);
    }
    return [...values.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }, [allQuery.data]);
  const hasFilters = Boolean(deferredSearch || projectId || clientId || from || to);

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

  function clearFilters() {
    setSearch('');
    setProjectId('');
    setClientId('');
    setFrom('');
    setTo('');
  }

  return (
    <>
      <div className="hours-heading-row">
        <PageHeader title="Horas" description="Acompanhe o tempo dedicado aos seus projetos." />
        <button
          className="primary-button"
          type="button"
          data-time-action="new"
          disabled={activeProjects.length === 0}
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus size={17} aria-hidden="true" />
          Registrar tempo
        </button>
      </div>
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      {projectsQuery.isSuccess && activeProjects.length === 0 && (
        <p className="project-prerequisite">
          Crie ou restaure um projeto para registrar novas horas.{' '}
          <Link to="/projetos">Abrir projetos</Link>
        </p>
      )}

      <section className="hours-summary" aria-label="Resumo de horas">
        <div>
          <span>Total geral</span>
          <strong data-hours-overall>
            {allQuery.data ? formatDuration(allQuery.data.meta.totalMinutes) : '—'}
          </strong>
          <small>Todo o período</small>
        </div>
        <div>
          <span>{hasFilters ? 'Total filtrado' : 'Período atual'}</span>
          <strong data-hours-filtered>
            {query.data ? formatDuration(query.data.meta.totalMinutes) : '—'}
          </strong>
          <small>{query.data ? `${String(query.data.meta.count)} registros` : 'Carregando'}</small>
        </div>
      </section>

      <section className="hours-panel" aria-labelledby="hours-list-title">
        <div className="hours-toolbar">
          <div>
            <h2 id="hours-list-title">Registros recentes</h2>
            <p>Ordenados pela data do trabalho.</p>
          </div>
        </div>
        <div className="hours-filters">
          <div className="hours-search">
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="hours-search">
              Pesquisar registros de horas
            </label>
            <input
              id="hours-search"
              type="search"
              value={search}
              maxLength={100}
              placeholder="Buscar pela descrição"
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>
          <label>
            <span>Projeto</span>
            <select
              data-time-filter="project"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
              }}
            >
              <option value="">Todos os projetos</option>
              {filterProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.archived ? ' — arquivado' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cliente</span>
            <select
              data-time-filter="client"
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
              }}
            >
              <option value="">Todos os clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>De</span>
            <input
              data-time-filter="from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
              }}
            />
          </label>
          <label>
            <span>Até</span>
            <input
              data-time-filter="to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
              }}
            />
          </label>
        </div>

        {query.isPending && (
          <div className="hours-message" role="status">
            Carregando registros…
          </div>
        )}
        {query.isError && (
          <div className="hours-message" role="alert">
            <h3>Não foi possível carregar os registros</h3>
            <p>Confira os filtros e tente novamente.</p>
            <button className="secondary-button" type="button" onClick={() => void query.refetch()}>
              Tentar novamente
            </button>
          </div>
        )}
        {query.isSuccess && entries.length === 0 && (
          <EmptyState
            icon={hasFilters ? Search : Clock3}
            title={hasFilters ? 'Nenhum registro encontrado' : 'Nenhuma hora registrada'}
            description={
              hasFilters
                ? 'Ajuste a busca ou o período selecionado.'
                : 'Registre o primeiro período trabalhado em um projeto.'
            }
          >
            {hasFilters && (
              <button className="text-action" type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            )}
          </EmptyState>
        )}
        {query.isSuccess && entries.length > 0 && (
          <>
            <div className="hours-table-wrap">
              <table className="hours-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Descrição</th>
                    <th>Projeto</th>
                    <th>Cliente</th>
                    <th>Duração</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} data-time-entry-id={entry.id}>
                      <td>{formatWorkDate(entry.workDate)}</td>
                      <td>{entry.description ?? 'Trabalho no projeto'}</td>
                      <td>
                        <Link to={`/projetos/${entry.projectId}`}>{entry.project.name}</Link>
                        {entry.project.archivedAt && <small>Arquivado</small>}
                      </td>
                      <td>{entry.project.client.name}</td>
                      <td>
                        <strong>{formatDuration(entry.durationMinutes)}</strong>
                      </td>
                      <td>
                        <div className="time-row-actions">
                          <button
                            type="button"
                            disabled={Boolean(entry.project.archivedAt)}
                            aria-label={`Editar registro de ${formatDuration(entry.durationMinutes)}`}
                            onClick={() => {
                              setEditing(entry);
                            }}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(entry.project.archivedAt)}
                            aria-label={`Excluir registro de ${formatDuration(entry.durationMinutes)}`}
                            onClick={() => {
                              setDeleteError(null);
                              setDeleting(entry);
                            }}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="hours-mobile-list">
              {entries.map((entry) => (
                <li key={entry.id} data-time-entry-id={entry.id}>
                  <div className="hours-mobile-heading">
                    <time dateTime={entry.workDate}>{formatWorkDate(entry.workDate)}</time>
                    <strong>{formatDuration(entry.durationMinutes)}</strong>
                  </div>
                  <p>{entry.description ?? 'Trabalho no projeto'}</p>
                  <Link to={`/projetos/${entry.projectId}`}>{entry.project.name}</Link>
                  <span>{entry.project.client.name}</span>
                  {!entry.project.archivedAt && (
                    <div className="time-row-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(entry);
                        }}
                      >
                        <Pencil size={15} aria-hidden="true" /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(entry);
                        }}
                      >
                        <Trash2 size={15} aria-hidden="true" /> Excluir
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {(creating || editing) && (
        <TimeEntryDialog
          key={editing?.id ?? 'new-time-entry'}
          projects={activeProjects}
          entry={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={setNotice}
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
    </>
  );
}
