import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';

const runId = randomUUID();
const emails = {
  a: `time-owner-a-${runId}@example.test`,
  b: `time-owner-b-${runId}@example.test`,
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

async function responseData(response: Response): Promise<Record<string, unknown>> {
  const body: unknown = await response.json();
  assert(body && typeof body === 'object' && 'data' in body);
  assert(body.data && typeof body.data === 'object' && !Array.isArray(body.data));
  return body.data as Record<string, unknown>;
}

async function listResponse(response: Response) {
  const body: unknown = await response.json();
  assert(body && typeof body === 'object' && 'data' in body && 'meta' in body);
  assert(Array.isArray(body.data));
  assert(body.meta && typeof body.meta === 'object');
  return {
    data: body.data as Record<string, unknown>[],
    meta: body.meta as Record<string, unknown>,
  };
}

async function register(name: string, email: string) {
  const response = await call('POST', '/auth/register', '', {
    name,
    email,
    password,
    timezone: 'America/Sao_Paulo',
  });
  assert.equal(response.status, 201);
  const data: unknown = await response.json();
  assert(data && typeof data === 'object' && 'user' in data);
  assert(data.user && typeof data.user === 'object' && 'id' in data.user);
  return { cookie: cookies(response), userId: String(data.user.id) };
}

async function createClient(cookie: string, name: string, email: string) {
  const response = await call('POST', '/clients', cookie, { name, email });
  assert.equal(response.status, 201);
  return String((await responseData(response)).id);
}

async function createProject(cookie: string, clientId: string, name: string) {
  const response = await call('POST', '/projects', cookie, {
    clientId,
    name,
    startDate: '2026-09-01',
    budget: '1000.00',
  });
  assert.equal(response.status, 201);
  return String((await responseData(response)).id);
}

function entryInput(overrides: Record<string, unknown> = {}) {
  return {
    description: '  Implementação da interface  ',
    workDate: '2026-09-15',
    durationMinutes: 90,
    ...overrides,
  };
}

async function createEntry(
  cookie: string,
  projectId: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await call(
    'POST',
    `/projects/${projectId}/time-entries`,
    cookie,
    entryInput(overrides),
  );
  assert.equal(response.status, 201);
  return responseData(response);
}

void test('registros de horas integrados com ownership e totais derivados', async (suite) => {
  const ownerA = await register('Proprietário A', emails.a);
  const ownerB = await register('Proprietário B', emails.b);
  const clientAId = await createClient(ownerA.cookie, 'Cliente A', `client-a-${runId}@test.dev`);
  const clientBId = await createClient(ownerB.cookie, 'Cliente B', `client-b-${runId}@test.dev`);
  const projectAId = await createProject(ownerA.cookie, clientAId, 'Projeto A');
  const totalsProjectId = await createProject(ownerA.cookie, clientAId, 'Projeto de Totais');
  const projectBId = await createProject(ownerB.cookie, clientBId, 'Projeto B');
  const archivedProjectId = await createProject(ownerA.cookie, clientAId, 'Projeto Arquivado');
  const archivedEntry = await createEntry(ownerA.cookie, archivedProjectId, {
    description: 'Registro preservado',
    durationMinutes: 15,
  });
  await call('PATCH', `/projects/${archivedProjectId}/archive`, ownerA.cookie, {});
  let entryAId = '';
  let entryBId = '';

  await suite.test('usuário autenticado cria TimeEntry em projeto próprio', async () => {
    const entry = await createEntry(ownerA.cookie, projectAId);
    entryAId = String(entry.id);
    assert.equal(entry.projectId, projectAId);
    assert.equal(entry.description, 'Implementação da interface');
    assert.equal(entry.workDate, '2026-09-15');
    assert.equal(entry.durationMinutes, 90);
    assert.equal('userId' in entry, false);
  });

  await suite.test('não autenticado não cria registro', async () => {
    assert.equal(
      (await call('POST', `/projects/${projectAId}/time-entries`, '', entryInput())).status,
      401,
    );
  });

  await suite.test('usuário não cria em projeto alheio ou inexistente', async () => {
    assert.equal(
      (await call('POST', `/projects/${projectBId}/time-entries`, ownerA.cookie, entryInput()))
        .status,
      404,
    );
    assert.equal(
      (await call('POST', `/projects/${randomUUID()}/time-entries`, ownerA.cookie, entryInput()))
        .status,
      404,
    );
  });

  await suite.test('projeto arquivado bloqueia criação', async () => {
    assert.equal(
      (
        await call(
          'POST',
          `/projects/${archivedProjectId}/time-entries`,
          ownerA.cookie,
          entryInput(),
        )
      ).status,
      409,
    );
  });

  await suite.test('duração inválida é rejeitada', async () => {
    for (const durationMinutes of [0, -1, 1.5, 1441]) {
      assert.equal(
        (
          await call(
            'POST',
            `/projects/${projectAId}/time-entries`,
            ownerA.cookie,
            entryInput({ durationMinutes }),
          )
        ).status,
        400,
      );
    }
  });

  await suite.test('data inválida é rejeitada', async () => {
    assert.equal(
      (
        await call(
          'POST',
          `/projects/${projectAId}/time-entries`,
          ownerA.cookie,
          entryInput({ workDate: '2026-02-30' }),
        )
      ).status,
      400,
    );
  });

  await suite.test('segundo usuário cria registro independente', async () => {
    entryBId = String((await createEntry(ownerB.cookie, projectBId)).id);
  });

  await suite.test('usuário lista somente seus registros', async () => {
    const resultA = await listResponse(await call('GET', '/time-entries', ownerA.cookie));
    const resultB = await listResponse(await call('GET', '/time-entries', ownerB.cookie));
    assert(resultA.data.some((entry) => entry.id === entryAId));
    assert(!resultA.data.some((entry) => entry.id === entryBId));
    assert.deepEqual(
      resultB.data.map((entry) => entry.id),
      [entryBId],
    );
  });

  await suite.test('listagem por projeto funciona e bloqueia projeto alheio', async () => {
    const nested = await listResponse(
      await call('GET', `/projects/${projectAId}/time-entries`, ownerA.cookie),
    );
    assert.deepEqual(
      nested.data.map((entry) => entry.id),
      [entryAId],
    );
    assert.equal(nested.meta.totalMinutes, 90);
    assert.equal(
      (await call('GET', `/projects/${projectBId}/time-entries`, ownerA.cookie)).status,
      404,
    );
  });

  await suite.test('filtros por projeto e cliente respeitam ownership', async () => {
    for (const query of [`projectId=${projectAId}`, `clientId=${clientAId}`]) {
      const result = await listResponse(await call('GET', `/time-entries?${query}`, ownerA.cookie));
      assert(result.data.some((entry) => entry.id === entryAId));
      assert(!result.data.some((entry) => entry.id === entryBId));
    }
  });

  await suite.test('filtro por intervalo de datas funciona', async () => {
    await createEntry(ownerA.cookie, projectAId, {
      description: 'Registro de outubro',
      workDate: '2026-10-05',
      durationMinutes: 30,
    });
    const september = await listResponse(
      await call('GET', '/time-entries?from=2026-09-01&to=2026-09-30', ownerA.cookie),
    );
    assert(september.data.some((entry) => entry.id === entryAId));
    assert(!september.data.some((entry) => entry.description === 'Registro de outubro'));
    assert.equal(
      (await call('GET', '/time-entries?from=2026-10-10&to=2026-09-01', ownerA.cookie)).status,
      400,
    );
  });

  await suite.test('busca por descrição funciona', async () => {
    const result = await listResponse(
      await call('GET', '/time-entries?q=implementa%C3%A7%C3%A3o', ownerA.cookie),
    );
    assert.deepEqual(
      result.data.map((entry) => entry.id),
      [entryAId],
    );
  });

  await suite.test('usuário visualiza e edita registro próprio', async () => {
    assert.equal((await call('GET', `/time-entries/${entryAId}`, ownerA.cookie)).status, 200);
    const response = await call('PATCH', `/time-entries/${entryAId}`, ownerA.cookie, {
      description: '  Revisão técnica  ',
      workDate: '2026-09-16',
      durationMinutes: 105,
    });
    assert.equal(response.status, 200);
    const entry = await responseData(response);
    assert.equal(entry.description, 'Revisão técnica');
    assert.equal(entry.workDate, '2026-09-16');
    assert.equal(entry.durationMinutes, 105);
    assert.equal(entry.projectId, projectAId);
  });

  await suite.test('isolamento bloqueia GET, PATCH e DELETE alheios', async () => {
    assert.equal((await call('GET', `/time-entries/${entryBId}`, ownerA.cookie)).status, 404);
    assert.equal(
      (
        await call('PATCH', `/time-entries/${entryBId}`, ownerA.cookie, {
          durationMinutes: 20,
        })
      ).status,
      404,
    );
    assert.equal((await call('DELETE', `/time-entries/${entryBId}`, ownerA.cookie)).status, 404);
  });

  await suite.test('projeto arquivado permite leitura e bloqueia edição e exclusão', async () => {
    const archivedId = String(archivedEntry.id);
    assert.equal(
      (await call('GET', `/projects/${archivedProjectId}/time-entries`, ownerA.cookie)).status,
      200,
    );
    assert.equal((await call('GET', `/time-entries/${archivedId}`, ownerA.cookie)).status, 200);
    assert.equal(
      (
        await call('PATCH', `/time-entries/${archivedId}`, ownerA.cookie, {
          durationMinutes: 30,
        })
      ).status,
      409,
    );
    assert.equal((await call('DELETE', `/time-entries/${archivedId}`, ownerA.cookie)).status, 409);
  });

  await suite.test('restaurar projeto reativa mutações', async () => {
    await call('PATCH', `/projects/${archivedProjectId}/restore`, ownerA.cookie, {});
    assert.equal(
      (
        await call('PATCH', `/time-entries/${String(archivedEntry.id)}`, ownerA.cookie, {
          durationMinutes: 20,
        })
      ).status,
      200,
    );
  });

  await suite.test('total deriva da soma exata dos minutos', async () => {
    await createEntry(ownerA.cookie, totalsProjectId, { durationMinutes: 30 });
    await createEntry(ownerA.cookie, totalsProjectId, { durationMinutes: 60 });
    await createEntry(ownerA.cookie, totalsProjectId, { durationMinutes: 90 });
    const result = await listResponse(
      await call('GET', `/projects/${totalsProjectId}/time-entries`, ownerA.cookie),
    );
    assert.equal(result.meta.count, 3);
    assert.equal(result.meta.totalMinutes, 180);
  });

  await suite.test('projectId e userId enviados pelo cliente são rejeitados', async () => {
    for (const body of [
      entryInput({ projectId: projectBId }),
      entryInput({ userId: ownerB.userId }),
    ]) {
      assert.equal(
        (await call('POST', `/projects/${projectAId}/time-entries`, ownerA.cookie, body)).status,
        400,
      );
    }
    assert.equal(
      (
        await call('PATCH', `/time-entries/${entryAId}`, ownerA.cookie, {
          projectId: projectBId,
        })
      ).status,
      400,
    );
  });

  await suite.test('usuário exclui registro próprio e o total é atualizado', async () => {
    const disposable = await createEntry(ownerA.cookie, projectAId, {
      description: 'Descartável',
      durationMinutes: 25,
    });
    assert.equal(
      (await call('DELETE', `/time-entries/${String(disposable.id)}`, ownerA.cookie)).status,
      204,
    );
    assert.equal(
      (await call('GET', `/time-entries/${String(disposable.id)}`, ownerA.cookie)).status,
      404,
    );
    const result = await listResponse(
      await call('GET', `/projects/${projectAId}/time-entries`, ownerA.cookie),
    );
    assert.equal(result.meta.totalMinutes, 135);
  });

  await suite.test('registro inexistente retorna 404', async () => {
    const missing = randomUUID();
    assert.equal((await call('GET', `/time-entries/${missing}`, ownerA.cookie)).status, 404);
    assert.equal(
      (
        await call('PATCH', `/time-entries/${missing}`, ownerA.cookie, {
          durationMinutes: 10,
        })
      ).status,
      404,
    );
    assert.equal((await call('DELETE', `/time-entries/${missing}`, ownerA.cookie)).status, 404);
  });
});
