import type { RequestHandler, Response } from 'express';
import * as clients from '../services/client.service.js';
import {
  clientIdSchema,
  createClientSchema,
  listClientsQuerySchema,
  updateClientSchema,
} from '../validators/client.schemas.js';

function userIdFrom(response: Response): string {
  const user: unknown = response.locals.user;
  if (typeof user !== 'object' || user === null || !('id' in user) || typeof user.id !== 'string') {
    throw new Error('Usuário autenticado ausente no contexto da requisição.');
  }
  return user.id;
}

function clientIdFrom(value: string | string[] | undefined): string {
  return clientIdSchema.parse(value);
}

export const list: RequestHandler = async (request, response) => {
  const query = listClientsQuerySchema.parse(request.query);
  const data = await clients.listClients(userIdFrom(response), query);
  response.json({ data, meta: { count: data.length } });
};

export const create: RequestHandler = async (request, response) => {
  const data = await clients.createClient(
    userIdFrom(response),
    createClientSchema.parse(request.body),
  );
  response.status(201).json({ data });
};

export const detail: RequestHandler = async (request, response) => {
  const data = await clients.getClient(userIdFrom(response), clientIdFrom(request.params.clientId));
  response.json({ data });
};

export const update: RequestHandler = async (request, response) => {
  const data = await clients.updateClient(
    userIdFrom(response),
    clientIdFrom(request.params.clientId),
    updateClientSchema.parse(request.body),
  );
  response.json({ data });
};

export const archive: RequestHandler = async (request, response) => {
  const data = await clients.archiveClient(
    userIdFrom(response),
    clientIdFrom(request.params.clientId),
  );
  response.json({ data });
};

export const restore: RequestHandler = async (request, response) => {
  const data = await clients.restoreClient(
    userIdFrom(response),
    clientIdFrom(request.params.clientId),
  );
  response.json({ data });
};

export const remove: RequestHandler = async (request, response) => {
  await clients.deleteClient(userIdFrom(response), clientIdFrom(request.params.clientId));
  response.sendStatus(204);
};
