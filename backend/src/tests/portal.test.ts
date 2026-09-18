import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { database } from '../config/database.js';
import { portalTestContext, data } from './portal-test-support.js';

const { call, owner } = portalTestContext('portal');
interface Link {
  url: string;
  active: boolean;
  link: { expiresAt: string };
}
interface PublicData {
  project: { name: string; description: string; progress: number };
  tasks: { title: string }[];
  stages: { title: string }[];
}
const tokenPath = (url: string) => new URL(url).pathname;

void test('portal: credencial, ownership e contrato público mínimo', async (suite) => {
  const a = await owner('A');
  const b = await owner('B');
  const admin = `/projects/${a.project.id}/portal`;
  const other = `/projects/${b.project.id}/portal`;
  let url = '';
  await suite.test(
    'somente proprietário gera; não autenticado 401 e acesso cruzado 404',
    async () => {
      assert.equal((await call('POST', admin, '', {})).status, 401);
      const ownB = await call('POST', other, b.cookie, {});
      assert.equal(ownB.status, 201);
      const linkB = await data<Link>(ownB);
      for (const method of ['GET', 'POST', 'DELETE'])
        assert.equal(
          (await call(method, other, a.cookie, method === 'POST' ? {} : undefined)).status,
          404,
        );
      assert.equal((await call('GET', tokenPath(linkB.url))).status, 200);
      assert.equal(
        (await data<{ active: boolean }>(await call('GET', other, b.cookie))).active,
        true,
      );
      assert.equal((await call('GET', admin, a.cookie)).status, 200);
      const response = await call('POST', admin, a.cookie, {});
      assert.equal(response.status, 201);
      const result = await data<Link>(response);
      url = result.url;
      assert.equal(result.active, true);
      assert(
        Math.abs(new Date(result.link.expiresAt).getTime() - Date.now() - 30 * 86400000) < 10000,
      );
    },
  );
  await suite.test(
    'token 256 bits; banco contém somente hash; GET não recupera credencial',
    async () => {
      const token = tokenPath(url).split('/').at(-1) ?? '';
      assert.match(token, /^[A-Za-z0-9_-]{43}$/);
      const stored = await database.portalLink.findUniqueOrThrow({
        where: { projectId: a.project.id },
      });
      assert.equal(stored.tokenHash, createHash('sha256').update(token).digest('hex'));
      assert(!JSON.stringify(stored).includes(token));
      const result = await (await call('GET', admin, a.cookie)).text();
      assert(!result.includes(token));
      assert(!result.includes('tokenHash'));
      assert(!result.includes('url'));
    },
  );
  await suite.test('validade restrita e campos de ownership/token rejeitados', async () => {
    for (const body of [
      { validityDays: 0 },
      { validityDays: 365 },
      { validityDays: null },
      { projectId: b.project.id },
      { token: 'manual' },
    ])
      assert.equal((await call('POST', admin, a.cookie, body)).status, 400);
  });
  await database.task.createMany({
    data: [
      { projectId: a.project.id, title: 'Tarefa pública', isClientVisible: true },
      {
        projectId: a.project.id,
        title: 'Tarefa privada secreta',
        isClientVisible: false,
        status: 'DONE',
        completedAt: new Date(),
      },
      { projectId: b.project.id, title: 'Tarefa B secreta', isClientVisible: true },
    ],
  });
  await database.projectStage.createMany({
    data: [
      { projectId: a.project.id, title: 'Etapa pública', isClientVisible: true },
      { projectId: a.project.id, title: 'Etapa privada secreta', isClientVisible: false },
      { projectId: b.project.id, title: 'Etapa B secreta', isClientVisible: true },
    ],
  });
  await database.payment.create({
    data: {
      projectId: a.project.id,
      description: 'Pagamento secreto',
      amount: '6543.21',
      dueDate: new Date('2026-09-01'),
    },
  });
  await database.timeEntry.create({
    data: {
      projectId: a.project.id,
      description: 'Horas secretas',
      durationMinutes: 123,
      workDate: new Date('2026-09-01'),
    },
  });
  await suite.test(
    'sem sessão e com sessão alheia: somente allowlist, sem dados privados',
    async () => {
      for (const cookie of ['', b.cookie]) {
        const response = await call('GET', tokenPath(url), cookie);
        assert.equal(response.status, 200);
        const result = await data<PublicData>(response);
        assert.deepEqual(Object.keys(result).sort(), ['project', 'stages', 'tasks']);
        assert.deepEqual(Object.keys(result.project).sort(), [
          'description',
          'dueDate',
          'name',
          'progress',
          'startDate',
          'status',
        ]);
        assert.equal(result.project.name, a.project.name);
        assert.equal(result.project.progress, 37);
        assert.equal(result.tasks.length, 1);
        assert.equal(result.tasks[0]?.title, 'Tarefa pública');
        assert.deepEqual(Object.keys(result.tasks[0]).sort(), [
          'completedAt',
          'description',
          'dueDate',
          'priority',
          'status',
          'title',
        ]);
        assert.deepEqual(result.stages, [{ title: 'Etapa pública', status: 'PENDING' }]);
        const raw = JSON.stringify(result);
        for (const forbidden of [
          'budget',
          'payments',
          'Payments',
          'timeEntries',
          'TimeEntries',
          'durationMinutes',
          'tokenHash',
          'passwordHash',
          'sessions',
          'AuthSession',
          'userId',
          'clientId',
          'projectId',
          a.user.email,
          b.user.email,
          a.project.id,
          b.project.id,
          'secreta',
          'secreto',
          '9999.99',
          '6543.21',
        ])
          assert(!raw.includes(forbidden), `Campo proibido: ${forbidden}`);
      }
    },
  );
  await suite.test(
    'AUTO reutiliza progresso oficial incluindo tarefas internas sem expô-las',
    async () => {
      await database.project.update({
        where: { id: a.project.id },
        data: { progressMode: 'AUTO' },
      });
      const result = await data<PublicData>(await call('GET', tokenPath(url)));
      const project = await data<{ progress: number }>(
        await call('GET', `/projects/${a.project.id}`, a.cookie),
      );
      assert.equal(result.project.progress, project.progress);
      assert.equal(result.project.progress, 50);
    },
  );
  await suite.test(
    'token não permite mutações nem seleciona outro projeto por query ou caminho',
    async () => {
      for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
        assert.equal((await call(method, tokenPath(url), '', { name: 'Intrusão' })).status, 404);
      }
      const result = await data<PublicData>(
        await call(
          'GET',
          `${tokenPath(url)}?projectId=${b.project.id}&include=payments,timeEntries`,
        ),
      );
      assert.equal(result.project.name, a.project.name);
      assert.deepEqual(Object.keys(result).sort(), ['project', 'stages', 'tasks']);
      assert.equal((await call('GET', `${tokenPath(url)}/projects/${b.project.id}`)).status, 404);
      assert.equal(
        (await call('GET', `${admin}?token=${tokenPath(url).split('/').at(-1) ?? ''}`)).status,
        401,
      );
    },
  );
  await suite.test(
    'ocultar tarefa e etapa remove os dados na próxima leitura pública',
    async () => {
      const task = await database.task.findFirstOrThrow({
        where: { projectId: a.project.id, isClientVisible: true },
      });
      const stage = await database.projectStage.findFirstOrThrow({
        where: { projectId: a.project.id, isClientVisible: true },
      });
      for (const path of [`/tasks/${task.id}`, `/project-stages/${stage.id}`]) {
        assert.equal((await call('PATCH', path, b.cookie, { isClientVisible: false })).status, 404);
        assert.equal((await call('PATCH', path, a.cookie, { isClientVisible: false })).status, 200);
      }
      const result = await data<PublicData>(await call('GET', tokenPath(url)));
      assert.deepEqual(result.tasks, []);
      assert.deepEqual(result.stages, []);
    },
  );
  await suite.test(
    'headers de privacidade em sucesso e falha; ausência de Set-Cookie',
    async () => {
      for (const path of [tokenPath(url), '/portal/invalid']) {
        const response = await call('GET', path);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.equal(response.headers.get('pragma'), 'no-cache');
        assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
        assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
        assert.equal(response.headers.get('set-cookie'), null);
      }
    },
  );
  const unavailable = {
    error: { code: 'PORTAL_UNAVAILABLE', message: 'Este link não está disponível ou expirou.' },
  };
  async function denied(path: string) {
    const response = await call('GET', path);
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), unavailable);
  }
  await suite.test('token inexistente, adulterado, malformado e IDs não autorizam', async () => {
    await denied(`/portal/${randomBytes(32).toString('base64url')}`);
    const path = tokenPath(url);
    await denied(path.slice(0, -1) + (path.endsWith('A') ? 'B' : 'A'));
    await denied('/portal/invalid');
    await denied(`/portal/${a.project.id}`);
    await denied(`/portal/${a.client.id}`);
  });
  await suite.test(
    'rotação invalida antigo; novo independente funciona e nenhum hash é retornado',
    async () => {
      const response = await call('POST', admin, a.cookie, { validityDays: 7 });
      const text = await response.text();
      assert(!text.includes('tokenHash'));
      const next = (JSON.parse(text) as { data: Link }).data.url;
      assert.notEqual(next, url);
      await denied(tokenPath(url));
      assert.equal((await call('GET', tokenPath(next))).status, 200);
      url = next;
    },
  );
  await suite.test(
    'expiração e revogação invalidam imediatamente; estado administrativo inativo',
    async () => {
      await database.portalLink.update({
        where: { projectId: a.project.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await denied(tokenPath(url));
      assert.equal(
        (await data<{ active: boolean }>(await call('GET', admin, a.cookie))).active,
        false,
      );
      url = (await data<Link>(await call('POST', admin, a.cookie, { validityDays: 90 }))).url;
      assert.equal((await call('DELETE', admin, a.cookie)).status, 204);
      await denied(tokenPath(url));
    },
  );
  await suite.test('arquivar revoga; restaurar não reativa; exige nova geração', async () => {
    url = (await data<Link>(await call('POST', admin, a.cookie, {}))).url;
    assert.equal(
      (await call('PATCH', `/projects/${a.project.id}/archive`, a.cookie, {})).status,
      200,
    );
    await denied(tokenPath(url));
    assert.equal((await call('POST', admin, a.cookie, {})).status, 409);
    assert.equal(
      (await call('PATCH', `/projects/${a.project.id}/restore`, a.cookie, {})).status,
      200,
    );
    await denied(tokenPath(url));
    const next = (await data<Link>(await call('POST', admin, a.cookie, {}))).url;
    assert.equal((await call('GET', tokenPath(next))).status, 200);
  });
  await suite.test('gerações concorrentes deixam apenas um link válido', async () => {
    const results = await Promise.all(
      Array.from({ length: 3 }, async () => {
        const response = await call('POST', admin, a.cookie, {});
        assert.equal(response.status, 201);
        return data<Link>(response);
      }),
    );
    const statuses = await Promise.all(
      results.map(async (r) => (await call('GET', tokenPath(r.url))).status),
    );
    assert.equal(statuses.filter((s) => s === 200).length, 1);
    assert.equal(await database.portalLink.count({ where: { projectId: a.project.id } }), 1);
  });
  await suite.test('corrida geração/arquivamento nunca reativa link após restauração', async () => {
    const [generated, archived] = await Promise.all([
      call('POST', admin, a.cookie, {}),
      call('PATCH', `/projects/${a.project.id}/archive`, a.cookie, {}),
    ]);
    assert.equal(archived.status, 200);
    assert([201, 409].includes(generated.status));
    const stored = await database.portalLink.findUniqueOrThrow({
      where: { projectId: a.project.id },
    });
    assert(stored.revokedAt);
    await call('PATCH', `/projects/${a.project.id}/restore`, a.cookie, {});
    if (generated.status === 201) await denied(tokenPath((await data<Link>(generated)).url));
    assert.equal(
      (await data<{ active: boolean }>(await call('GET', admin, a.cookie))).active,
      false,
    );
  });
  await suite.test('rate limit aplica 429 com política privada sem revelar token', async () => {
    let response: Response | undefined;
    for (let i = 0; i < 65; i++) {
      response = await call('GET', '/portal/invalid');
      if (response.status === 429) break;
    }
    assert.equal(response?.status, 429);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert(response.headers.has('retry-after'));
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  });
});
