import { createHash, randomBytes } from 'node:crypto';
import { database } from '../config/database.js';
import { env } from '../config/env.js';
import { calculatedProgress } from './project.service.js';
import { portalProjectNotFound, portalUnavailable } from './portal-error.js';
import { lockPortalProject } from './portal-project-lock.js';

const metadataSelect = {
  expiresAt: true,
  revokedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
function metadata(
  link: { expiresAt: Date; revokedAt: Date | null; createdAt: Date; updatedAt: Date } | null,
  archived: boolean,
) {
  return {
    active: Boolean(link && !archived && !link.revokedAt && link.expiresAt > new Date()),
    link,
  };
}
function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export async function getPortalState(userId: string, projectId: string) {
  const project = await database.project.findFirst({
    where: { id: projectId, userId },
    select: { archivedAt: true, portalLink: { select: metadataSelect } },
  });
  if (!project) throw portalProjectNotFound();
  return metadata(project.portalLink, Boolean(project.archivedAt));
}

export async function generatePortal(userId: string, projectId: string, validityDays: 7 | 30 | 90) {
  const token = randomBytes(32).toString('base64url');
  const link = await database.$transaction(async (tx) => {
    await lockPortalProject(tx, userId, projectId);
    const data = {
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + validityDays * 86400000),
      revokedAt: null,
    };
    return tx.portalLink.upsert({
      where: { projectId },
      create: { projectId, ...data },
      update: data,
      select: metadataSelect,
    });
  });
  // The raw credential is returned only here, never selected from storage.
  return { ...metadata(link, false), url: `${env.APP_ORIGIN}/portal/${token}` };
}

export async function revokePortal(userId: string, projectId: string) {
  await database.$transaction(async (tx) => {
    await lockPortalProject(tx, userId, projectId, false);
    await tx.portalLink.updateMany({
      where: { projectId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}

export async function readPortal(token: unknown) {
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw portalUnavailable();
  const link = await database.portalLink.findFirst({
    where: {
      tokenHash: hash(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
      project: { archivedAt: null },
    },
    select: {
      project: {
        select: {
          name: true,
          description: true,
          status: true,
          startDate: true,
          dueDate: true,
          progress: true,
          progressMode: true,
          _count: { select: { tasks: true } },
          tasks: {
            where: { isClientVisible: true },
            orderBy: [{ status: 'asc' }, { position: 'asc' }, { id: 'asc' }],
            select: {
              title: true,
              description: true,
              status: true,
              priority: true,
              dueDate: true,
              completedAt: true,
            },
          },
          stages: {
            where: { isClientVisible: true },
            orderBy: [{ position: 'asc' }, { id: 'asc' }],
            select: { title: true, status: true },
          },
          // Internal aggregate only: never included in the returned DTO.
          id: true,
        },
      },
    },
  });
  if (!link) throw portalUnavailable();
  const p = link.project;
  const completed =
    p.progressMode === 'AUTO'
      ? await database.task.count({ where: { projectId: p.id, status: 'DONE' } })
      : 0;
  return {
    project: {
      name: p.name,
      description: p.description,
      status: p.status,
      startDate: p.startDate.toISOString().slice(0, 10),
      dueDate: p.dueDate?.toISOString().slice(0, 10) ?? null,
      progress:
        p.progressMode === 'AUTO' ? calculatedProgress(p._count.tasks, completed) : p.progress,
    },
    tasks: p.tasks.map((t) => ({
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate?.toISOString().slice(0, 10) ?? null,
      completedAt: t.completedAt,
    })),
    stages: p.stages.map((s) => ({ title: s.title, status: s.status })),
  };
}
