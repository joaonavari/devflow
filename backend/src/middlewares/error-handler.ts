import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AuthError } from '../services/auth-error.js';
import { ClientError } from '../services/client-error.js';
import { ProjectError } from '../services/project-error.js';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (response.headersSent) {
    _next(error);
    return;
  }

  response.setHeader('Cache-Control', 'no-store');
  if (error instanceof AuthError || error instanceof ClientError || error instanceof ProjectError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } });
    return;
  }
  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Revise os dados informados.',
        fields: error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    (error.type === 'entity.parse.failed' || error.type === 'entity.too.large')
  ) {
    response
      .status(error.type === 'entity.too.large' ? 413 : 400)
      .json({ error: { code: 'INVALID_BODY', message: 'Corpo da solicitação inválido.' } });
    return;
  }
  // Never send exception messages or database connection strings to the client.
  console.error('Falha não tratada durante uma requisição.');
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível processar a solicitação.' },
  });
};
