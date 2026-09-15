import { z } from 'zod';
import { ApiError, authenticatedFetch } from '../auth/auth-api';
import {
  progressModeSchema,
  projectStatusSchema,
  type ProjectFormInput,
  type ProjectStatus,
} from './project-schemas';

const projectClientSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  archivedAt: z.iso.datetime().nullable(),
});
const projectSchema = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  status: projectStatusSchema,
  startDate: z.iso.date(),
  dueDate: z.iso.date().nullable(),
  budget: z.string(),
  progress: z.number().int().min(0).max(100),
  progressMode: progressModeSchema,
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  client: projectClientSchema,
});
const projectResponseSchema = z.object({ data: projectSchema });
const projectListResponseSchema = z.object({
  data: z.array(projectSchema),
  meta: z.object({ count: z.number().int().nonnegative() }),
});
const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string(),
    fields: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

export type Project = z.infer<typeof projectSchema>;
export type ProjectView = 'active' | 'archived';
export interface ProjectFilters {
  view: ProjectView;
  search: string;
  status: ProjectStatus | '';
  clientId: string;
}

export class ProjectApiError extends ApiError {
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
    throw new ProjectApiError(response.status, 'Não foi possível concluir a solicitação.');
  }
  const error = errorResponseSchema.safeParse(data);
  throw new ProjectApiError(
    response.status,
    error.success ? error.data.error.message : 'Não foi possível concluir a solicitação.',
    error.success ? (error.data.error.code ?? '') : '',
    error.success ? (error.data.error.fields ?? []) : [],
  );
}

function payload(input: ProjectFormInput) {
  return {
    clientId: input.clientId,
    name: input.name,
    description: input.description || null,
    status: input.status,
    startDate: input.startDate,
    dueDate: input.dueDate || null,
    budget: input.budget,
    ...(input.progressMode === 'MANUAL' ? { progress: input.progress } : {}),
    progressMode: input.progressMode,
  };
}

export async function listProjects(filters: ProjectFilters) {
  const query = new URLSearchParams({ view: filters.view });
  if (filters.search) query.set('q', filters.search);
  if (filters.status) query.set('status', filters.status);
  if (filters.clientId) query.set('clientId', filters.clientId);
  const response = await authenticatedFetch(`/api/v1/projects?${query.toString()}`);
  if (!response.ok) return readError(response);
  return projectListResponseSchema.parse(await response.json());
}

export async function getProject(projectId: string) {
  const response = await authenticatedFetch(`/api/v1/projects/${encodeURIComponent(projectId)}`);
  if (!response.ok) return readError(response);
  return projectResponseSchema.parse(await response.json()).data;
}

export async function createProject(input: ProjectFormInput) {
  const response = await authenticatedFetch('/api/v1/projects', {
    method: 'POST',
    body: JSON.stringify(payload(input)),
  });
  if (!response.ok) return readError(response);
  return projectResponseSchema.parse(await response.json()).data;
}

export async function updateProject(projectId: string, input: ProjectFormInput) {
  const response = await authenticatedFetch(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload(input)),
  });
  if (!response.ok) return readError(response);
  return projectResponseSchema.parse(await response.json()).data;
}

export async function changeProjectArchive(projectId: string, action: 'archive' | 'restore') {
  const response = await authenticatedFetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/${action}`,
    { method: 'PATCH', body: '{}' },
  );
  if (!response.ok) return readError(response);
  return projectResponseSchema.parse(await response.json()).data;
}

export async function deleteProject(projectId: string) {
  const response = await authenticatedFetch(`/api/v1/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) return readError(response);
}

export const projectKeys = {
  all: (userId: string) => ['projects', userId] as const,
  list: (userId: string, filters: ProjectFilters) =>
    [
      'projects',
      userId,
      'list',
      filters.view,
      filters.search,
      filters.status,
      filters.clientId,
    ] as const,
  detail: (userId: string, projectId: string) => ['projects', userId, 'detail', projectId] as const,
};
