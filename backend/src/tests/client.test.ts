import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';

const runId = randomUUID();
const emails = {
  a: `client-owner-a-${runId}@example.test`,
  b: `client-owner-b-${runId}@example.test`,
};
const password = 'DevFlow8';
const server = app.listen(0, '127.0.0.1');
let base = '';

before(async () => {
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  base = `http://127.0.0.1:${String(address.port)}/api/v1`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  try {
    await database.user.deleteMany({ where: { email: { in: Object.values(emails) } } });
  } finally {
    await database.$disconnect();
  }
});

function cookies(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0] ?? '')
    .join('; ');
}

function call(method: string, path: string, cookie = '', body?: object): Promise<Response> {
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

async function register(name: string, email: string) {
  const response = await call('POST', '/auth/register', '', {
    name,
    email,
    password,
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(response.status, 201);
  const body: unknown = await response.json();
  assert(body && typeof body === 'object' && 'user' in body);
  assert(body.user && typeof body.user === 'object' && 'id' in body.user);
  assert.equal(typeof body.user.id, 'string');
  return { cookie: cookies(response), userId: body.user.id };
}

async function responseData(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  assert(body && typeof body === 'object' && 'data' in body);
  assert(body.data && typeof body.data === 'object' && !Array.isArray(body.data));
  return body.data as Record<string, unknown>;
}

async function listData(response: Response): Promise<Record<string, unknown>[]> {
  const body: unknown = await response.json();
  assert(body && typeof body === 'object' && 'data' in body);
  assert(Array.isArray(body.data));
  return body.data as Record<string, unknown>[];
}

void test('clientes integrados com isolamento por proprietário', async (suite) => {
  const ownerA = await register('Proprietário A', emails.a);
  const ownerB = await register('Proprietário B', emails.b);
  let clientAId = '';
  let clientBId = '';

  await suite.test('usuário autenticado cria cliente com dados normalizados', async () => {
    const response = await call('POST', '/clients', ownerA.cookie, {
      name: '  Ana Cliente  ',
      email: '  ANA.CLIENTE@EXAMPLE.TEST ',
      phone: '  +55 11 99999-0000  ',
      company: '  Aurora Studio  ',
    });
    assert.equal(response.status, 201);
    const client = await responseData(response);
    assert.equal(client.name, 'Ana Cliente');
    assert.equal(client.email, 'ana.cliente@example.test');
    assert.equal(client.phone, '+55 11 99999-0000');
    assert.equal(client.company, 'Aurora Studio');
    assert.equal('userId' in client, false);
    clientAId = String(client.id);
  });

  await suite.test('usuário não autenticado não cria cliente', async () => {
    const response = await call('POST', '/clients', '', {
      name: 'Sem sessão',
      email: 'no-session@example.test',
    });
    assert.equal(response.status, 401);
    assert.equal(await database.client.count({ where: { email: 'no-session@example.test' } }), 0);
  });

  await suite.test('segundo usuário cria cliente independente', async () => {
    const response = await call('POST', '/clients', ownerB.cookie, {
      name: 'Bruno Privado',
      email: 'bruno.private@example.test',
      company: 'Empresa Secreta',
    });
    assert.equal(response.status, 201);
    clientBId = String((await responseData(response)).id);
  });

  await suite.test('usuário lista somente seus clientes', async () => {
    const clientsA = await listData(await call('GET', '/clients', ownerA.cookie));
    const clientsB = await listData(await call('GET', '/clients', ownerB.cookie));
    assert.deepEqual(
      clientsA.map((client) => client.id),
      [clientAId],
    );
    assert.deepEqual(
      clientsB.map((client) => client.id),
      [clientBId],
    );
  });

  for (const [field, search] of [
    ['nome', 'ana cli'],
    ['email', 'CLIENTE@EXAMPLE'],
    ['empresa', 'aurora'],
  ] as const) {
    await suite.test(`busca encontra cliente por ${field}`, async () => {
      const clients = await listData(
        await call('GET', `/clients?status=active&q=${encodeURIComponent(search)}`, ownerA.cookie),
      );
      assert.deepEqual(
        clients.map((client) => client.id),
        [clientAId],
      );
    });
  }

  await suite.test('busca nunca retorna cliente de outro usuário', async () => {
    const clients = await listData(
      await call('GET', '/clients?q=Empresa%20Secreta', ownerA.cookie),
    );
    assert.deepEqual(clients, []);
  });

  await suite.test('usuário visualiza seu cliente', async () => {
    const response = await call('GET', `/clients/${clientAId}`, ownerA.cookie);
    assert.equal(response.status, 200);
    assert.equal((await responseData(response)).id, clientAId);
  });

  await suite.test('usuários não visualizam clientes alheios', async () => {
    assert.equal((await call('GET', `/clients/${clientBId}`, ownerA.cookie)).status, 404);
    assert.equal((await call('GET', `/clients/${clientAId}`, ownerB.cookie)).status, 404);
  });

  await suite.test('usuário edita seu cliente', async () => {
    const response = await call('PATCH', `/clients/${clientAId}`, ownerA.cookie, {
      name: 'Ana Atualizada',
      email: 'ana.updated@example.test',
      phone: '',
      company: null,
    });
    assert.equal(response.status, 200);
    const client = await responseData(response);
    assert.equal(client.name, 'Ana Atualizada');
    assert.equal(client.phone, null);
    assert.equal(client.company, null);
  });

  await suite.test('usuários não editam clientes alheios', async () => {
    assert.equal(
      (await call('PATCH', `/clients/${clientBId}`, ownerA.cookie, { name: 'Invadido' })).status,
      404,
    );
    assert.equal(
      (await call('PATCH', `/clients/${clientAId}`, ownerB.cookie, { name: 'Invadido' })).status,
      404,
    );
  });

  await suite.test('usuário arquiva seu cliente', async () => {
    const response = await call('PATCH', `/clients/${clientAId}/archive`, ownerA.cookie, {});
    assert.equal(response.status, 200);
    assert.equal(typeof (await responseData(response)).archivedAt, 'string');
  });

  await suite.test('usuário não arquiva cliente alheio', async () => {
    assert.equal(
      (await call('PATCH', `/clients/${clientBId}/archive`, ownerA.cookie, {})).status,
      404,
    );
  });

  await suite.test('cliente arquivado não aparece na listagem padrão', async () => {
    assert.deepEqual(await listData(await call('GET', '/clients', ownerA.cookie)), []);
  });

  await suite.test('arquivados podem ser consultados', async () => {
    const clients = await listData(await call('GET', '/clients?status=archived', ownerA.cookie));
    assert.deepEqual(
      clients.map((client) => client.id),
      [clientAId],
    );
  });

  await suite.test('usuário não restaura cliente alheio', async () => {
    await call('PATCH', `/clients/${clientBId}/archive`, ownerB.cookie, {});
    assert.equal(
      (await call('PATCH', `/clients/${clientBId}/restore`, ownerA.cookie, {})).status,
      404,
    );
  });

  await suite.test('cliente arquivado pode ser restaurado', async () => {
    const response = await call('PATCH', `/clients/${clientAId}/restore`, ownerA.cookie, {});
    assert.equal(response.status, 200);
    assert.equal((await responseData(response)).archivedAt, null);
  });

  await suite.test('usuário não exclui cliente alheio', async () => {
    assert.equal((await call('DELETE', `/clients/${clientBId}`, ownerA.cookie)).status, 404);
    assert.equal((await call('DELETE', `/clients/${clientAId}`, ownerB.cookie)).status, 404);
    assert.equal(await database.client.count({ where: { id: { in: [clientAId, clientBId] } } }), 2);
  });

  await suite.test('exclusão permanente funciona', async () => {
    const disposable = await call('POST', '/clients', ownerA.cookie, {
      name: 'Cliente Descartável',
      email: 'disposable@example.test',
    });
    const disposableId = String((await responseData(disposable)).id);
    assert.equal((await call('DELETE', `/clients/${disposableId}`, ownerA.cookie)).status, 204);
    assert.equal(await database.client.count({ where: { id: disposableId } }), 0);
  });

  await suite.test('dados inválidos e userId enviado pelo cliente são rejeitados', async () => {
    for (const body of [
      { name: '   ', email: 'valid@example.test' },
      { name: 'Nome', email: 'invalid-email' },
      { name: 'Nome', email: 'valid@example.test', phone: 'x'.repeat(41) },
      { name: 'Nome', email: 'valid@example.test', company: 'x'.repeat(121) },
      { name: 'Nome', email: 'valid@example.test', userId: ownerB.userId },
    ]) {
      assert.equal((await call('POST', '/clients', ownerA.cookie, body)).status, 400);
    }
    assert.equal((await call('PATCH', `/clients/${clientAId}`, ownerA.cookie, {})).status, 400);
    assert.equal(
      (
        await call('PATCH', `/clients/${clientAId}`, ownerA.cookie, {
          userId: ownerB.userId,
        })
      ).status,
      400,
    );
  });

  await suite.test('cliente inexistente retorna 404 em todas as operações', async () => {
    const missing = randomUUID();
    for (const [method, path, body] of [
      ['GET', `/clients/${missing}`, undefined],
      ['PATCH', `/clients/${missing}`, { name: 'Ausente' }],
      ['PATCH', `/clients/${missing}/archive`, {}],
      ['PATCH', `/clients/${missing}/restore`, {}],
      ['DELETE', `/clients/${missing}`, undefined],
    ] as const) {
      assert.equal((await call(method, path, ownerA.cookie, body)).status, 404);
    }
  });
});
