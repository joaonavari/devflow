import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';

const runId = randomUUID();
const emails = {
  a: `project-owner-a-${runId}@example.test`,
  b: `project-owner-b-${runId}@example.test`,
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
  return { cookie: cookies(response), userId: String(body.user.id) };
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

async function createClient(cookie: string, name: string, email: string) {
  const response = await call('POST', '/clients', cookie, { name, email });
  assert.equal(response.status, 201);
  return String((await responseData(response)).id);
}

function projectInput(clientId: string, name = 'Portal Aurora') {
  return {
    clientId,
    name,
    description: '  Entrega principal do trimestre.  ',
    status: 'PLANNING',
    startDate: '2026-09-15',
    dueDate: '2026-10-30',
    budget: '12500.50',
    progress: 10,
  };
}

void test('projetos integrados com isolamento por proprietário e cliente', async (suite) => {
  const ownerA = await register('Proprietário A', emails.a);
  const ownerB = await register('Proprietário B', emails.b);
  const clientAId = await createClient(ownerA.cookie, 'Cliente Aurora', 'aurora@example.test');
  const clientBId = await createClient(ownerB.cookie, 'Cliente Boreal', 'boreal@example.test');
  let projectAId = '';
  let projectBId = '';

  await suite.test('usuário autenticado cria projeto para cliente próprio', async () => {
    const response = await call('POST', '/projects', ownerA.cookie, projectInput(clientAId));
    assert.equal(response.status, 201);
    const project = await responseData(response);
    projectAId = String(project.id);
    assert.equal(project.name, 'Portal Aurora');
    assert.equal(project.description, 'Entrega principal do trimestre.');
    assert.equal(project.startDate, '2026-09-15');
    assert.equal(project.dueDate, '2026-10-30');
    assert.equal(project.budget, '12500.50');
    assert.equal(project.progress, 10);
    assert.equal(project.clientId, clientAId);
    assert.equal('userId' in project, false);
    assert.deepEqual(project.client, {
      id: clientAId,
      name: 'Cliente Aurora',
      email: 'aurora@example.test',
      archivedAt: null,
    });
  });

  await suite.test('usuário não autenticado não cria projeto', async () => {
    assert.equal((await call('POST', '/projects', '', projectInput(clientAId))).status, 401);
  });

  await suite.test('usuário não cria projeto para cliente alheio ou inexistente', async () => {
    assert.equal(
      (await call('POST', '/projects', ownerA.cookie, projectInput(clientBId, 'Invasão'))).status,
      404,
    );
    assert.equal(
      (await call('POST', '/projects', ownerA.cookie, projectInput(randomUUID(), 'Ausente')))
        .status,
      404,
    );
  });

  await suite.test('segundo usuário cria projeto independente', async () => {
    const response = await call(
      'POST',
      '/projects',
      ownerB.cookie,
      projectInput(clientBId, 'Projeto Boreal'),
    );
    assert.equal(response.status, 201);
    projectBId = String((await responseData(response)).id);
  });

  await suite.test('usuário lista somente seus projetos', async () => {
    const projectsA = await listData(await call('GET', '/projects', ownerA.cookie));
    const projectsB = await listData(await call('GET', '/projects', ownerB.cookie));
    assert.deepEqual(
      projectsA.map((project) => project.id),
      [projectAId],
    );
    assert.deepEqual(
      projectsB.map((project) => project.id),
      [projectBId],
    );
  });

  await suite.test('busca encontra projeto pelo nome e pelo nome do cliente', async () => {
    for (const search of ['portal', 'cliente aurora']) {
      const projects = await listData(
        await call('GET', `/projects?q=${encodeURIComponent(search)}`, ownerA.cookie),
      );
      assert.deepEqual(
        projects.map((project) => project.id),
        [projectAId],
      );
    }
    assert.deepEqual(
      await listData(await call('GET', '/projects?q=Cliente%20Boreal', ownerA.cookie)),
      [],
    );
  });

  await suite.test('filtros por status e cliente respeitam ownership', async () => {
    assert.deepEqual(
      (await listData(await call('GET', '/projects?status=PLANNING', ownerA.cookie))).map(
        (project) => project.id,
      ),
      [projectAId],
    );
    assert.deepEqual(
      (await listData(await call('GET', `/projects?clientId=${clientAId}`, ownerA.cookie))).map(
        (project) => project.id,
      ),
      [projectAId],
    );
    assert.deepEqual(
      await listData(await call('GET', `/projects?clientId=${clientBId}`, ownerA.cookie)),
      [],
    );
  });

  await suite.test('usuário visualiza projeto próprio', async () => {
    const response = await call('GET', `/projects/${projectAId}`, ownerA.cookie);
    assert.equal(response.status, 200);
    assert.equal((await responseData(response)).id, projectAId);
  });

  await suite.test('usuários não visualizam projetos alheios', async () => {
    assert.equal((await call('GET', `/projects/${projectBId}`, ownerA.cookie)).status, 404);
    assert.equal((await call('GET', `/projects/${projectAId}`, ownerB.cookie)).status, 404);
  });

  await suite.test('usuário edita projeto próprio, status, progresso e orçamento', async () => {
    const response = await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, {
      name: 'Portal Aurora 2.0',
      status: 'IN_PROGRESS',
      progress: 45,
      budget: '13000.00',
      dueDate: '2026-11-10',
    });
    assert.equal(response.status, 200);
    const project = await responseData(response);
    assert.equal(project.name, 'Portal Aurora 2.0');
    assert.equal(project.status, 'IN_PROGRESS');
    assert.equal(project.progress, 45);
    assert.equal(project.budget, '13000.00');
    assert.equal(project.dueDate, '2026-11-10');
  });

  await suite.test('usuários não editam projetos alheios', async () => {
    assert.equal(
      (await call('PATCH', `/projects/${projectBId}`, ownerA.cookie, { name: 'Invadido' })).status,
      404,
    );
    assert.equal(
      (await call('PATCH', `/projects/${projectAId}`, ownerB.cookie, { name: 'Invadido' })).status,
      404,
    );
  });

  await suite.test('usuário não altera projeto para cliente alheio', async () => {
    assert.equal(
      (await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, { clientId: clientBId }))
        .status,
      404,
    );
    assert.equal(
      (await database.project.findUniqueOrThrow({ where: { id: projectAId } })).clientId,
      clientAId,
    );
  });

  await suite.test('validação de datas considera criação e atualização parcial', async () => {
    assert.equal(
      (
        await call('POST', '/projects', ownerA.cookie, {
          ...projectInput(clientAId, 'Datas inválidas'),
          dueDate: '2026-09-14',
        })
      ).status,
      400,
    );
    assert.equal(
      (await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, { dueDate: '2026-09-14' }))
        .status,
      400,
    );
    assert.equal(
      (await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, { startDate: '2026-12-01' }))
        .status,
      400,
    );
  });

  await suite.test('budget negativo e contrato numérico incorreto são rejeitados', async () => {
    assert.equal(
      (
        await call('POST', '/projects', ownerA.cookie, {
          ...projectInput(clientAId),
          budget: '-0.01',
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('POST', '/projects', ownerA.cookie, {
          ...projectInput(clientAId),
          budget: 10.5,
        })
      ).status,
      400,
    );
  });

  await suite.test('progress abaixo de zero ou acima de cem é rejeitado', async () => {
    for (const progress of [-1, 101]) {
      assert.equal(
        (
          await call('POST', '/projects', ownerA.cookie, {
            ...projectInput(clientAId),
            progress,
          })
        ).status,
        400,
      );
    }
  });

  await suite.test('usuário arquiva seu projeto', async () => {
    const response = await call('PATCH', `/projects/${projectAId}/archive`, ownerA.cookie, {});
    assert.equal(response.status, 200);
    assert.equal(typeof (await responseData(response)).archivedAt, 'string');
  });

  await suite.test('usuário não arquiva projeto alheio', async () => {
    assert.equal(
      (await call('PATCH', `/projects/${projectBId}/archive`, ownerA.cookie, {})).status,
      404,
    );
  });

  await suite.test('projeto arquivado sai da listagem padrão e aparece no filtro', async () => {
    assert.deepEqual(await listData(await call('GET', '/projects', ownerA.cookie)), []);
    assert.deepEqual(
      (await listData(await call('GET', '/projects?view=archived', ownerA.cookie))).map(
        (project) => project.id,
      ),
      [projectAId],
    );
  });

  await suite.test('usuário não restaura projeto alheio', async () => {
    await call('PATCH', `/projects/${projectBId}/archive`, ownerB.cookie, {});
    assert.equal(
      (await call('PATCH', `/projects/${projectBId}/restore`, ownerA.cookie, {})).status,
      404,
    );
  });

  await suite.test('usuário restaura seu projeto', async () => {
    const response = await call('PATCH', `/projects/${projectAId}/restore`, ownerA.cookie, {});
    assert.equal(response.status, 200);
    assert.equal((await responseData(response)).archivedAt, null);
  });

  await suite.test('usuário não exclui projeto alheio', async () => {
    assert.equal((await call('DELETE', `/projects/${projectBId}`, ownerA.cookie)).status, 404);
    assert.equal((await call('DELETE', `/projects/${projectAId}`, ownerB.cookie)).status, 404);
    assert.equal(
      await database.project.count({ where: { id: { in: [projectAId, projectBId] } } }),
      2,
    );
  });

  await suite.test('exclusão permanente de projeto funciona', async () => {
    const clientId = await createClient(
      ownerA.cookie,
      'Cliente Descartável',
      'project-disposable@example.test',
    );
    const created = await call(
      'POST',
      '/projects',
      ownerA.cookie,
      projectInput(clientId, 'Projeto Descartável'),
    );
    const projectId = String((await responseData(created)).id);
    assert.equal((await call('DELETE', `/clients/${clientId}`, ownerA.cookie)).status, 409);
    assert.equal((await call('DELETE', `/projects/${projectId}`, ownerA.cookie)).status, 204);
    assert.equal((await call('DELETE', `/clients/${clientId}`, ownerA.cookie)).status, 204);
  });

  await suite.test(
    'cliente com projeto não pode ser excluído, mas pode ser arquivado',
    async () => {
      const blocked = await call('DELETE', `/clients/${clientAId}`, ownerA.cookie);
      assert.equal(blocked.status, 409);
      const body: unknown = await blocked.json();
      assert.deepEqual(body, {
        error: {
          code: 'CLIENT_HAS_PROJECTS',
          message: 'Este cliente possui projetos e não pode ser excluído permanentemente.',
        },
      });
      assert.equal(
        (await call('PATCH', `/clients/${clientAId}/archive`, ownerA.cookie, {})).status,
        200,
      );
    },
  );

  await suite.test('cliente arquivado mantém projeto existente acessível', async () => {
    const response = await call('GET', `/projects/${projectAId}`, ownerA.cookie);
    assert.equal(response.status, 200);
    const project = await responseData(response);
    assert.equal(project.id, projectAId);
    assert.equal(
      typeof project.client === 'object' &&
        project.client !== null &&
        'archivedAt' in project.client,
      true,
    );
  });

  await suite.test('cliente arquivado não aceita projeto novo nem nova associação', async () => {
    assert.equal(
      (
        await call(
          'POST',
          '/projects',
          ownerA.cookie,
          projectInput(clientAId, 'Projeto em cliente arquivado'),
        )
      ).status,
      404,
    );
    const archivedClientId = await createClient(
      ownerA.cookie,
      'Outro Arquivado',
      'other-archived@example.test',
    );
    await call('PATCH', `/clients/${archivedClientId}/archive`, ownerA.cookie, {});
    assert.equal(
      (
        await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, {
          clientId: archivedClientId,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, {
          clientId: clientAId,
          name: 'Projeto ainda acessível',
        })
      ).status,
      200,
    );
  });

  await suite.test('campos inválidos e userId enviado pelo cliente são rejeitados', async () => {
    for (const body of [
      { ...projectInput(clientAId), name: '   ' },
      { ...projectInput(clientAId), description: 'x'.repeat(2001) },
      { ...projectInput(clientAId), status: 'UNKNOWN' },
      { ...projectInput(clientAId), userId: ownerB.userId },
    ]) {
      assert.equal((await call('POST', '/projects', ownerA.cookie, body)).status, 400);
    }
    assert.equal((await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, {})).status, 400);
    assert.equal(
      (
        await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, {
          userId: ownerB.userId,
        })
      ).status,
      400,
    );
  });

  await suite.test('projeto inexistente retorna 404 em todas as operações', async () => {
    const missing = randomUUID();
    for (const [method, path, body] of [
      ['GET', `/projects/${missing}`, undefined],
      ['PATCH', `/projects/${missing}`, { name: 'Ausente' }],
      ['PATCH', `/projects/${missing}/archive`, {}],
      ['PATCH', `/projects/${missing}/restore`, {}],
      ['DELETE', `/projects/${missing}`, undefined],
    ] as const) {
      assert.equal((await call(method, path, ownerA.cookie, body)).status, 404);
    }
  });
});
