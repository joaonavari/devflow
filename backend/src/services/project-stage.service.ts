import { database } from '../config/database.js';
import type { Prisma } from '../generated/prisma/client.js';
import type { CreateStageInput, UpdateStageInput } from '../validators/portal.schemas.js';
import { portalProjectNotFound, stageNotFound } from './portal-error.js';
import { lockPortalProject } from './portal-project-lock.js';

const select = {
  id: true,
  projectId: true,
  title: true,
  status: true,
  position: true,
  isClientVisible: true,
  createdAt: true,
  updatedAt: true,
} as const;
const orderBy = [
  { position: 'asc' },
  { id: 'asc' },
] satisfies Prisma.ProjectStageOrderByWithRelationInput[];

async function lockStage(tx: Prisma.TransactionClient, userId: string, stageId: string) {
  const stage = await tx.projectStage.findFirst({
    where: { id: stageId, project: { userId } },
    select: { projectId: true },
  });
  if (!stage) throw stageNotFound();
  await lockPortalProject(tx, userId, stage.projectId);
  const current = await tx.projectStage.findFirst({
    where: { id: stageId, project: { userId } },
    select,
  });
  if (!current) throw stageNotFound();
  return current;
}
async function normalize(tx: Prisma.TransactionClient, ids: string[]) {
  for (const [position, id] of ids.entries())
    await tx.projectStage.update({ where: { id }, data: { position } });
}
export async function listStages(userId: string, projectId: string) {
  const project = await database.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw portalProjectNotFound();
  return database.projectStage.findMany({
    where: { projectId, project: { userId } },
    orderBy,
    select,
  });
}
export async function createStage(userId: string, projectId: string, input: CreateStageInput) {
  return database.$transaction(async (tx) => {
    await lockPortalProject(tx, userId, projectId);
    const position = await tx.projectStage.count({ where: { projectId } });
    return tx.projectStage.create({ data: { ...input, projectId, position }, select });
  });
}
export async function updateStage(userId: string, stageId: string, input: UpdateStageInput) {
  return database.$transaction(async (tx) => {
    await lockStage(tx, userId, stageId);
    return tx.projectStage.update({
      where: { id: stageId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.isClientVisible !== undefined ? { isClientVisible: input.isClientVisible } : {}),
      },
      select,
    });
  });
}
export async function moveStage(userId: string, stageId: string, position: number) {
  return database.$transaction(async (tx) => {
    const stage = await lockStage(tx, userId, stageId);
    const others = await tx.projectStage.findMany({
      where: { projectId: stage.projectId, id: { not: stageId } },
      orderBy,
      select: { id: true },
    });
    const ids = others.map((s) => s.id);
    ids.splice(Math.min(position, ids.length), 0, stageId);
    await normalize(tx, ids);
    return tx.projectStage.findUniqueOrThrow({ where: { id: stageId }, select });
  });
}
export async function deleteStage(userId: string, stageId: string) {
  await database.$transaction(async (tx) => {
    const stage = await lockStage(tx, userId, stageId);
    await tx.projectStage.delete({ where: { id: stageId } });
    const remaining = await tx.projectStage.findMany({
      where: { projectId: stage.projectId },
      orderBy,
      select: { id: true },
    });
    await normalize(
      tx,
      remaining.map((s) => s.id),
    );
  });
}
