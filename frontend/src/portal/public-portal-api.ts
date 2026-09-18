import { z } from 'zod';
const publicPortalSchema = z.strictObject({
  project: z.strictObject({
    name: z.string(),
    description: z.string().nullable(),
    status: z.enum(['PLANNING', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'CANCELLED']),
    progress: z.number().min(0).max(100),
    startDate: z.iso.date(),
    dueDate: z.iso.date().nullable(),
  }),
  tasks: z.array(
    z.strictObject({
      title: z.string(),
      description: z.string().nullable(),
      status: z.enum(['TODO', 'IN_PROGRESS', 'DONE']),
      priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
      dueDate: z.iso.date().nullable(),
      completedAt: z.iso.datetime().nullable(),
    }),
  ),
  stages: z.array(
    z.strictObject({ title: z.string(), status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']) }),
  ),
});
export class PublicPortalError extends Error {
  constructor(public readonly status: number) {
    super('Não foi possível abrir o portal.');
  }
}
// Deliberately independent of authenticatedFetch: no session discovery, cookies or refresh.
export async function readPublicPortal(token: string, signal: AbortSignal) {
  const response = await fetch(`/api/v1/portal/${encodeURIComponent(token)}`, {
    credentials: 'omit',
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new PublicPortalError(response.status);
  return z.strictObject({ data: publicPortalSchema }).parse(await response.json()).data;
}
