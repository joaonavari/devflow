import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil, Search } from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { TaskDialog } from '../components/tasks/TaskDialog';
import { projectKeys } from '../projects/project-api';
import {
  listTasks,
  moveTask,
  taskKeys,
  type Task,
  type TaskDueFilter,
  type TaskFilters,
} from '../tasks/task-api';
import {
  formatTaskDate,
  taskDueLabels,
  taskPriorityLabels,
  taskStatusLabels,
} from '../tasks/task-format';
import {
  taskPrioritySchema,
  taskStatusSchema,
  type TaskPriority,
  type TaskStatus,
} from '../tasks/task-schemas';

const baseFilters: TaskFilters = {
  search: '',
  status: '',
  priority: '',
  due: 'all',
  projectId: '',
};

export function TasksPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [due, setDue] = useState<TaskDueFilter>('all');
  const [projectId, setProjectId] = useState('');
  const [editing, setEditing] = useState<Task | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const filters: TaskFilters = { search: deferredSearch, status, priority, due, projectId };
  const query = useQuery({
    queryKey: taskKeys.global(userId, filters),
    queryFn: () => listTasks(filters),
    enabled: Boolean(userId),
  });
  const projectsQuery = useQuery({
    queryKey: taskKeys.global(userId, baseFilters),
    queryFn: () => listTasks(baseFilters),
    enabled: Boolean(userId),
  });
  const tasks = useMemo(() => query.data?.data ?? [], [query.data]);
  const projects = useMemo(() => {
    const byId = new Map<string, Task['project']>();
    for (const task of projectsQuery.data?.data ?? []) byId.set(task.project.id, task.project);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [projectsQuery.data]);
  const moveMutation = useMutation({
    mutationFn: ({ taskId, nextStatus }: { taskId: string; nextStatus: TaskStatus }) =>
      moveTask(taskId, nextStatus, 99999),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.all(userId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all(userId) }),
      ]);
      setNotice('Status da tarefa atualizado.');
    },
    onError: () => {
      setNotice('Não foi possível alterar o status da tarefa.');
    },
  });
  const hasFilters = Boolean(deferredSearch || status || priority || projectId || due !== 'all');

  return (
    <>
      <PageHeader title="Tarefas" description="Acompanhe a execução de todos os seus projetos." />
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      <section className="tasks-panel" aria-labelledby="tasks-list-title">
        <div className="tasks-toolbar">
          <div>
            <h2 id="tasks-list-title">Visão geral</h2>
            <p>
              {query.data ? `${String(query.data.meta.count)} tarefas` : 'Carregando registros'}
            </p>
          </div>
        </div>
        <div className="tasks-filters">
          <div className="tasks-search">
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="task-search">
              Pesquisar tarefas
            </label>
            <input
              id="task-search"
              type="search"
              value={search}
              maxLength={100}
              placeholder="Buscar por título ou descrição"
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>
          <label>
            <span className="sr-only">Filtrar por projeto</span>
            <select
              data-task-filter="project"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
              }}
            >
              <option value="">Todos os projetos</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por status</span>
            <select
              data-task-filter="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TaskStatus | '');
              }}
            >
              <option value="">Todos os status</option>
              {taskStatusSchema.options.map((option) => (
                <option key={option} value={option}>
                  {taskStatusLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por prioridade</span>
            <select
              data-task-filter="priority"
              value={priority}
              onChange={(event) => {
                setPriority(event.target.value as TaskPriority | '');
              }}
            >
              <option value="">Todas as prioridades</option>
              {taskPrioritySchema.options.map((option) => (
                <option key={option} value={option}>
                  {taskPriorityLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por prazo</span>
            <select
              data-task-filter="due"
              value={due}
              onChange={(event) => {
                setDue(event.target.value as TaskDueFilter);
              }}
            >
              {Object.entries(taskDueLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {query.isPending && (
          <div className="tasks-loading" role="status">
            Carregando tarefas…
          </div>
        )}
        {query.isError && (
          <div className="tasks-message" role="alert">
            <h3>Não foi possível carregar as tarefas</h3>
            <p>Confira sua conexão e tente novamente.</p>
            <button className="secondary-button" type="button" onClick={() => void query.refetch()}>
              Tentar novamente
            </button>
          </div>
        )}
        {query.isSuccess && tasks.length === 0 && (
          <EmptyState
            icon={hasFilters ? Search : CheckCircle2}
            title={hasFilters ? 'Nenhuma tarefa encontrada' : 'Nenhuma tarefa cadastrada'}
            description={
              hasFilters
                ? 'Ajuste a busca ou os filtros.'
                : 'Abra um projeto para criar sua primeira tarefa.'
            }
          >
            {hasFilters ? (
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setPriority('');
                  setDue('all');
                  setProjectId('');
                }}
              >
                Limpar filtros
              </button>
            ) : (
              <Link className="text-link" to="/projetos">
                Abrir projetos
              </Link>
            )}
          </EmptyState>
        )}
        {query.isSuccess && tasks.length > 0 && (
          <>
            <div className="tasks-table-wrap">
              <table className="tasks-table">
                <thead>
                  <tr>
                    <th>Tarefa</th>
                    <th>Projeto</th>
                    <th>Status</th>
                    <th>Prioridade</th>
                    <th>Prazo</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id}>
                      <td>
                        <strong>{task.title}</strong>
                        {task.isClientVisible && <small>Visível para cliente</small>}
                      </td>
                      <td>
                        <Link to={`/projetos/${task.projectId}`}>{task.project.name}</Link>
                        {task.project.archivedAt && <small>Arquivado</small>}
                      </td>
                      <td>
                        <select
                          aria-label={`Status de ${task.title}`}
                          value={task.status}
                          disabled={!!task.project.archivedAt || moveMutation.isPending}
                          onChange={(event) => {
                            moveMutation.mutate({
                              taskId: task.id,
                              nextStatus: event.target.value as TaskStatus,
                            });
                          }}
                        >
                          {taskStatusSchema.options.map((option) => (
                            <option key={option} value={option}>
                              {taskStatusLabels[option]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span className="task-priority" data-priority={task.priority}>
                          {taskPriorityLabels[task.priority]}
                        </span>
                      </td>
                      <td>{task.dueDate ? formatTaskDate(task.dueDate) : 'Sem prazo'}</td>
                      <td>
                        <button
                          className="task-row-action"
                          type="button"
                          disabled={!!task.project.archivedAt}
                          aria-label={`Editar ${task.title}`}
                          onClick={() => {
                            setEditing(task);
                          }}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="tasks-mobile-list">
              {tasks.map((task) => (
                <li key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <Link to={`/projetos/${task.projectId}`}>{task.project.name}</Link>
                  </div>
                  <div className="task-mobile-meta">
                    <span>{taskStatusLabels[task.status]}</span>
                    <span data-priority={task.priority}>{taskPriorityLabels[task.priority]}</span>
                    <span>{task.dueDate ? formatTaskDate(task.dueDate) : 'Sem prazo'}</span>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={!!task.project.archivedAt}
                    onClick={() => {
                      setEditing(task);
                    }}
                  >
                    Editar
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      {editing && (
        <TaskDialog
          open
          projectId={editing.projectId}
          task={editing}
          onClose={() => {
            setEditing(null);
          }}
          onSaved={(message) => {
            setNotice(message);
          }}
        />
      )}
    </>
  );
}
