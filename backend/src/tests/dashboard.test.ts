import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';

const runId = randomUUID();
const emails = {
  empty: `dashboard-empty-${runId}@example.test`,
  a: `dashboard-owner-a-${runId}@example.test`,
  b: `dashboard-owner-b-${runId}@example.test`,
};
const password = 'DevFlow8';
const timeZone = 'America/Sao_Paulo';
const server = app.listen(0, '127.0.0.1');
let base = '';

interface DashboardData {
  period: 'TODAY' | '7D' | '30D';
  periodStart: string;
  summary: {
    activeProjects: number;
    openTasks: number;
    trackedMinutes: number;
    pendingAmount: string;
    overdueAmount: string;
  };
  projects: { id: string; name: string; progress: number }[];
  tasks: {
    counts: { todo: number; inProgress: number; doneInPeriod: number };
    attention: { id: string; title: string; dueDate: string; isOverdue: boolean }[];
  };
  hours: {
    totalMinutes: number;
    byProject: { projectId: string; projectName: string; totalMinutes: number }[];
  };
  finance: { paidInPeriod: string; pendingCurrent: string; overdueCurrent: string };
  recentActivity: { id: string; label: string; href: string }[];
}

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
    .map((value) => value.split(';')[0] ?? '')
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

async function dashboard(cookie: string, period = '30D'): Promise<DashboardData> {
  const response = await call('GET', `/dashboard?period=${period}`, cookie);
  assert.equal(response.status, 200);
  return (await responseData(response)) as unknown as DashboardData;
}

async function register(name: string, email: string) {
  const response = await call('POST', '/auth/register', '', {
    name,
    email,
    password,
    timezone: timeZone,
  });
  assert.equal(response.status, 201);
  const body: unknown = await response.json();
  assert(body && typeof body === 'object' && 'user' in body);
  assert(body.user && typeof body.user === 'object' && 'id' in body.user);
  return { cookie: cookies(response), userId: String(body.user.id) };
}

async function createClient(cookie: string, name: string) {
  const response = await call('POST', '/clients', cookie, {
    name,
    email: `${randomUUID()}@test.dev`,
  });
  assert.equal(response.status, 201);
  return String((await responseData(response)).id);
}

async function createProject(cookie: string, clientId: string, name: string) {
  const response = await call('POST', '/projects', cookie, {
    clientId,
    name,
    startDate: dateWithOffset(-60),
    dueDate: dateWithOffset(10),
    budget: '10000.00',
  });
  assert.equal(response.status, 201);
  return String((await responseData(response)).id);
}

async function createTask(
  cookie: string,
  projectId: string,
  title: string,
  status: 'TODO' | 'IN_PROGRESS' | 'DONE',
  dueDate: string,
) {
  const response = await call('POST', `/projects/${projectId}/tasks`, cookie, {
    title,
    status,
    dueDate,
    priority: 'HIGH',
    isClientVisible: false,
  });
  assert.equal(response.status, 201);
  return responseData(response);
}

async function createTimeEntry(
  cookie: string,
  projectId: string,
  workDate: string,
  durationMinutes: number,
) {
  const response = await call('POST', `/projects/${projectId}/time-entries`, cookie, {
    description: 'Trabalho no dashboard',
    workDate,
    durationMinutes,
  });
  assert.equal(response.status, 201);
}

async function createPayment(
  cookie: string,
  projectId: string,
  description: string,
  amount: string,
  dueDate: string,
) {
  const response = await call('POST', `/projects/${projectId}/payments`, cookie, {
    description,
    amount,
    dueDate,
  });
  assert.equal(response.status, 201);
  return responseData(response);
}

function today(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateWithOffset(offsetDays: number): string {
  const date = new Date(`${today()}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

void test('dashboard executivo agrega somente dados do usuário autenticado', async (suite) => {
  const empty = await register('Conta vazia', emails.empty);

  await suite.test('endpoint exige autenticação', async () => {
    assert.equal((await call('GET', '/dashboard')).status, 401);
  });

  await suite.test('conta vazia retorna contrato completo com zeros', async () => {
    const data = await dashboard(empty.cookie);
    assert.equal(data.period, '30D');
    assert.deepEqual(data.summary, {
      activeProjects: 0,
      openTasks: 0,
      trackedMinutes: 0,
      pendingAmount: '0.00',
      overdueAmount: '0.00',
    });
    assert.deepEqual(data.projects, []);
    assert.deepEqual(data.tasks.attention, []);
    assert.deepEqual(data.hours.byProject, []);
    assert.deepEqual(data.recentActivity, []);
  });

  const ownerA = await register('Proprietário Dashboard A', emails.a);
  const ownerB = await register('Proprietário Dashboard B', emails.b);
  const clientAId = await createClient(ownerA.cookie, 'Cliente Dashboard A');
  const clientBId = await createClient(ownerB.cookie, 'Cliente Dashboard B');
  const projectAId = await createProject(ownerA.cookie, clientAId, 'Projeto Dashboard A');
  const archivedProjectId = await createProject(ownerA.cookie, clientAId, 'Projeto Arquivado A');
  const projectBId = await createProject(ownerB.cookie, clientBId, 'Projeto Dashboard B');
  await call('PATCH', `/projects/${archivedProjectId}/archive`, ownerA.cookie, {});

  const overdueTask = await createTask(
    ownerA.cookie,
    projectAId,
    'Tarefa atrasada A',
    'TODO',
    dateWithOffset(-1),
  );
  await createTask(
    ownerA.cookie,
    projectAId,
    'Tarefa em andamento A',
    'IN_PROGRESS',
    dateWithOffset(1),
  );
  await createTask(ownerA.cookie, projectAId, 'Tarefa concluída A', 'DONE', dateWithOffset(-2));
  for (let index = 0; index < 5; index += 1) {
    await createTask(
      ownerA.cookie,
      projectAId,
      `Tarefa atenção ${String(index)}`,
      'TODO',
      dateWithOffset(index + 2),
    );
  }
  await createTask(ownerB.cookie, projectBId, 'Tarefa secreta B', 'TODO', dateWithOffset(-5));

  await createTimeEntry(ownerA.cookie, projectAId, today(), 90);
  await createTimeEntry(ownerA.cookie, projectAId, dateWithOffset(-40), 30);
  await createTimeEntry(ownerB.cookie, projectBId, today(), 999);

  await createPayment(ownerA.cookie, projectAId, 'Pendente atual A', '100.10', dateWithOffset(1));
  await createPayment(ownerA.cookie, projectAId, 'Vencida A', '200.20', dateWithOffset(-1));
  const paidA = await createPayment(
    ownerA.cookie,
    projectAId,
    'Paga A',
    '300.30',
    dateWithOffset(-3),
  );
  await call('PATCH', `/payments/${String(paidA.id)}/pay`, ownerA.cookie, {});
  await createPayment(
    ownerB.cookie,
    projectBId,
    'Cobrança secreta B',
    '9999.99',
    dateWithOffset(-10),
  );

  const data = await dashboard(ownerA.cookie);

  await suite.test('projetos ativos excluem arquivados e lista é limitada', () => {
    assert.equal(data.summary.activeProjects, 1);
    assert(data.projects.length <= 5);
    assert(data.projects.some((project) => project.id === projectAId));
    assert(!data.projects.some((project) => project.id === archivedProjectId));
  });

  await suite.test('tarefas abertas e DONE no período são calculadas corretamente', () => {
    assert.deepEqual(data.tasks.counts, { todo: 6, inProgress: 1, doneInPeriod: 1 });
    assert.equal(data.summary.openTasks, 7);
  });

  await suite.test('tarefa atrasada é derivada e atenção respeita limite', () => {
    assert(data.tasks.attention.length <= 5);
    const task = data.tasks.attention.find((candidate) => candidate.id === overdueTask.id);
    assert(task);
    assert.equal(task.isOverdue, true);
    assert.equal(task.dueDate, dateWithOffset(-1));
  });

  await suite.test('horas respeitam período e ignoram dados antigos e alheios', () => {
    assert.equal(data.summary.trackedMinutes, 90);
    assert.equal(data.hours.totalMinutes, 90);
    assert.deepEqual(
      data.hours.byProject.map((project) => project.projectId),
      [projectAId],
    );
  });

  await suite.test('períodos fechados retornam início coerente', async () => {
    const todayData = await dashboard(ownerA.cookie, 'TODAY');
    const sevenDays = await dashboard(ownerA.cookie, '7D');
    assert.equal(todayData.periodStart, today());
    assert.equal(sevenDays.periodStart, dateWithOffset(-6));
    assert.equal(todayData.summary.trackedMinutes, 90);
    assert.equal((await call('GET', '/dashboard?period=INVALID', ownerA.cookie)).status, 400);
  });

  await suite.test('financeiro mantém Decimal e separa atual de período', () => {
    assert.equal(data.summary.pendingAmount, '300.30');
    assert.equal(data.summary.overdueAmount, '200.20');
    assert.deepEqual(data.finance, {
      paidInPeriod: '300.30',
      pendingCurrent: '300.30',
      overdueCurrent: '200.20',
    });
  });

  await suite.test('Payment pago com vencimento passado não entra em overdue', () => {
    assert.equal(data.finance.overdueCurrent, '200.20');
  });

  await suite.test('atividade recente é limitada, navegável e sem dados alheios', () => {
    assert(data.recentActivity.length <= 8);
    assert(data.recentActivity.every((activity) => activity.href.startsWith('/projetos/')));
    assert(!data.recentActivity.some((activity) => activity.label.includes('secreta B')));
    assert(!data.recentActivity.some((activity) => activity.href.includes(projectBId)));
  });

  await suite.test('usuário A nunca recebe agregações do usuário B', () => {
    const serialized = JSON.stringify(data);
    assert(!serialized.includes('Dashboard B'));
    assert(!serialized.includes('9999.99'));
    assert(!serialized.includes(projectBId));
    assert.equal(data.summary.trackedMinutes, 90);
  });

  await suite.test('usuário B recebe exclusivamente seus próprios totais', async () => {
    const dataB = await dashboard(ownerB.cookie);
    assert.equal(dataB.summary.activeProjects, 1);
    assert.equal(dataB.summary.openTasks, 1);
    assert.equal(dataB.summary.trackedMinutes, 999);
    assert.equal(dataB.summary.pendingAmount, '9999.99');
    assert.equal(dataB.summary.overdueAmount, '9999.99');
    assert(!JSON.stringify(dataB).includes('Dashboard A'));
  });
  await suite.test(
    'progresso AUTO acompanha tarefas; MANUAL permanece informado e DTO não expõe contagens',
    async () => {
      assert.equal(
        (await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, { progressMode: 'AUTO' }))
          .status,
        200,
      );
      let result = (await dashboard(ownerA.cookie)).projects.find(
        (project) => project.id === projectAId,
      );
      assert.equal(result?.progress, 13);
      assert(!JSON.stringify(result).includes('_count'));
      assert(!JSON.stringify(result).includes('progressMode'));
      await call('PATCH', `/tasks/${String(overdueTask.id)}`, ownerA.cookie, { status: 'DONE' });
      result = (await dashboard(ownerA.cookie)).projects.find(
        (project) => project.id === projectAId,
      );
      assert.equal(result?.progress, 25);
      await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, { progressMode: 'MANUAL' });
      await call('PATCH', `/projects/${projectAId}`, ownerA.cookie, { progress: 42 });
      assert.equal(
        (await dashboard(ownerA.cookie)).projects.find((project) => project.id === projectAId)
          ?.progress,
        42,
      );
    },
  );
  await suite.test(
    'total de horas inclui projetos fora do top 5 sem incluir outro proprietário',
    async () => {
      for (let index = 0; index < 6; index++) {
        const id = await createProject(ownerA.cookie, clientAId, `Projeto extra ${String(index)}`);
        await createTimeEntry(ownerA.cookie, id, today(), 10);
      }
      const result = await dashboard(ownerA.cookie);
      assert.equal(result.hours.byProject.length, 5);
      assert.equal(result.summary.trackedMinutes, 150);
      assert.equal(result.hours.totalMinutes, 150);
      assert.equal(
        result.hours.byProject.reduce((total, item) => total + item.totalMinutes, 0),
        130,
      );
    },
  );
});
