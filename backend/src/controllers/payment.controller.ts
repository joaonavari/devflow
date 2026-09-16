import type { RequestHandler, Response } from 'express';
import * as payments from '../services/payment.service.js';
import {
  createPaymentSchema,
  listGlobalPaymentsQuerySchema,
  listProjectPaymentsQuerySchema,
  paymentIdSchema,
  paymentProjectIdSchema,
  updatePaymentSchema,
} from '../validators/payment.schemas.js';

function userFrom(response: Response): { id: string; timezone: string } {
  const user: unknown = response.locals.user;
  if (
    typeof user !== 'object' ||
    user === null ||
    !('id' in user) ||
    typeof user.id !== 'string' ||
    !('timezone' in user) ||
    typeof user.timezone !== 'string'
  )
    throw new Error('Usuário autenticado ausente no contexto da requisição.');
  return { id: user.id, timezone: user.timezone };
}

const paymentIdFrom = (value: string | string[] | undefined) => paymentIdSchema.parse(value);
const projectIdFrom = (value: string | string[] | undefined) => paymentProjectIdSchema.parse(value);

export const listGlobal: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  const result = await payments.listGlobalPayments(
    user.id,
    listGlobalPaymentsQuerySchema.parse(request.query),
    user.timezone,
  );
  response.json({ data: result.data, meta: { count: result.data.length, ...result.totals } });
};

export const listProject: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  const result = await payments.listProjectPayments(
    user.id,
    projectIdFrom(request.params.projectId),
    listProjectPaymentsQuerySchema.parse(request.query),
    user.timezone,
  );
  response.json({ data: result.data, meta: { count: result.data.length, ...result.totals } });
};

export const create: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  const data = await payments.createPayment(
    user.id,
    projectIdFrom(request.params.projectId),
    createPaymentSchema.parse(request.body),
    user.timezone,
  );
  response.status(201).json({ data });
};

export const detail: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  response.json({
    data: await payments.getPayment(
      user.id,
      paymentIdFrom(request.params.paymentId),
      user.timezone,
    ),
  });
};

export const update: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  response.json({
    data: await payments.updatePayment(
      user.id,
      paymentIdFrom(request.params.paymentId),
      updatePaymentSchema.parse(request.body),
      user.timezone,
    ),
  });
};

export const pay: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  response.json({
    data: await payments.payPayment(
      user.id,
      paymentIdFrom(request.params.paymentId),
      user.timezone,
    ),
  });
};

export const reopen: RequestHandler = async (request, response) => {
  const user = userFrom(response);
  response.json({
    data: await payments.reopenPayment(
      user.id,
      paymentIdFrom(request.params.paymentId),
      user.timezone,
    ),
  });
};

export const remove: RequestHandler = async (request, response) => {
  await payments.deletePayment(userFrom(response).id, paymentIdFrom(request.params.paymentId));
  response.sendStatus(204);
};
