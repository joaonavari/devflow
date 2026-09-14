import type { ErrorRequestHandler } from 'express';

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (response.headersSent) {
    _next(error);
    return;
  }

  // Never send exception messages or database connection strings to the client.
  console.error('Falha não tratada durante uma requisição.');
  response.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Não foi possível processar a solicitação.' },
  });
};
