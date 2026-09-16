import { z } from 'zod';
import { ApiError, authenticatedFetch } from '../auth/auth-api';
import type { TimeEntryFormInput } from './time-entry-schemas';

const timeEntrySchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  description: z.string().nullable(),
  workDate: z.iso.date(),
  durationMinutes: z.number().int().min(1).max(1440),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  project: z.object({
    id: z.uuid(),
    name: z.string(),
    archivedAt: z.iso.datetime().nullable(),
    client: z.object({ id: z.uuid(), name: z.string() }),
  }),
});

const timeEntryResponseSchema = z.object({ data: timeEntrySchema });
const timeEntryListResponseSchema = z.object({
  data: z.array(timeEntrySchema),
  meta: z.object({
    count: z.number().int().nonnegative(),
    totalMinutes: z.number().int().nonnegative(),
  }),
});
const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string(),
    fields: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

export type TimeEntry = z.infer<typeof timeEntrySchema>;
export interface TimeEntryFilters {
  search: string;
  projectId: string;
  clientId: string;
  from: string;
  to: string;
}

export class TimeEntryApiError extends ApiError {
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
    throw new TimeEntryApiError(response.status, 'Não foi possível concluir a solicitação.');
  }
  const error = errorResponseSchema.safeParse(data);
  throw new TimeEntryApiError(
    response.status,
    error.success ? error.data.error.message : 'Não foi possível concluir a solicitação.',
    error.success ? (error.data.error.code ?? '') : '',
    error.success ? (error.data.error.fields ?? []) : [],
  );
}

function queryFrom(filters: TimeEntryFilters) {
  const query = new URLSearchParams();
  if (filters.search) query.set('q', filters.search);
  if (filters.projectId) query.set('projectId', filters.projectId);
  if (filters.clientId) query.set('clientId', filters.clientId);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  return query.toString();
}

function payload(input: TimeEntryFormInput) {
  return {
    workDate: input.workDate,
    durationMinutes: input.hours * 60 + input.minutes,
    description: input.description || null,
  };
}

export async function listTimeEntries(filters: TimeEntryFilters) {
  const query = queryFrom(filters);
  const response = await authenticatedFetch(`/api/v1/time-entries${query ? `?${query}` : ''}`);
  if (!response.ok) return readError(response);
  return timeEntryListResponseSchema.parse(await response.json());
}

export async function listProjectTimeEntries(projectId: string) {
  const response = await authenticatedFetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/time-entries`,
  );
  if (!response.ok) return readError(response);
  return timeEntryListResponseSchema.parse(await response.json());
}

export async function getTimeEntry(timeEntryId: string) {
  const response = await authenticatedFetch(
    `/api/v1/time-entries/${encodeURIComponent(timeEntryId)}`,
  );
  if (!response.ok) return readError(response);
  return timeEntryResponseSchema.parse(await response.json()).data;
}

export async function createTimeEntry(input: TimeEntryFormInput) {
  const response = await authenticatedFetch(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/time-entries`,
    { method: 'POST', body: JSON.stringify(payload(input)) },
  );
  if (!response.ok) return readError(response);
  return timeEntryResponseSchema.parse(await response.json()).data;
}

export async function updateTimeEntry(timeEntryId: string, input: TimeEntryFormInput) {
  const response = await authenticatedFetch(
    `/api/v1/time-entries/${encodeURIComponent(timeEntryId)}`,
    { method: 'PATCH', body: JSON.stringify(payload(input)) },
  );
  if (!response.ok) return readError(response);
  return timeEntryResponseSchema.parse(await response.json()).data;
}

export async function deleteTimeEntry(timeEntryId: string) {
  const response = await authenticatedFetch(
    `/api/v1/time-entries/${encodeURIComponent(timeEntryId)}`,
    { method: 'DELETE' },
  );
  if (!response.ok) return readError(response);
}

export const timeEntryKeys = {
  all: (userId: string) => ['time-entries', userId] as const,
  global: (userId: string, filters: TimeEntryFilters) =>
    ['time-entries', userId, 'global', filters] as const,
  project: (userId: string, projectId: string) =>
    ['time-entries', userId, 'project', projectId] as const,
  detail: (userId: string, timeEntryId: string) =>
    ['time-entries', userId, 'detail', timeEntryId] as const,
};
