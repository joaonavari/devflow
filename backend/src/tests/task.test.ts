import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';

const runId = randomUUID();
const emails = {
  a: `task-owner-a-${runId}@example.test`,
  b: `task-owner-b-${runId}@example.test`,
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

async function createProject(
  cookie: string,
  clientId: string,
  name: string,
  progressMode: 'MANUAL' | 'AUTO' = 'MANUAL',
  progress = 0,
) {
  const response = await call('POST', '/projects', cookie, {
    clientId,
    name,
    startDate: '2026-09-15',
    budget: '1000.00',
    progressMode,
    ...(progressMode === 'MANUAL' ? { progress } : {}),
  });
  assert.equal(response.status, 201);
  return String((await responseData(response)).id);
}

function taskInput(title: string, overrides: Record<string, unknown> = {}) {
  return {
    title,
    description: '  Trabalho bem definido.  ',
    priority: 'MEDIUM',
    status: 'TODO',
    dueDate: '2026-09-30',
    isClientVisible: false,
    ...overrides,
  };
}

async function createTask(cookie: string, projectId: string, title: string, overrides = {}) {
  const response = await call(
    'POST',
    `/projects/${projectId}/tasks`,
    cookie,
    taskInput(title, overrides),
  );
  assert.equal(response.status, 201);
  return responseData(response);
}

async function projectProgress(cookie: string, projectId: string): Promise<number> {
  const response = await call('GET', `/projects/${projectId}`, cookie);
  assert.equal(response.status, 200);
  return Number((await responseData(response)).progress);
}

void test('tarefas, Kanban, progresso e isolamento por projeto', async (suite) => {
  const ownerA = await register('Proprietário A', emails.a);
  const ownerB = await register('Proprietário B', emails.b);
  const clientAId = await createClient(
    ownerA.cookie,
    'Cliente A',
    `task-client-a-${runId}@test.dev`,
  );
  const clientBId = await createClient(
    ownerB.cookie,
    'Cliente B',
    `task-client-b-${runId}@test.dev`,
  );
  const manualProjectId = await createProject(
    ownerA.cookie,
    clientAId,
    'Projeto Manual',
    'MANUAL',
    37,
  );
  const autoProjectId = await createProject(ownerA.cookie, clientAId, 'Projeto Automático', 'AUTO');
  const projectBId = await createProject(ownerB.cookie, clientBId, 'Projeto B');
  const archivedProjectId = await createProject(ownerA.cookie, clientAId, 'Projeto Arquivado');
  await call('PATCH', `/projects/${archivedProjectId}/archive`, ownerA.cookie, {});
  let taskAId = '';
  let taskBId = '';

  await suite.test('usuário cria tarefa no projeto próprio com campos normalizados', async () => {
    const task = await createTask(ownerA.cookie, manualProjectId, '  Planejar interface  ', {
      priority: 'HIGH',
      isClientVisible: true,
    });
    taskAId = String(task.id);
    assert.equal(task.title, 'Planejar interface');
    assert.equal(task.description, 'Trabalho bem definido.');
    assert.equal(task.priority, 'HIGH');
    assert.equal(task.status, 'TODO');
    assert.equal(task.position, 0);
    assert.equal(task.completedAt, null);
    assert.equal(task.isClientVisible, true);
    assert.equal('userId' in task, false);
  });

  await suite.test('não autenticado não cria tarefa', async () => {
    assert.equal(
      (await call('POST', `/projects/${manualProjectId}/tasks`, '', taskInput('Sem sessão')))
        .status,
      401,
    );
  });

  await suite.test('usuário não cria em projeto alheio ou inexistente', async () => {
    assert.equal(
      (await call('POST', `/projects/${projectBId}/tasks`, ownerA.cookie, taskInput('Invasão')))
        .status,
      404,
    );
    assert.equal(
      (await call('POST', `/projects/${randomUUID()}/tasks`, ownerA.cookie, taskInput('Ausente')))
        .status,
      404,
    );
  });

  await suite.test('projeto arquivado permite leitura e bloqueia criação', async () => {
    assert.equal(
      (
        await call(
          'POST',
          `/projects/${archivedProjectId}/tasks`,
          ownerA.cookie,
          taskInput('Bloqueada'),
        )
      ).status,
      409,
    );
    assert.equal(
      (await call('GET', `/projects/${archivedProjectId}/tasks`, ownerA.cookie)).status,
      200,
    );
  });

  await suite.test('segundo usuário cria tarefa independente', async () => {
    taskBId = String((await createTask(ownerB.cookie, projectBId, 'Tarefa B')).id);
  });

  await suite.test('listagens global e por projeto respeitam ownership', async () => {
    const nested = await listData(
      await call('GET', `/projects/${manualProjectId}/tasks`, ownerA.cookie),
    );
    const globalA = await listData(await call('GET', '/tasks', ownerA.cookie));
    const globalB = await listData(await call('GET', '/tasks', ownerB.cookie));
    assert.deepEqual(
      nested.map((task) => task.id),
      [taskAId],
    );
    assert(globalA.some((task) => task.id === taskAId));
    assert(!globalA.some((task) => task.id === taskBId));
    assert.deepEqual(
      globalB.map((task) => task.id),
      [taskBId],
    );
    assert.equal((await call('GET', `/projects/${projectBId}/tasks`, ownerA.cookie)).status, 404);
  });

  await suite.test('usuário visualiza e edita tarefa própria', async () => {
    assert.equal((await call('GET', `/tasks/${taskAId}`, ownerA.cookie)).status, 200);
    const response = await call('PATCH', `/tasks/${taskAId}`, ownerA.cookie, {
      title: 'Interface aprovada',
      priority: 'URGENT',
      isClientVisible: false,
      dueDate: null,
    });
    assert.equal(response.status, 200);
    const task = await responseData(response);
    assert.equal(task.title, 'Interface aprovada');
    assert.equal(task.priority, 'URGENT');
    assert.equal(task.isClientVisible, false);
    assert.equal(task.dueDate, null);
  });

  await suite.test('isolamento bloqueia GET, PATCH, MOVE e DELETE alheios', async () => {
    assert.equal((await call('GET', `/tasks/${taskBId}`, ownerA.cookie)).status, 404);
    assert.equal(
      (await call('PATCH', `/tasks/${taskBId}`, ownerA.cookie, { title: 'Invadida' })).status,
      404,
    );
    assert.equal(
      (
        await call('PATCH', `/tasks/${taskBId}/move`, ownerA.cookie, {
          status: 'DONE',
          position: 0,
        })
      ).status,
      404,
    );
    assert.equal((await call('DELETE', `/tasks/${taskBId}`, ownerA.cookie)).status, 404);
  });

  await suite.test('busca e filtros de status e prioridade funcionam', async () => {
    await createTask(ownerA.cookie, manualProjectId, 'Revisar contrato', {
      description: 'Busca pelo conteúdo especial',
      status: 'IN_PROGRESS',
      priority: 'LOW',
    });
    for (const [query, expectedTitle] of [
      ['q=conte%C3%BAdo%20especial', 'Revisar contrato'],
      ['status=IN_PROGRESS', 'Revisar contrato'],
      ['priority=URGENT', 'Interface aprovada'],
    ] as const) {
      const tasks = await listData(
        await call('GET', `/projects/${manualProjectId}/tasks?${query}`, ownerA.cookie),
      );
      assert(tasks.some((task) => task.title === expectedTitle));
      assert(!tasks.some((task) => task.id === taskBId));
    }
  });

  await suite.test('entrada e saída de DONE controlam completedAt', async () => {
    const done = await call('PATCH', `/tasks/${taskAId}/move`, ownerA.cookie, {
      status: 'DONE',
      position: 0,
    });
    assert.equal(done.status, 200);
    assert.equal(typeof (await responseData(done)).completedAt, 'string');
    const reopened = await call('PATCH', `/tasks/${taskAId}/move`, ownerA.cookie, {
      status: 'TODO',
      position: 0,
    });
    assert.equal(reopened.status, 200);
    assert.equal((await responseData(reopened)).completedAt, null);
  });

  await suite.test('reordenação e movimento persistem posições sequenciais', async () => {
    const second = await createTask(ownerA.cookie, manualProjectId, 'Segunda pendente');
    const third = await createTask(ownerA.cookie, manualProjectId, 'Terceira pendente');
    assert.equal(
      (
        await call('PATCH', `/tasks/${String(third.id)}/move`, ownerA.cookie, {
          status: 'TODO',
          position: 0,
        })
      ).status,
      200,
    );
    const todo = (
      await listData(
        await call('GET', `/projects/${manualProjectId}/tasks?status=TODO`, ownerA.cookie),
      )
    ).sort((left, right) => Number(left.position) - Number(right.position));
    assert.equal(todo[0]?.id, third.id);
    assert.deepEqual(
      todo.map((task) => task.position),
      todo.map((_task, index) => index),
    );
    assert.equal(
      (
        await call('PATCH', `/tasks/${String(second.id)}/move`, ownerA.cookie, {
          status: 'IN_PROGRESS',
          position: 0,
        })
      ).status,
      200,
    );
    const moved = await responseData(
      await call('GET', `/tasks/${String(second.id)}`, ownerA.cookie),
    );
    assert.equal(moved.status, 'IN_PROGRESS');
    assert.equal(moved.position, 0);
  });

  await suite.test('projeto MANUAL mantém progresso quando tarefas mudam', async () => {
    assert.equal(await projectProgress(ownerA.cookie, manualProjectId), 37);
    await createTask(ownerA.cookie, manualProjectId, 'Concluída manual', { status: 'DONE' });
    assert.equal(await projectProgress(ownerA.cookie, manualProjectId), 37);
  });

  await suite.test(
    'progresso AUTO acompanha criação, conclusão, reabertura e exclusão',
    async () => {
      assert.equal(await projectProgress(ownerA.cookie, autoProjectId), 0);
      const done = await createTask(ownerA.cookie, autoProjectId, 'Feita', { status: 'DONE' });
      assert.equal(await projectProgress(ownerA.cookie, autoProjectId), 100);
      const pending = await createTask(ownerA.cookie, autoProjectId, 'Pendente');
      assert.equal(await projectProgress(ownerA.cookie, autoProjectId), 50);
      await call('PATCH', `/tasks/${String(pending.id)}/move`, ownerA.cookie, {
        status: 'DONE',
        position: 1,
      });
      assert.equal(await projectProgress(ownerA.cookie, autoProjectId), 100);
      await call('PATCH', `/tasks/${String(done.id)}/move`, ownerA.cookie, {
        status: 'TODO',
        position: 0,
      });
      assert.equal(await projectProgress(ownerA.cookie, autoProjectId), 50);
      assert.equal(
        (await call('DELETE', `/tasks/${String(pending.id)}`, ownerA.cookie)).status,
        204,
      );
      assert.equal(await projectProgress(ownerA.cookie, autoProjectId), 0);
    },
  );

  await suite.test('MANUAL → AUTO recalcula e AUTO → MANUAL congela o valor', async () => {
    const transitionProjectId = await createProject(
      ownerA.cookie,
      clientAId,
      'Projeto de Transição',
      'MANUAL',
      83,
    );
    const completed = await createTask(ownerA.cookie, transitionProjectId, 'Uma feita', {
      status: 'DONE',
    });
    await createTask(ownerA.cookie, transitionProjectId, 'Uma pendente');
    const automatic = await call('PATCH', `/projects/${transitionProjectId}`, ownerA.cookie, {
      progressMode: 'AUTO',
    });
    assert.equal(automatic.status, 200);
    assert.equal((await responseData(automatic)).progress, 50);
    const rejected = await call('PATCH', `/projects/${transitionProjectId}`, ownerA.cookie, {
      progress: 91,
    });
    assert.equal(rejected.status, 409);
    const manual = await call('PATCH', `/projects/${transitionProjectId}`, ownerA.cookie, {
      progressMode: 'MANUAL',
    });
    assert.equal(manual.status, 200);
    assert.equal((await responseData(manual)).progress, 50);
    await call('PATCH', `/tasks/${String(completed.id)}/move`, ownerA.cookie, {
      status: 'TODO',
      position: 0,
    });
    assert.equal(await projectProgress(ownerA.cookie, transitionProjectId), 50);
  });

  await suite.test('mutações de tarefa em projeto arquivado são bloqueadas', async () => {
    const mutableProjectId = await createProject(ownerA.cookie, clientAId, 'Será arquivado');
    const task = await createTask(ownerA.cookie, mutableProjectId, 'Somente leitura');
    await call('PATCH', `/projects/${mutableProjectId}/archive`, ownerA.cookie, {});
    assert.equal((await call('GET', `/tasks/${String(task.id)}`, ownerA.cookie)).status, 200);
    assert.equal(
      (await call('PATCH', `/tasks/${String(task.id)}`, ownerA.cookie, { title: 'Bloqueada' }))
        .status,
      409,
    );
    assert.equal(
      (
        await call('PATCH', `/tasks/${String(task.id)}/move`, ownerA.cookie, {
          status: 'DONE',
          position: 0,
        })
      ).status,
      409,
    );
    assert.equal((await call('DELETE', `/tasks/${String(task.id)}`, ownerA.cookie)).status, 409);
  });

  await suite.test('validação rejeita campos inválidos e identificadores do cliente', async () => {
    for (const body of [
      taskInput('   '),
      taskInput('Inválida', { priority: 'CRITICAL' }),
      taskInput('Inválida', { status: 'REVIEW' }),
      taskInput('Inválida', { position: 0 }),
      taskInput('Inválida', { projectId: projectBId }),
      taskInput('Inválida', { userId: ownerB.userId }),
    ]) {
      assert.equal(
        (await call('POST', `/projects/${manualProjectId}/tasks`, ownerA.cookie, body)).status,
        400,
      );
    }
  });

  await suite.test(
    'usuário exclui tarefa própria e posições restantes são normalizadas',
    async () => {
      const disposable = await createTask(ownerA.cookie, manualProjectId, 'Descartável');
      assert.equal(
        (await call('DELETE', `/tasks/${String(disposable.id)}`, ownerA.cookie)).status,
        204,
      );
      assert.equal(
        (await call('GET', `/tasks/${String(disposable.id)}`, ownerA.cookie)).status,
        404,
      );
      const grouped = await database.task.groupBy({
        by: ['status'],
        where: { projectId: manualProjectId },
        _count: { _all: true },
      });
      for (const group of grouped) {
        const positions = (
          await database.task.findMany({
            where: { projectId: manualProjectId, status: group.status },
            orderBy: { position: 'asc' },
            select: { position: true },
          })
        ).map((task) => task.position);
        assert.deepEqual(
          positions,
          positions.map((_position, index) => index),
        );
      }
    },
  );
});
