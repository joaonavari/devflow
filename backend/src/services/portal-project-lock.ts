import type { Prisma } from '../generated/prisma/client.js';
import { portalArchived, portalProjectNotFound } from './portal-error.js';

// All portal/stage writes serialize on the project row, including project archival.
export async function lockPortalProject(
  tx: Prisma.TransactionClient,
  userId: string,
  projectId: string,
  mutable = true,
) {
  const rows = await tx.$queryRaw<{ id: string; archivedAt: Date | null }[]>`
    SELECT "id", "archivedAt" FROM "Project"
    WHERE "id" = ${projectId}::uuid AND "userId" = ${userId}::uuid FOR UPDATE
  `;
  const project = rows[0];
  if (!project) throw portalProjectNotFound();
  if (mutable && project.archivedAt) throw portalArchived();
  return project;
}
