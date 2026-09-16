import { z } from 'zod';
import { ApiError, authenticatedFetch } from '../auth/auth-api';
import { normalizeMoneyInput, type PaymentFormInput } from './payment-schemas';

const paymentStatusSchema = z.enum(['PENDING', 'PAID']);
const paymentSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  description: z.string(),
  amount: z.string(),
  status: paymentStatusSchema,
  dueDate: z.iso.date(),
  paidAt: z.iso.datetime().nullable(),
  isOverdue: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  project: z.object({
    id: z.uuid(),
    name: z.string(),
    archivedAt: z.iso.datetime().nullable(),
    client: z.object({ id: z.uuid(), name: z.string() }),
  }),
});
const totalsSchema = z.object({
  count: z.number().int().nonnegative(),
  totalExpected: z.string(),
  totalPaid: z.string(),
  totalPending: z.string(),
  totalOverdue: z.string(),
});
const paymentResponseSchema = z.object({ data: paymentSchema });
const paymentListResponseSchema = z.object({ data: z.array(paymentSchema), meta: totalsSchema });
const errorResponseSchema = z.object({
  error: z.object({
    code: z.string().optional(),
    message: z.string(),
    fields: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
  }),
});

export type Payment = z.infer<typeof paymentSchema>;
export type PaymentTotals = z.infer<typeof totalsSchema>;
export type PaymentView = 'all' | 'PENDING' | 'PAID' | 'OVERDUE';
export interface PaymentFilters {
  search: string;
  projectId: string;
  clientId: string;
  view: PaymentView;
  from: string;
  to: string;
}

export class PaymentApiError extends ApiError {
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
    throw new PaymentApiError(response.status, 'Não foi possível concluir a solicitação.');
  }
  const error = errorResponseSchema.safeParse(data);
  throw new PaymentApiError(
    response.status,
    error.success ? error.data.error.message : 'Não foi possível concluir a solicitação.',
    error.success ? (error.data.error.code ?? '') : '',
    error.success ? (error.data.error.fields ?? []) : [],
  );
}

function queryFrom(filters: PaymentFilters) {
  const query = new URLSearchParams();
  if (filters.search) query.set('q', filters.search);
  if (filters.projectId) query.set('projectId', filters.projectId);
  if (filters.clientId) query.set('clientId', filters.clientId);
  if (filters.view === 'OVERDUE') query.set('overdue', 'true');
  else if (filters.view !== 'all') query.set('status', filters.view);
  if (filters.from) query.set('from', filters.from);
  if (filters.to) query.set('to', filters.to);
  return query.toString();
}

function payload(input: PaymentFormInput) {
  const amount = normalizeMoneyInput(input.amount);
  if (!amount) throw new Error('Valor monetário inválido.');
  return { description: input.description, amount, dueDate: input.dueDate };
}

export async function listPayments(filters: PaymentFilters) {
  const query = queryFrom(filters);
  const response = await authenticatedFetch(`/api/v1/payments${query ? `?${query}` : ''}`);
  if (!response.ok) return readError(response);
  return paymentListResponseSchema.parse(await response.json());
}

export async function listProjectPayments(projectId: string) {
  const response = await authenticatedFetch(
    `/api/v1/projects/${encodeURIComponent(projectId)}/payments`,
  );
  if (!response.ok) return readError(response);
  return paymentListResponseSchema.parse(await response.json());
}

export async function createPayment(input: PaymentFormInput) {
  const response = await authenticatedFetch(
    `/api/v1/projects/${encodeURIComponent(input.projectId)}/payments`,
    {
      method: 'POST',
      body: JSON.stringify(payload(input)),
    },
  );
  if (!response.ok) return readError(response);
  return paymentResponseSchema.parse(await response.json()).data;
}

export async function updatePayment(paymentId: string, input: PaymentFormInput) {
  const response = await authenticatedFetch(`/api/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload(input)),
  });
  if (!response.ok) return readError(response);
  return paymentResponseSchema.parse(await response.json()).data;
}

export async function changePaymentStatus(paymentId: string, action: 'pay' | 'reopen') {
  const response = await authenticatedFetch(
    `/api/v1/payments/${encodeURIComponent(paymentId)}/${action}`,
    {
      method: 'PATCH',
      body: '{}',
    },
  );
  if (!response.ok) return readError(response);
  return paymentResponseSchema.parse(await response.json()).data;
}

export async function deletePayment(paymentId: string) {
  const response = await authenticatedFetch(`/api/v1/payments/${encodeURIComponent(paymentId)}`, {
    method: 'DELETE',
  });
  if (!response.ok) return readError(response);
}

export const paymentKeys = {
  all: (userId: string) => ['payments', userId] as const,
  global: (userId: string, filters: PaymentFilters) =>
    ['payments', userId, 'global', filters] as const,
  project: (userId: string, projectId: string) =>
    ['payments', userId, 'project', projectId] as const,
  detail: (userId: string, paymentId: string) => ['payments', userId, 'detail', paymentId] as const,
};
