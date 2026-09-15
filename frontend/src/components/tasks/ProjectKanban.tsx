import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  Check,
  GripVertical,
  ListTodo,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { projectKeys } from '../../projects/project-api';
import {
  deleteTask,
  listProjectTasks,
  moveTask,
  TaskApiError,
  taskKeys,
  type Task,
  type TaskFilters,
} from '../../tasks/task-api';
import { formatTaskDate, taskPriorityLabels, taskStatusLabels } from '../../tasks/task-format';
import { taskStatusSchema, type TaskStatus } from '../../tasks/task-schemas';
import { EmptyState } from '../EmptyState';
import { DeleteTaskDialog } from './DeleteTaskDialog';
import { TaskDialog } from './TaskDialog';

interface ProjectKanbanProps {
  projectId: string;
  archived: boolean;
  onTasksChanged: () => void;
}

const filters: TaskFilters = { search: '', status: '', priority: '', due: 'all' };

function arranged(tasks: Task[], taskId: string, status: TaskStatus, position: number): Task[] {
  const moving = tasks.find((task) => task.id === taskId);
  if (!moving) return tasks;
  const columns = Object.fromEntries(
    taskStatusSchema.options.map((column) => [
      column,
      tasks
        .filter((task) => task.status === column && task.id !== taskId)
        .sort((left, right) => left.position - right.position),
    ]),
  ) as Record<TaskStatus, Task[]>;
  columns[status].splice(Math.min(position, columns[status].length), 0, {
    ...moving,
    status,
    completedAt: status === 'DONE' ? (moving.completedAt ?? new Date().toISOString()) : null,
  });
  return taskStatusSchema.options.flatMap((column) =>
    columns[column].map((task, index) => ({ ...task, position: index })),
  );
}

function KanbanColumn({
  status,
  tasks,
  archived,
  onEdit,
  onDelete,
  onMove,
}: {
  status: TaskStatus;
  tasks: Task[];
  archived: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus, position: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}`, disabled: archived });
  return (
    <section
      ref={setNodeRef}
      className="kanban-column"
      data-status={status}
      data-over={isOver || undefined}
      aria-labelledby={`kanban-${status}`}
    >
      <header>
        <h3 id={`kanban-${status}`}>{taskStatusLabels[status]}</h3>
        <span>{tasks.length}</span>
      </header>
      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div className="kanban-column-list">
          {tasks.map((task, index) => (
            <TaskCard
              key={task.id}
              task={task}
              archived={archived}
              first={index === 0}
              last={index === tasks.length - 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onMove={onMove}
            />
          ))}
          {tasks.length === 0 && <p className="kanban-empty">Solte uma tarefa aqui.</p>}
        </div>
      </SortableContext>
    </section>
  );
}

function TaskCard({
  task,
  archived,
  first,
  last,
  onEdit,
  onDelete,
  onMove,
}: {
  task: Task;
  archived: boolean;
  first: boolean;
  last: boolean;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onMove: (task: Task, status: TaskStatus, position: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    disabled: archived,
  });
  return (
    <article
      ref={setNodeRef}
      className="task-card"
      data-dragging={isDragging || undefined}
      data-task-id={task.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="task-card-heading">
        <button
          className="task-drag-handle"
          type="button"
          disabled={archived}
          aria-label={`Arrastar ${task.title}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical size={16} aria-hidden="true" />
        </button>
        <strong>{task.title}</strong>
        {!archived && (
          <div className="task-card-actions">
            <button
              type="button"
              data-task-action="edit"
              aria-label={`Editar ${task.title}`}
              onClick={() => {
                onEdit(task);
              }}
            >
              <Pencil size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              data-task-action="delete"
              aria-label={`Excluir ${task.title}`}
              onClick={() => {
                onDelete(task);
              }}
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
      {task.description && <p>{task.description}</p>}
      <div className="task-card-meta">
        <span data-priority={task.priority}>{taskPriorityLabels[task.priority]}</span>
        {task.dueDate && <time dateTime={task.dueDate}>{formatTaskDate(task.dueDate)}</time>}
      </div>
      {!archived && (
        <div className="task-accessible-controls">
          <label>
            <span className="sr-only">Status de {task.title}</span>
            <select
              aria-label={`Alterar status de ${task.title}`}
              data-task-action="status"
              value={task.status}
              onChange={(event) => {
                onMove(task, event.target.value as TaskStatus, 99999);
              }}
            >
              {taskStatusSchema.options.map((status) => (
                <option key={status} value={status}>
                  {taskStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={first}
            aria-label={`Mover ${task.title} para cima`}
            data-task-action="up"
            onClick={() => {
              onMove(task, task.status, task.position - 1);
            }}
          >
            <ArrowUp size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={last}
            aria-label={`Mover ${task.title} para baixo`}
            data-task-action="down"
            onClick={() => {
              onMove(task, task.status, task.position + 1);
            }}
          >
            <ArrowDown size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            data-task-action="toggle"
            aria-label={task.status === 'DONE' ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
            onClick={() => {
              onMove(task, task.status === 'DONE' ? 'TODO' : 'DONE', 99999);
            }}
          >
            {task.status === 'DONE' ? (
              <RotateCcw size={14} aria-hidden="true" />
            ) : (
              <Check size={14} aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </article>
  );
}

export function ProjectKanban({ projectId, archived, onTasksChanged }: ProjectKanbanProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = user?.id ?? '';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState<Task | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const queryKey = taskKeys.project(userId, projectId, filters);
  const query = useQuery({
    queryKey,
    queryFn: () => listProjectTasks(projectId, filters),
    enabled: Boolean(userId && projectId),
  });
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const tasks = useMemo(() => query.data?.data ?? [], [query.data]);
  const moveMutation = useMutation({
    mutationFn: ({
      taskId,
      status,
      position,
    }: {
      taskId: string;
      status: TaskStatus;
      position: number;
    }) => moveTask(taskId, status, position),
    onMutate: async ({ taskId, status, position }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<{ data: Task[]; meta: { count: number } }>(
        queryKey,
      );
      if (previous) {
        queryClient.setQueryData(queryKey, {
          ...previous,
          data: arranged(previous.data, taskId, status, position),
        });
      }
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
      setNotice(error instanceof TaskApiError ? error.message : 'Não foi possível mover a tarefa.');
    },
    onSuccess: () => {
      setNotice('Ordem das tarefas atualizada.');
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.all(userId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all(userId) }),
      ]);
      onTasksChanged();
    },
  });
  const deleteMutation = useMutation({ mutationFn: deleteTask });

  function requestMove(task: Task, status: TaskStatus, position: number) {
    setNotice(null);
    setDeleteError(null);
    moveMutation.mutate({ taskId: task.id, status, position: Math.max(0, position) });
  }

  function dragEnd(event: DragEndEvent) {
    const moving = tasks.find((task) => task.id === event.active.id);
    if (!moving || !event.over || event.active.id === event.over.id) return;
    const overTask = tasks.find((task) => task.id === event.over?.id);
    const targetStatus = overTask
      ? overTask.status
      : (String(event.over.id).replace('column:', '') as TaskStatus);
    const column = tasks
      .filter((task) => task.status === targetStatus && task.id !== moving.id)
      .sort((left, right) => left.position - right.position);
    const targetPosition = overTask
      ? column.findIndex((task) => task.id === overTask.id)
      : column.length;
    if (moving.status === targetStatus) {
      const source = tasks
        .filter((task) => task.status === moving.status)
        .sort((left, right) => left.position - right.position);
      const from = source.findIndex((task) => task.id === moving.id);
      const to = overTask ? source.findIndex((task) => task.id === overTask.id) : source.length - 1;
      if (from === to) return;
      const reordered = arrayMove(source, from, to);
      requestMove(
        moving,
        targetStatus,
        reordered.findIndex((task) => task.id === moving.id),
      );
      return;
    }
    requestMove(moving, targetStatus, targetPosition);
  }

  async function removeTask() {
    if (!deleting) return;
    setNotice(null);
    try {
      await deleteMutation.mutateAsync(deleting.id);
      setDeleting(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: taskKeys.all(userId) }),
        queryClient.invalidateQueries({ queryKey: projectKeys.all(userId) }),
      ]);
      onTasksChanged();
      setNotice('Tarefa excluída permanentemente.');
    } catch (error) {
      setDeleteError(
        error instanceof TaskApiError ? error.message : 'Não foi possível excluir a tarefa.',
      );
    }
  }

  return (
    <section className="project-tasks" aria-labelledby="project-tasks-title">
      <div className="project-tasks-heading">
        <div>
          <p className="navigation-label">Execução</p>
          <h2 id="project-tasks-title">Tarefas do projeto</h2>
          <p>Arraste os cartões ou use os controles de status e ordem.</p>
        </div>
        <button
          className="primary-button"
          type="button"
          data-task-action="new"
          disabled={archived}
          title={archived ? 'Restaure o projeto para alterar tarefas.' : undefined}
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus size={17} aria-hidden="true" />
          Nova tarefa
        </button>
      </div>
      {archived && (
        <p className="task-readonly-notice">
          Projeto arquivado: tarefas disponíveis somente para leitura.
        </p>
      )}
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      {query.isPending && (
        <div className="tasks-loading" role="status">
          Carregando tarefas…
        </div>
      )}
      {query.isError && (
        <div className="tasks-message" role="alert">
          <p>Não foi possível carregar as tarefas.</p>
          <button className="secondary-button" type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {query.isSuccess && tasks.length === 0 && (
        <EmptyState
          icon={ListTodo}
          title="Nenhuma tarefa neste projeto"
          description={
            archived
              ? 'Este projeto arquivado não possui tarefas.'
              : 'Crie a primeira tarefa para iniciar o fluxo.'
          }
        >
          {!archived && (
            <button
              className="text-action"
              type="button"
              onClick={() => {
                setDialogOpen(true);
              }}
            >
              Criar tarefa
            </button>
          )}
        </EmptyState>
      )}
      {query.isSuccess && tasks.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={dragEnd}>
          <div className="kanban-board">
            {taskStatusSchema.options.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={tasks
                  .filter((task) => task.status === status)
                  .sort((a, b) => a.position - b.position)}
                archived={archived}
                onEdit={(task) => {
                  setEditing(task);
                  setDialogOpen(true);
                }}
                onDelete={(task) => {
                  setDeleteError(null);
                  setDeleting(task);
                }}
                onMove={requestMove}
              />
            ))}
          </div>
        </DndContext>
      )}
      {dialogOpen && (
        <TaskDialog
          open
          projectId={projectId}
          task={editing}
          onClose={() => {
            setDialogOpen(false);
          }}
          onSaved={(message) => {
            setNotice(message);
            onTasksChanged();
          }}
        />
      )}
      <DeleteTaskDialog
        taskTitle={deleting?.title ?? null}
        pending={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          setDeleting(null);
          setDeleteError(null);
        }}
        onConfirm={() => void removeTask()}
      />
    </section>
  );
}
