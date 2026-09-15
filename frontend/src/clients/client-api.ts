import { z } from 'zod';
import { ApiError, authenticatedFetch } from '../auth/auth-api';
import type { ClientFormInput } from './client-schemas';

const clientSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.email(),
  phone: z.string().nullable(),
  company: z.string().nullable(),
  archivedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
const clientResponseSchema = z.object({ data: clientSchema });
const clientListResponseSchema = z.object({
  data: z.array(clientSchema),
  meta: z.object({ count: z.number().int().nonnegative() }),
});
const errorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    fields: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

export type Client = z.infer<typeof clientSchema>;
export type ClientStatus = 'active' | 'archived';

export class ClientApiError extends ApiError {
  constructor(
    status: number,
    message: string,
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
    throw new ClientApiError(response.status, 'Não foi possível concluir a solicitação.');
  }
  const error = errorResponseSchema.safeParse(data);
  throw new ClientApiError(
    response.status,
    error.success ? error.data.error.message : 'Não foi possível concluir a solicitação.',
    error.success ? (error.data.error.fields ?? []) : [],
  );
}

function payload(input: ClientFormInput) {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone || null,
    company: input.company || null,
  };
}

export async function listClients(status: ClientStatus, search: string) {
  const query = new URLSearchParams({ status });
  if (search) query.set('q', search);
  const response = await authenticatedFetch(`/api/v1/clients?${query.toString()}`);
  if (!response.ok) return readError(response);
  return clientListResponseSchema.parse(await response.json());
}

export async function getClient(clientId: string) {
  const response = await authenticatedFetch(`/api/v1/clients/${encodeURIComponent(clientId)}`);
  if (!response.ok) return readError(response);
  return clientResponseSchema.parse(await response.json()).data;
}

export async function createClient(input: ClientFormInput) {
  const response = await authenticatedFetch('/api/v1/clients', {
    method: 'POST',
    body: JSON.stringify(payload(input)),
  });
  if (!response.ok) return readError(response);
  return clientResponseSchema.parse(await response.json()).data;
}

export async function updateClient(clientId: string, input: ClientFormInput) {
  const response = await authenticatedFetch(`/api/v1/clients/${encodeURIComponent(clientId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload(input)),
  });
  if (!response.ok) return readError(response);
  return clientResponseSchema.parse(await response.json()).data;
}

export async function changeClientArchive(clientId: string, action: 'archive' | 'restore') {
  const response = await authenticatedFetch(
    `/api/v1/clients/${encodeURIComponent(clientId)}/${action}`,
    { method: 'PATCH', body: '{}' },
  );
  if (!response.ok) return readError(response);
  return clientResponseSchema.parse(await response.json()).data;
}

export async function deleteClient(clientId: string) {
  const response = await authenticatedFetch(`/api/v1/clients/${encodeURIComponent(clientId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) return readError(response);
}

export const clientKeys = {
  all: (userId: string) => ['clients', userId] as const,
  list: (userId: string, status: ClientStatus, search: string) =>
    ['clients', userId, 'list', status, search] as const,
  detail: (userId: string, clientId: string) => ['clients', userId, 'detail', clientId] as const,
};
