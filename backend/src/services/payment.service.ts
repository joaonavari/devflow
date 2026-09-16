import { database } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  CreatePaymentInput,
  ListGlobalPaymentsQuery,
  ListProjectPaymentsQuery,
  UpdatePaymentInput,
} from '../validators/payment.schemas.js';
import {
  archivedProjectReadOnly,
  paymentNotFound,
  paymentProjectNotFound,
} from './payment-error.js';

const publicPaymentSelect = {
  id: true,
  projectId: true,
  description: true,
  amount: true,
  status: true,
  dueDate: true,
  paidAt: true,
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
} satisfies Prisma.PaymentSelect;

type PublicPayment = Prisma.PaymentGetPayload<{ select: typeof publicPaymentSelect }>;

function dateFromApi(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateToApi(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function todayIn(timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return dateFromApi(`${part('year')}-${part('month')}-${part('day')}`);
}

function serializePayment(payment: PublicPayment, today: Date) {
  return {
    ...payment,
    amount: payment.amount.toFixed(2),
    dueDate: dateToApi(payment.dueDate),
    isOverdue: payment.status === 'PENDING' && payment.dueDate < today,
  };
}

function paymentWhere(
  userId: string,
  query: ListProjectPaymentsQuery,
  today: Date,
  projectId?: string,
  clientId?: string,
): Prisma.PaymentWhereInput {
  return {
    project: { userId, ...(clientId ? { clientId } : {}) },
    ...(projectId ? { projectId } : {}),
    ...(query.q ? { description: { contains: query.q, mode: 'insensitive' } } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from || query.to
      ? {
          dueDate: {
            ...(query.from ? { gte: dateFromApi(query.from) } : {}),
            ...(query.to ? { lte: dateFromApi(query.to) } : {}),
          },
        }
      : {}),
    ...(query.overdue === 'true'
      ? { AND: [{ status: 'PENDING' }, { dueDate: { lt: today } }] }
      : query.overdue === 'false'
        ? { NOT: { AND: [{ status: 'PENDING' }, { dueDate: { lt: today } }] } }
        : {}),
  };
}

function totals(entries: readonly PublicPayment[], today: Date) {
  let expected = new Prisma.Decimal(0);
  let paid = new Prisma.Decimal(0);
  let pending = new Prisma.Decimal(0);
  let overdue = new Prisma.Decimal(0);
  for (const entry of entries) {
    expected = expected.plus(entry.amount);
    if (entry.status === 'PAID') paid = paid.plus(entry.amount);
    else {
      pending = pending.plus(entry.amount);
      if (entry.dueDate < today) overdue = overdue.plus(entry.amount);
    }
  }
  return {
    totalExpected: expected.toFixed(2),
    totalPaid: paid.toFixed(2),
    totalPending: pending.toFixed(2),
    totalOverdue: overdue.toFixed(2),
  };
}

async function listWithTotals(where: Prisma.PaymentWhereInput, today: Date) {
  const entries = await database.payment.findMany({
    where,
    select: publicPaymentSelect,
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }, { id: 'asc' }],
  });
  return {
    data: entries.map((entry) => serializePayment(entry, today)),
    totals: totals(entries, today),
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
  if (!project) throw paymentProjectNotFound();
  if (mutable && project.archivedAt) throw archivedProjectReadOnly();
  return project;
}

async function requirePayment(
  transaction: Prisma.TransactionClient,
  userId: string,
  paymentId: string,
  mutable: boolean,
) {
  const payment = await transaction.payment.findFirst({
    where: { id: paymentId, project: { userId } },
    select: { id: true, project: { select: { archivedAt: true } } },
  });
  if (!payment) throw paymentNotFound();
  if (mutable && payment.project.archivedAt) throw archivedProjectReadOnly();
  return payment;
}

export function listGlobalPayments(
  userId: string,
  query: ListGlobalPaymentsQuery,
  timeZone: string,
) {
  const today = todayIn(timeZone);
  return listWithTotals(paymentWhere(userId, query, today, query.projectId, query.clientId), today);
}

export async function listProjectPayments(
  userId: string,
  projectId: string,
  query: ListProjectPaymentsQuery,
  timeZone: string,
) {
  const project = await database.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });
  if (!project) throw paymentProjectNotFound();
  const today = todayIn(timeZone);
  return listWithTotals(paymentWhere(userId, query, today, projectId), today);
}

export async function createPayment(
  userId: string,
  projectId: string,
  input: CreatePaymentInput,
  timeZone: string,
) {
  const payment = await database.$transaction(async (transaction) => {
    await requireProject(transaction, userId, projectId, true);
    return transaction.payment.create({
      data: {
        projectId,
        description: input.description,
        amount: new Prisma.Decimal(input.amount),
        dueDate: dateFromApi(input.dueDate),
      },
      select: publicPaymentSelect,
    });
  });
  return serializePayment(payment, todayIn(timeZone));
}

export async function getPayment(userId: string, paymentId: string, timeZone: string) {
  const payment = await database.payment.findFirst({
    where: { id: paymentId, project: { userId } },
    select: publicPaymentSelect,
  });
  if (!payment) throw paymentNotFound();
  return serializePayment(payment, todayIn(timeZone));
}

export async function updatePayment(
  userId: string,
  paymentId: string,
  input: UpdatePaymentInput,
  timeZone: string,
) {
  const payment = await database.$transaction(async (transaction) => {
    await requirePayment(transaction, userId, paymentId, true);
    return transaction.payment.update({
      where: { id: paymentId },
      data: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.amount !== undefined ? { amount: new Prisma.Decimal(input.amount) } : {}),
        ...(input.dueDate !== undefined ? { dueDate: dateFromApi(input.dueDate) } : {}),
      },
      select: publicPaymentSelect,
    });
  });
  return serializePayment(payment, todayIn(timeZone));
}

async function changePaymentStatus(
  userId: string,
  paymentId: string,
  status: 'PENDING' | 'PAID',
  timeZone: string,
) {
  const payment = await database.$transaction(async (transaction) => {
    await requirePayment(transaction, userId, paymentId, true);
    return transaction.payment.update({
      where: { id: paymentId },
      data: { status, paidAt: status === 'PAID' ? new Date() : null },
      select: publicPaymentSelect,
    });
  });
  return serializePayment(payment, todayIn(timeZone));
}

export function payPayment(userId: string, paymentId: string, timeZone: string) {
  return changePaymentStatus(userId, paymentId, 'PAID', timeZone);
}

export function reopenPayment(userId: string, paymentId: string, timeZone: string) {
  return changePaymentStatus(userId, paymentId, 'PENDING', timeZone);
}

export async function deletePayment(userId: string, paymentId: string) {
  await database.$transaction(async (transaction) => {
    await requirePayment(transaction, userId, paymentId, true);
    await transaction.payment.delete({ where: { id: paymentId } });
  });
}
