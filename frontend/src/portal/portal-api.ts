import { z } from 'zod';
import { ApiError, authenticatedFetch } from '../auth/auth-api';
export const stageStatusSchema = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']);
export const stageLabels = {
  PENDING: 'Pendente',
  IN_PROGRESS: 'Em andamento',
  COMPLETED: 'Concluída',
};
export const stageFormSchema = z.object({
  title: z.string().trim().min(1, 'Informe o título.').max(160, 'Use até 160 caracteres.'),
  status: stageStatusSchema,
  isClientVisible: z.boolean(),
});
export type StageInput = z.infer<typeof stageFormSchema>;
const stageSchema = stageFormSchema.extend({
  id: z.uuid(),
  projectId: z.uuid(),
  position: z.number().int(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Stage = z.infer<typeof stageSchema>;
const stateSchema = z.object({
  active: z.boolean(),
  link: z
    .object({
      expiresAt: z.iso.datetime(),
      revokedAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
      updatedAt: z.iso.datetime(),
    })
    .nullable(),
});
export type PortalState = z.infer<typeof stateSchema>;
export const portalKeys = {
  state: (userId: string, projectId: string) => ['portal-admin', userId, projectId] as const,
  stages: (userId: string, projectId: string) => ['project-stages', userId, projectId] as const,
};
async function request(path: string, method = 'GET', body?: object) {
  const response = await authenticatedFetch(`/api/v1/${path}`, {
    method,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const error = z
      .object({ error: z.object({ message: z.string() }) })
      .safeParse(await response.json().catch(() => null));
    throw new ApiError(
      response.status,
      error.success ? error.data.error.message : 'Não foi possível concluir a solicitação.',
    );
  }
  if (response.status === 204) return undefined;
  return (await response.json()) as unknown;
}
export function portalErrorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : 'Não foi possível concluir a solicitação. Tente novamente.';
}
export async function getPortalState(id: string) {
  return z
    .object({ data: stateSchema })
    .parse(await request(`projects/${encodeURIComponent(id)}/portal`)).data;
}
export async function generatePortal(id: string, validityDays: number) {
  return z
    .object({ data: stateSchema.extend({ url: z.url() }) })
    .parse(await request(`projects/${encodeURIComponent(id)}/portal`, 'POST', { validityDays }))
    .data;
}
export async function revokePortal(id: string) {
  await request(`projects/${encodeURIComponent(id)}/portal`, 'DELETE');
}
export async function listStages(id: string) {
  return z
    .object({ data: z.array(stageSchema) })
    .parse(await request(`projects/${encodeURIComponent(id)}/stages`)).data;
}
export async function saveStage(projectId: string, input: StageInput, stageId?: string) {
  return z
    .object({ data: stageSchema })
    .parse(
      await request(
        stageId
          ? `project-stages/${encodeURIComponent(stageId)}`
          : `projects/${encodeURIComponent(projectId)}/stages`,
        stageId ? 'PATCH' : 'POST',
        input,
      ),
    ).data;
}
export async function moveStage(id: string, position: number) {
  await request(`project-stages/${encodeURIComponent(id)}/move`, 'PATCH', { position });
}
export async function deleteStage(id: string) {
  await request(`project-stages/${encodeURIComponent(id)}`, 'DELETE');
}
