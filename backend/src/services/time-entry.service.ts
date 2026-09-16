import { database } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  CreateTimeEntryInput,
  ListGlobalTimeEntriesQuery,
  ListProjectTimeEntriesQuery,
  UpdateTimeEntryInput,
} from '../validators/time-entry.schemas.js';
import {
  archivedProjectReadOnly,
  timeEntryNotFound,
  timeEntryProjectNotFound,
} from './time-entry-error.js';

const publicTimeEntrySelect = {
  id: true,
  projectId: true,
  description: true,
  workDate: true,
  durationMinutes: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      archivedAt: true,
      client: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.TimeEntrySelect;

type PublicTimeEntry = Prisma.TimeEntryGetPayload<{ select: typeof publicTimeEntrySelect }>;

function dateFromApi(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateToApi(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function serializeTimeEntry(entry: PublicTimeEntry) {
  return { ...entry, workDate: dateToApi(entry.workDate) };
}

function rangeWhere(query: ListProjectTimeEntriesQuery): Prisma.TimeEntryWhereInput {
  return {
    ...(query.q ? { description: { contains: query.q, mode: 'insensitive' as const } } : {}),
    ...(query.from || query.to
      ? {
          workDate: {
            ...(query.from ? { gte: dateFromApi(query.from) } : {}),
            ...(query.to ? { lte: dateFromApi(query.to) } : {}),
          },
        }
      : {}),
  };
}

function globalWhere(
  userId: string,
  query: ListGlobalTimeEntriesQuery,
): Prisma.TimeEntryWhereInput {
  return {
    project: {
      userId,
      ...(query.clientId ? { clientId: query.clientId } : {}),
    },
    ...(query.projectId ? { projectId: query.projectId } : {}),
    ...rangeWhere(query),
  };
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
  if (!project) throw timeEntryProjectNotFound();
  if (mutable && project.archivedAt) throw archivedProjectReadOnly();
  return project;
}

async function requireTimeEntry(
  transaction: Prisma.TransactionClient,
  userId: string,
  timeEntryId: string,
  mutable: boolean,
) {
  const entry = await transaction.timeEntry.findFirst({
    where: { id: timeEntryId, project: { userId } },
    select: { id: true, project: { select: { archivedAt: true } } },
  });
  if (!entry) throw timeEntryNotFound();
  if (mutable && entry.project.archivedAt) throw archivedProjectReadOnly();
  return entry;
}

async function listWithTotal(where: Prisma.TimeEntryWhereInput) {
  const [entries, aggregate] = await Promise.all([
    database.timeEntry.findMany({
      where,
      select: publicTimeEntrySelect,
      orderBy: [{ workDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    }),
    database.timeEntry.aggregate({ where, _sum: { durationMinutes: true } }),
  ]);
  return {
    data: entries.map(serializeTimeEntry),
    totalMinutes: aggregate._sum.durationMinutes ?? 0,
  };
}

export async function listGlobalTimeEntries(userId: string, query: ListGlobalTimeEntriesQuery) {
  return listWithTotal(globalWhere(userId, query));
}

export async function listProjectTimeEntries(
  userId: string,
  projectId: string,
  query: ListProjectTimeEntriesQuery,
) {
  const project = await database.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw timeEntryProjectNotFound();
  return listWithTotal({ projectId, project: { userId }, ...rangeWhere(query) });
}

export async function createTimeEntry(
  userId: string,
  projectId: string,
  input: CreateTimeEntryInput,
) {
  const entry = await database.$transaction(async (transaction) => {
    await requireProject(transaction, userId, projectId, true);
    return transaction.timeEntry.create({
      data: {
        projectId,
        description: input.description,
        workDate: dateFromApi(input.workDate),
        durationMinutes: input.durationMinutes,
      },
      select: publicTimeEntrySelect,
    });
  });
  return serializeTimeEntry(entry);
}

export async function getTimeEntry(userId: string, timeEntryId: string) {
  const entry = await database.timeEntry.findFirst({
    where: { id: timeEntryId, project: { userId } },
    select: publicTimeEntrySelect,
  });
  if (!entry) throw timeEntryNotFound();
  return serializeTimeEntry(entry);
}

export async function updateTimeEntry(
  userId: string,
  timeEntryId: string,
  input: UpdateTimeEntryInput,
) {
  const entry = await database.$transaction(async (transaction) => {
    await requireTimeEntry(transaction, userId, timeEntryId, true);
    return transaction.timeEntry.update({
      where: { id: timeEntryId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.workDate !== undefined ? { workDate: dateFromApi(input.workDate) } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
      },
      select: publicTimeEntrySelect,
    });
  });
  return serializeTimeEntry(entry);
}

export async function deleteTimeEntry(userId: string, timeEntryId: string) {
  await database.$transaction(async (transaction) => {
    await requireTimeEntry(transaction, userId, timeEntryId, true);
    await transaction.timeEntry.delete({ where: { id: timeEntryId } });
  });
}
