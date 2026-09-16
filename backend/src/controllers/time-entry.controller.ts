import type { RequestHandler, Response } from 'express';
import * as timeEntries from '../services/time-entry.service.js';
import {
  createTimeEntrySchema,
  listGlobalTimeEntriesQuerySchema,
  listProjectTimeEntriesQuerySchema,
  timeEntryIdSchema,
  timeEntryProjectIdSchema,
  updateTimeEntrySchema,
} from '../validators/time-entry.schemas.js';

function userIdFrom(response: Response): string {
  const user: unknown = response.locals.user;
  if (typeof user !== 'object' || user === null || !('id' in user) || typeof user.id !== 'string') {
    throw new Error('Usuário autenticado ausente no contexto da requisição.');
  }
  return user.id;
}

function timeEntryIdFrom(value: string | string[] | undefined): string {
  return timeEntryIdSchema.parse(value);
}

function projectIdFrom(value: string | string[] | undefined): string {
  return timeEntryProjectIdSchema.parse(value);
}

export const listGlobal: RequestHandler = async (request, response) => {
  const result = await timeEntries.listGlobalTimeEntries(
    userIdFrom(response),
    listGlobalTimeEntriesQuerySchema.parse(request.query),
  );
  response.json({
    data: result.data,
    meta: { count: result.data.length, totalMinutes: result.totalMinutes },
  });
};

export const listProject: RequestHandler = async (request, response) => {
  const result = await timeEntries.listProjectTimeEntries(
    userIdFrom(response),
    projectIdFrom(request.params.projectId),
    listProjectTimeEntriesQuerySchema.parse(request.query),
  );
  response.json({
    data: result.data,
    meta: { count: result.data.length, totalMinutes: result.totalMinutes },
  });
};

export const create: RequestHandler = async (request, response) => {
  const data = await timeEntries.createTimeEntry(
    userIdFrom(response),
    projectIdFrom(request.params.projectId),
    createTimeEntrySchema.parse(request.body),
  );
  response.status(201).json({ data });
};

export const detail: RequestHandler = async (request, response) => {
  const data = await timeEntries.getTimeEntry(
    userIdFrom(response),
    timeEntryIdFrom(request.params.timeEntryId),
  );
  response.json({ data });
};

export const update: RequestHandler = async (request, response) => {
  const data = await timeEntries.updateTimeEntry(
    userIdFrom(response),
    timeEntryIdFrom(request.params.timeEntryId),
    updateTimeEntrySchema.parse(request.body),
  );
  response.json({ data });
};

export const remove: RequestHandler = async (request, response) => {
  await timeEntries.deleteTimeEntry(
    userIdFrom(response),
    timeEntryIdFrom(request.params.timeEntryId),
  );
  response.sendStatus(204);
};
