import { database } from '../config/database.js';
import { Prisma, type TaskStatus } from '../generated/prisma/client.js';
import type {
  CreateTaskInput,
  ListGlobalTasksQuery,
  ListTasksQuery,
  MoveTaskInput,
  UpdateTaskInput,
} from '../validators/task.schemas.js';
import { archivedProjectReadOnly, taskNotFound, taskProjectNotFound } from './task-error.js';

export const publicTaskSelect = {
  id: true,
  projectId: true,
  title: true,
  description: true,
  priority: true,
  status: true,
  dueDate: true,
  position: true,
  completedAt: true,
  isClientVisible: true,
  createdAt: true,
  updatedAt: true,
  project: { select: { id: true, name: true, archivedAt: true, progressMode: true } },
} satisfies Prisma.TaskSelect;

type PublicTask = Prisma.TaskGetPayload<{ select: typeof publicTaskSelect }>;
interface TaskContext {
  id: string;
  projectId: string;
  status: TaskStatus;
  position: number;
  completedAt: Date | null;
  project: { archivedAt: Date | null };
}

function dateFromApi(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateToApi(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function serializeTask(task: PublicTask) {
  return { ...task, dueDate: task.dueDate ? dateToApi(task.dueDate) : null };
}

function todayIn(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return dateFromApi(`${part('year')}-${part('month')}-${part('day')}`);
}

function dueWhere(due: ListTasksQuery['due'], timeZone: string): Prisma.TaskWhereInput {
  if (due === 'all') return {};
  if (due === 'none') return { dueDate: null };
  const today = todayIn(timeZone);
  if (due === 'overdue') return { dueDate: { lt: today } };
  if (due === 'today') return { dueDate: today };
  return { dueDate: { gt: today } };
}

async function withSerializable<T>(action: (transaction: Prisma.TransactionClient) => Promise<T>) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await database.$transaction(action, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error('Transação serializável não concluída.');
}

async function requireProject(
  transaction: Prisma.TransactionClient,
  userId: string,
  projectId: string,
  mutable: boolean,
) {
  const project = await transaction.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true, archivedAt: true },
  });
  if (!project) throw taskProjectNotFound();
  if (mutable && project.archivedAt) throw archivedProjectReadOnly();
  return project;
}

async function requireTask(
  transaction: Prisma.TransactionClient,
  userId: string,
  taskId: string,
  mutable: boolean,
): Promise<TaskContext> {
  const task = await transaction.task.findFirst({
    where: { id: taskId, project: { userId } },
    select: {
      id: true,
      projectId: true,
      status: true,
      position: true,
      completedAt: true,
      project: { select: { archivedAt: true } },
    },
  });
  if (!task) throw taskNotFound();
  if (mutable && task.project.archivedAt) throw archivedProjectReadOnly();
  return task;
}

async function normalizeColumn(
  transaction: Prisma.TransactionClient,
  projectId: string,
  status: TaskStatus,
) {
  const tasks = await transaction.task.findMany({
    where: { projectId, status },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  for (const [position, task] of tasks.entries()) {
    await transaction.task.update({ where: { id: task.id }, data: { position } });
  }
}

async function moveWithinTransaction(
  transaction: Prisma.TransactionClient,
  task: TaskContext,
  targetStatus: TaskStatus,
  targetPosition: number,
) {
  const targetTasks = await transaction.task.findMany({
    where: { projectId: task.projectId, status: targetStatus, id: { not: task.id } },
    orderBy: [{ position: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  targetTasks.splice(Math.min(targetPosition, targetTasks.length), 0, { id: task.id });
  for (const [position, item] of targetTasks.entries()) {
    await transaction.task.update({
      where: { id: item.id },
      data:
        item.id === task.id
          ? {
              status: targetStatus,
              position,
              completedAt: targetStatus === 'DONE' ? (task.completedAt ?? new Date()) : null,
            }
          : { position },
    });
  }
  if (task.status !== targetStatus) {
    await normalizeColumn(transaction, task.projectId, task.status);
  }
}

function taskWhere(
  userId: string,
  query: ListTasksQuery,
  timeZone: string,
  projectId?: string,
): Prisma.TaskWhereInput {
  return {
    project: { userId },
    ...(projectId ? { projectId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: 'insensitive' } },
            { description: { contains: query.q, mode: 'insensitive' } },
          ],
        }
      : {}),
    ...dueWhere(query.due, timeZone),
  };
}

export async function listProjectTasks(
  userId: string,
  projectId: string,
  query: ListTasksQuery,
  timeZone: string,
) {
  const project = await database.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw taskProjectNotFound();
  const tasks = await database.task.findMany({
    where: taskWhere(userId, query, timeZone, projectId),
    select: publicTaskSelect,
    orderBy: [{ status: 'asc' }, { position: 'asc' }, { id: 'asc' }],
  });
  return tasks.map(serializeTask);
}

export async function listGlobalTasks(
  userId: string,
  query: ListGlobalTasksQuery,
  timeZone: string,
) {
  const tasks = await database.task.findMany({
    where: taskWhere(userId, query, timeZone, query.projectId),
    select: publicTaskSelect,
    orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }, { id: 'asc' }],
  });
  return tasks.map(serializeTask);
}

export async function createTask(userId: string, projectId: string, input: CreateTaskInput) {
  const task = await withSerializable(async (transaction) => {
    await requireProject(transaction, userId, projectId, true);
    const aggregate = await transaction.task.aggregate({
      where: { projectId, status: input.status },
      _max: { position: true },
    });
    return transaction.task.create({
      data: {
        projectId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate ? dateFromApi(input.dueDate) : null,
        position: (aggregate._max.position ?? -1) + 1,
        completedAt: input.status === 'DONE' ? new Date() : null,
        isClientVisible: input.isClientVisible,
      },
      select: publicTaskSelect,
    });
  });
  return serializeTask(task);
}

export async function getTask(userId: string, taskId: string) {
  const task = await database.task.findFirst({
    where: { id: taskId, project: { userId } },
    select: publicTaskSelect,
  });
  if (!task) throw taskNotFound();
  return serializeTask(task);
}

export async function updateTask(userId: string, taskId: string, input: UpdateTaskInput) {
  const task = await withSerializable(async (transaction) => {
    const existing = await requireTask(transaction, userId, taskId, true);
    if (input.status !== undefined && input.status !== existing.status) {
      const count = await transaction.task.count({
        where: { projectId: existing.projectId, status: input.status, id: { not: taskId } },
      });
      await moveWithinTransaction(transaction, existing, input.status, count);
    }
    const data: Prisma.TaskUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) data.description = input.description;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.dueDate !== undefined)
      data.dueDate = input.dueDate ? dateFromApi(input.dueDate) : null;
    if (input.isClientVisible !== undefined) data.isClientVisible = input.isClientVisible;
    return transaction.task.update({ where: { id: taskId }, data, select: publicTaskSelect });
  });
  return serializeTask(task);
}

export async function moveTask(userId: string, taskId: string, input: MoveTaskInput) {
  const task = await withSerializable(async (transaction) => {
    const existing = await requireTask(transaction, userId, taskId, true);
    await moveWithinTransaction(transaction, existing, input.status, input.position);
    return transaction.task.findUniqueOrThrow({ where: { id: taskId }, select: publicTaskSelect });
  });
  return serializeTask(task);
}

export async function deleteTask(userId: string, taskId: string) {
  await withSerializable(async (transaction) => {
    const existing = await requireTask(transaction, userId, taskId, true);
    await transaction.task.delete({ where: { id: taskId } });
    await normalizeColumn(transaction, existing.projectId, existing.status);
  });
}
