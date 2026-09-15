import type { RequestHandler, Response } from 'express';
import * as tasks from '../services/task.service.js';
import {
  createTaskSchema,
  listGlobalTasksQuerySchema,
  listTasksQuerySchema,
  moveTaskSchema,
  taskIdSchema,
  taskProjectIdSchema,
  updateTaskSchema,
} from '../validators/task.schemas.js';

function userFrom(response: Response): { id: string; timezone: string } {
  const user: unknown = response.locals.user;
  if (
    typeof user !== 'object' ||
    user === null ||
    !('id' in user) ||
    typeof user.id !== 'string' ||
    !('timezone' in user) ||
    typeof user.timezone !== 'string'
  ) {
    throw new Error('Usuário autenticado ausente no contexto da requisição.');
  }
  return { id: user.id, timezone: user.timezone };
}

function taskIdFrom(value: string | string[] | undefined): string {
  return taskIdSchema.parse(value);
}

function projectIdFrom(value: string | string[] | undefined): string {
  return taskProjectIdSchema.parse(value);
}

export const listGlobal: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  const data = await tasks.listGlobalTasks(
    user.id,
    listGlobalTasksQuerySchema.parse(request.query),
    user.timezone,
  );
  response.json({ data, meta: { count: data.length } });
};

export const listProject: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  const data = await tasks.listProjectTasks(
    user.id,
    projectIdFrom(request.params.projectId),
    listTasksQuerySchema.parse(request.query),
    user.timezone,
  );
  response.json({ data, meta: { count: data.length } });
};

export const create: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  const data = await tasks.createTask(
    user.id,
    projectIdFrom(request.params.projectId),
    createTaskSchema.parse(request.body),
  );
  response.status(201).json({ data });
};

export const detail: RequestHandler = async (request, response) => {
  const data = await tasks.getTask(userFrom(response).id, taskIdFrom(request.params.taskId));
  response.json({ data });
};

export const update: RequestHandler = async (request, response) => {
  const data = await tasks.updateTask(
    userFrom(response).id,
    taskIdFrom(request.params.taskId),
    updateTaskSchema.parse(request.body),
  );
  response.json({ data });
};

export const move: RequestHandler = async (request, response) => {
  const data = await tasks.moveTask(
    userFrom(response).id,
    taskIdFrom(request.params.taskId),
    moveTaskSchema.parse(request.body),
  );
  response.json({ data });
};

export const remove: RequestHandler = async (request, response) => {
  await tasks.deleteTask(userFrom(response).id, taskIdFrom(request.params.taskId));
  response.sendStatus(204);
};
