import { z } from 'zod';
import { ApiError, authenticatedFetch } from '../auth/auth-api';
import {
  taskPrioritySchema,
  taskStatusSchema,
  type TaskFormInput,
  type TaskPriority,
  type TaskStatus,
} from './task-schemas';

const taskProjectSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  archivedAt: z.iso.datetime().nullable(),
  progressMode: z.enum(['MANUAL', 'AUTO']),
});

const taskSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  title: z.string(),
  description: z.string().nullable(),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: z.iso.date().nullable(),
  position: z.number().int().nonnegative(),
  completedAt: z.iso.datetime().nullable(),
  isClientVisible: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  project: taskProjectSchema,
});

const taskResponseSchema = z.object({ data: taskSchema });
const taskListResponseSchema = z.object({
  data: z.array(taskSchema),
  meta: z.object({ count: z.number().int().nonnegative() }),
});
const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string(),
    fields: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

export type Task = z.infer<typeof taskSchema>;
export type TaskDueFilter = 'all' | 'overdue' | 'today' | 'upcoming' | 'none';
export interface TaskFilters {
  search: string;
  status: TaskStatus | '';
  priority: TaskPriority | '';
  due: TaskDueFilter;
  projectId?: string;
}

export class TaskApiError extends ApiError {
  constructor(
    status: number,
    message: string,
    public readonly code = '',
    public readonly fields: readonly { field: string; message: string }[] = [],
  ) {
    super(status, message);
  }
}

async function readError(response: Response): Promise<never> {
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new TaskApiError(response.status, 'Não foi possível concluir a solicitação.');
  }
  const error = errorResponseSchema.safeParse(data);
  throw new TaskApiError(
    response.status,
    error.success ? error.data.error.message : 'Não foi possível concluir a solicitação.',
    error.success ? (error.data.error.code ?? '') : '',
    error.success ? (error.data.error.fields ?? []) : [],
  );
}

function queryFrom(filters: TaskFilters) {
  const query = new URLSearchParams({ due: filters.due });
  if (filters.search) query.set('q', filters.search);
  if (filters.status) query.set('status', filters.status);
  if (filters.priority) query.set('priority', filters.priority);
  if (filters.projectId) query.set('projectId', filters.projectId);
  return query.toString();
}

function payload(input: TaskFormInput) {
  return {
    title: input.title,
    description: input.description || null,
    priority: input.priority,
    status: input.status,
    dueDate: input.dueDate || null,
    isClientVisible: input.isClientVisible,
  };
}

export async function listProjectTasks(projectId: string, filters: TaskFilters) {
  const response = await authenticatedFetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/tasks?${queryFrom(filters)}`,
  );
  if (!response.ok) return readError(response);
  return taskListResponseSchema.parse(await response.json());
}

export async function listTasks(filters: TaskFilters) {
  const response = await authenticatedFetch(`/api/v1/tasks?${queryFrom(filters)}`);
  if (!response.ok) return readError(response);
  return taskListResponseSchema.parse(await response.json());
}

export async function getTask(taskId: string) {
  const response = await authenticatedFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}`);
  if (!response.ok) return readError(response);
  return taskResponseSchema.parse(await response.json()).data;
}

export async function createTask(projectId: string, input: TaskFormInput) {
  const response = await authenticatedFetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/tasks`,
    { method: 'POST', body: JSON.stringify(payload(input)) },
  );
  if (!response.ok) return readError(response);
  return taskResponseSchema.parse(await response.json()).data;
}

export async function updateTask(taskId: string, input: TaskFormInput) {
  const response = await authenticatedFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload(input)),
  });
  if (!response.ok) return readError(response);
  return taskResponseSchema.parse(await response.json()).data;
}

export async function moveTask(taskId: string, status: TaskStatus, position: number) {
  const response = await authenticatedFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}/move`, {
    method: 'PATCH',
    body: JSON.stringify({ status, position }),
  });
  if (!response.ok) return readError(response);
  return taskResponseSchema.parse(await response.json()).data;
}

export async function deleteTask(taskId: string) {
  const response = await authenticatedFetch(`/api/v1/tasks/${encodeURIComponent(taskId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) return readError(response);
}

export const taskKeys = {
  all: (userId: string) => ['tasks', userId] as const,
  global: (userId: string, filters: TaskFilters) => ['tasks', userId, 'global', filters] as const,
  project: (userId: string, projectId: string, filters: TaskFilters) =>
    ['tasks', userId, 'project', projectId, filters] as const,
  projectRoot: (userId: string, projectId: string) =>
    ['tasks', userId, 'project', projectId] as const,
  detail: (userId: string, taskId: string) => ['tasks', userId, 'detail', taskId] as const,
};
