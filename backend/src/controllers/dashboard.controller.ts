import type { RequestHandler, Response } from 'express';
import { getDashboard } from '../services/dashboard.service.js';
import { dashboardQuerySchema } from '../validators/dashboard.schemas.js';

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

export const detail: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  const data = await getDashboard(
    user.id,
    user.timezone,
    dashboardQuerySchema.parse(request.query),
  );
  response.json({ data });
};
