import { database } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  CreateProjectInput,
  ListProjectsQuery,
  UpdateProjectInput,
} from '../validators/project.schemas.js';
import {
  invalidProjectDates,
  projectClientUnavailable,
  projectNotFound,
  projectProgressManaged,
} from './project-error.js';

export const publicProjectSelect = {
  id: true,
  clientId: true,
  name: true,
  description: true,
  status: true,
  startDate: true,
  dueDate: true,
  budget: true,
  progress: true,
  progressMode: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, email: true, archivedAt: true } },
  _count: { select: { tasks: true } },
} satisfies Prisma.ProjectSelect;

type PublicProject = Prisma.ProjectGetPayload<{ select: typeof publicProjectSelect }>;

function dateFromApi(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateToApi(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function calculatedProgress(total: number, completed: number): number {
  return total === 0 ? 0 : Math.round((completed / total) * 100);
}

function serializeProject(project: PublicProject, completedTasks = 0) {
  const { _count, ...publicData } = project;
  return {
    ...publicData,
    startDate: dateToApi(project.startDate),
    dueDate: project.dueDate ? dateToApi(project.dueDate) : null,
    budget: project.budget.toFixed(2),
    progress:
      project.progressMode === 'AUTO'
        ? calculatedProgress(_count.tasks, completedTasks)
        : project.progress,
  };
}

async function completedTaskCounts(projectIds: string[]): Promise<Map<string, number>> {
  if (projectIds.length === 0) return new Map();
  const groups = await database.task.groupBy({
    by: ['projectId'],
    where: { projectId: { in: projectIds }, status: 'DONE' },
    _count: { _all: true },
  });
  return new Map(groups.map((group) => [group.projectId, group._count._all]));
}

async function requireActiveClient(userId: string, clientId: string): Promise<void> {
  const client = await database.client.findFirst({
    where: { id: clientId, userId, archivedAt: null },
    select: { id: true },
  });
  if (!client) throw projectClientUnavailable();
}

function updateData(input: UpdateProjectInput): Prisma.ProjectUncheckedUpdateManyInput {
  const data: Prisma.ProjectUncheckedUpdateManyInput = {};
  if (input.clientId !== undefined) data.clientId = input.clientId;
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.startDate !== undefined) data.startDate = dateFromApi(input.startDate);
  if (input.dueDate !== undefined) data.dueDate = input.dueDate ? dateFromApi(input.dueDate) : null;
  if (input.budget !== undefined) data.budget = new Prisma.Decimal(input.budget);
  return data;
}

export async function listProjects(userId: string, query: ListProjectsQuery) {
  const search: Prisma.ProjectWhereInput = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { client: { name: { contains: query.q, mode: 'insensitive' } } },
        ],
      }
    : {};
  const projects = await database.project.findMany({
    where: {
      userId,
      archivedAt: query.view === 'active' ? null : { not: null },
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...search,
    },
    select: publicProjectSelect,
    orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
  });
  const automaticIds = projects
    .filter((project) => project.progressMode === 'AUTO')
    .map((project) => project.id);
  const completed = await completedTaskCounts(automaticIds);
  return projects.map((project) => serializeProject(project, completed.get(project.id) ?? 0));
}

export async function createProject(userId: string, input: CreateProjectInput) {
  await requireActiveClient(userId, input.clientId);
  if (input.progressMode === 'AUTO' && input.progress !== 0) throw projectProgressManaged();
  const project = await database.project.create({
    data: {
      userId,
      clientId: input.clientId,
      name: input.name,
      description: input.description,
      status: input.status,
      startDate: dateFromApi(input.startDate),
      dueDate: input.dueDate ? dateFromApi(input.dueDate) : null,
      budget: new Prisma.Decimal(input.budget),
      progress: input.progress,
      progressMode: input.progressMode,
    },
    select: publicProjectSelect,
  });
  return serializeProject(project);
}

export async function getProject(userId: string, projectId: string) {
  const project = await database.project.findFirst({
    where: { id: projectId, userId },
    select: publicProjectSelect,
  });
  if (!project) throw projectNotFound();
  const completed =
    project.progressMode === 'AUTO'
      ? await database.task.count({ where: { projectId, status: 'DONE' } })
      : 0;
  return serializeProject(project, completed);
}

export async function updateProject(userId: string, projectId: string, input: UpdateProjectInput) {
  const existing = await database.project.findFirst({
    where: { id: projectId, userId },
    select: {
      clientId: true,
      startDate: true,
      dueDate: true,
      progress: true,
      progressMode: true,
      _count: { select: { tasks: true } },
    },
  });
  if (!existing) throw projectNotFound();
  if (input.clientId !== undefined && input.clientId !== existing.clientId) {
    await requireActiveClient(userId, input.clientId);
  }
  const startDate = input.startDate ? dateFromApi(input.startDate) : existing.startDate;
  const dueDate =
    input.dueDate === undefined
      ? existing.dueDate
      : input.dueDate
        ? dateFromApi(input.dueDate)
        : null;
  if (dueDate && dueDate < startDate) throw invalidProjectDates();
  const nextMode = input.progressMode ?? existing.progressMode;
  if (nextMode === 'AUTO' && input.progress !== undefined) throw projectProgressManaged();
  const data = updateData(input);
  if (input.progressMode !== undefined) data.progressMode = input.progressMode;
  if (nextMode === 'MANUAL' && input.progress !== undefined) data.progress = input.progress;
  if (existing.progressMode === 'AUTO' && nextMode === 'MANUAL') {
    const completed = await database.task.count({ where: { projectId, status: 'DONE' } });
    data.progress = calculatedProgress(existing._count.tasks, completed);
  }
  const updated = await database.project.updateMany({
    where: { id: projectId, userId },
    data,
  });
  if (updated.count !== 1) throw projectNotFound();
  return getProject(userId, projectId);
}

export async function archiveProject(userId: string, projectId: string) {
  const updated = await database.project.updateMany({
    where: { id: projectId, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (updated.count !== 1) {
    const existing = await database.project.findFirst({
      where: { id: projectId, userId, archivedAt: { not: null } },
      select: { id: true },
    });
    if (existing) return getProject(userId, projectId);
    throw projectNotFound();
  }
  return getProject(userId, projectId);
}

export async function restoreProject(userId: string, projectId: string) {
  const updated = await database.project.updateMany({
    where: { id: projectId, userId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
  if (updated.count !== 1) {
    const existing = await database.project.findFirst({
      where: { id: projectId, userId, archivedAt: null },
      select: { id: true },
    });
    if (existing) return getProject(userId, projectId);
    throw projectNotFound();
  }
  return getProject(userId, projectId);
}

export async function deleteProject(userId: string, projectId: string) {
  const deleted = await database.project.deleteMany({ where: { id: projectId, userId } });
  if (deleted.count !== 1) throw projectNotFound();
}
