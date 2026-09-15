import { database } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type {
  CreateClientInput,
  ListClientsQuery,
  UpdateClientInput,
} from '../validators/client.schemas.js';
import { clientNotFound } from './client-error.js';

export const publicClientSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  company: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ClientSelect;

export function listClients(userId: string, query: ListClientsQuery) {
  const search: Prisma.ClientWhereInput = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: 'insensitive' } },
          { email: { contains: query.q, mode: 'insensitive' } },
          { company: { contains: query.q, mode: 'insensitive' } },
        ],
      }
    : {};

  return database.client.findMany({
    where: {
      userId,
      archivedAt: query.status === 'active' ? null : { not: null },
      ...search,
    },
    select: publicClientSelect,
    orderBy: [{ name: 'asc' }, { id: 'asc' }],
  });
}

export function createClient(userId: string, input: CreateClientInput) {
  return database.client.create({
    data: { ...input, userId },
    select: publicClientSelect,
  });
}

export async function getClient(userId: string, clientId: string) {
  const client = await database.client.findFirst({
    where: { id: clientId, userId },
    select: publicClientSelect,
  });
  if (!client) throw clientNotFound();
  return client;
}

export async function updateClient(userId: string, clientId: string, input: UpdateClientInput) {
  const data: Prisma.ClientUpdateManyMutationInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.company !== undefined) data.company = input.company;
  const updated = await database.client.updateMany({
    where: { id: clientId, userId },
    data,
  });
  if (updated.count !== 1) throw clientNotFound();
  return getClient(userId, clientId);
}

export async function archiveClient(userId: string, clientId: string) {
  const updated = await database.client.updateMany({
    where: { id: clientId, userId, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (updated.count !== 1) {
    const existing = await database.client.findFirst({
      where: { id: clientId, userId, archivedAt: { not: null } },
      select: publicClientSelect,
    });
    if (existing) return existing;
    throw clientNotFound();
  }
  return getClient(userId, clientId);
}

export async function restoreClient(userId: string, clientId: string) {
  const updated = await database.client.updateMany({
    where: { id: clientId, userId, archivedAt: { not: null } },
    data: { archivedAt: null },
  });
  if (updated.count !== 1) {
    const existing = await database.client.findFirst({
      where: { id: clientId, userId, archivedAt: null },
      select: publicClientSelect,
    });
    if (existing) return existing;
    throw clientNotFound();
  }
  return getClient(userId, clientId);
}

export async function deleteClient(userId: string, clientId: string) {
  // Future project constraints can be checked here before this scoped delete.
  const deleted = await database.client.deleteMany({ where: { id: clientId, userId } });
  if (deleted.count !== 1) throw clientNotFound();
}
