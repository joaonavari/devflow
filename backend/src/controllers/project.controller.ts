import type { RequestHandler, Response } from 'express';
import * as projects from '../services/project.service.js';
import {
  createProjectSchema,
  listProjectsQuerySchema,
  projectIdSchema,
  updateProjectSchema,
} from '../validators/project.schemas.js';

function userIdFrom(response: Response): string {
  const user: unknown = response.locals.user;
  if (typeof user !== 'object' || user === null || !('id' in user) || typeof user.id !== 'string') {
    throw new Error('Usuário autenticado ausente no contexto da requisição.');
  }
  return user.id;
}

function projectIdFrom(value: string | string[] | undefined): string {
  return projectIdSchema.parse(value);
}

export const list: RequestHandler = async (request, response) => {
  const query = listProjectsQuerySchema.parse(request.query);
  const data = await projects.listProjects(userIdFrom(response), query);
  response.json({ data, meta: { count: data.length } });
};

export const create: RequestHandler = async (request, response) => {
  const data = await projects.createProject(
    userIdFrom(response),
    createProjectSchema.parse(request.body),
  );
  response.status(201).json({ data });
};

export const detail: RequestHandler = async (request, response) => {
  const data = await projects.getProject(
    userIdFrom(response),
    projectIdFrom(request.params.projectId),
  );
  response.json({ data });
};

export const update: RequestHandler = async (request, response) => {
  const data = await projects.updateProject(
    userIdFrom(response),
    projectIdFrom(request.params.projectId),
    updateProjectSchema.parse(request.body),
  );
  response.json({ data });
};

export const archive: RequestHandler = async (request, response) => {
  const data = await projects.archiveProject(
    userIdFrom(response),
    projectIdFrom(request.params.projectId),
  );
  response.json({ data });
};

export const restore: RequestHandler = async (request, response) => {
  const data = await projects.restoreProject(
    userIdFrom(response),
    projectIdFrom(request.params.projectId),
  );
  response.json({ data });
};

export const remove: RequestHandler = async (request, response) => {
  await projects.deleteProject(userIdFrom(response), projectIdFrom(request.params.projectId));
  response.sendStatus(204);
};
