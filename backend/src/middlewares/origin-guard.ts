import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { AuthError } from '../services/auth-error.js';

export const originGuard: RequestHandler = (request, response, next) => {
  const origin = request.get('Origin');
  response.vary('Origin');
  if (
    (origin !== undefined && origin !== env.APP_ORIGIN) ||
    request.get('Sec-Fetch-Site') === 'cross-site'
  ) {
    throw new AuthError(403, 'ORIGIN_DENIED', 'Origem da solicitação não permitida.');
  }
  if (origin === env.APP_ORIGIN) {
    response.setHeader('Access-Control-Allow-Origin', env.APP_ORIGIN);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (request.method === 'OPTIONS') {
    if (origin !== env.APP_ORIGIN)
      throw new AuthError(403, 'ORIGIN_DENIED', 'Origem da solicitação não permitida.');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-DevFlow-Request');
    response.sendStatus(204);
    return;
  }
  if (
    !['GET', 'HEAD'].includes(request.method) &&
    (origin !== env.APP_ORIGIN || request.get('X-DevFlow-Request') !== '1')
  ) {
    throw new AuthError(403, 'CSRF_DENIED', 'Não foi possível verificar a origem da solicitação.');
  }
  next();
};
