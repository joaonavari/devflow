import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { before, after } from 'node:test';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';

export function portalTestContext(prefix: string) {
  const run = randomUUID();
  const emails: string[] = [];
  const server = app.listen(0, '127.0.0.1');
  let base = '';
  before(async () => {
    if (!server.listening) await once(server, 'listening');
    const address = server.address();
    assert(address && typeof address !== 'string');
    base = `http://127.0.0.1:${String(address.port)}/api/v1`;
  });
  after(async () => {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      }),
    );
    try {
      await database.user.deleteMany({ where: { email: { in: emails } } });
    } finally {
      await database.$disconnect();
    }
  });
  async function call(method: string, path: string, cookie = '', body?: object) {
    return fetch(`${base}${path}`, {
      method,
      headers: {
        Origin: env.APP_ORIGIN,
        'X-DevFlow-Request': '1',
        'Content-Type': 'application/json',
        Cookie: cookie,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }
  async function owner(label: string) {
    const email = `${prefix}-${label}-${run}@example.test`.toLowerCase();
    emails.push(email);
    const registered = await call('POST', '/auth/register', '', {
      name: `Owner ${label}`,
      email,
      password: 'DevFlow8',
      timezone: 'America/Sao_Paulo',
    });
    assert.equal(registered.status, 201);
    const cookie = registered.headers
      .getSetCookie()
      .map((v) => v.split(';')[0])
      .join('; ');
    const user = await database.user.findUniqueOrThrow({ where: { email } });
    const client = await database.client.create({
      data: { userId: user.id, name: `Client ${label}`, email: `client-${label}@example.test` },
    });
    const project = await database.project.create({
      data: {
        userId: user.id,
        clientId: client.id,
        name: `Projeto ${label}`,
        description: 'Descrição compartilhada',
        startDate: new Date('2026-09-01'),
        budget: '9999.99',
        progress: 37,
      },
    });
    return { cookie, project, user, client };
  }
  return { call, owner };
}
export async function data<T>(response: Response): Promise<T> {
  const body = (await response.json()) as { data: T };
  return body.data;
}
