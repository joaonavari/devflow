import assert from 'node:assert/strict';
import { test } from 'node:test';
import { portalTestContext, data } from './portal-test-support.js';
const { call, owner } = portalTestContext('stages');
interface Stage {
  id: string;
  title: string;
  status: string;
  position: number;
  isClientVisible: boolean;
}
void test('etapas: CRUD, ordem, visibilidade e isolamento', async (suite) => {
  const a = await owner('A');
  const b = await owner('B');
  const path = `/projects/${a.project.id}/stages`;
  const other = `/projects/${b.project.id}/stages`;
  let first: Stage;
  let second: Stage;
  await suite.test('criação privada por padrão e validação estrita', async () => {
    assert.equal((await call('POST', path, '', { title: 'A' })).status, 401);
    for (const body of [
      { title: '' },
      { title: 'A', userId: a.user.id },
      { title: 'A', projectId: b.project.id },
      { title: 'A', position: -1 },
      { title: 'A', status: 'INVALID' },
    ])
      assert.equal((await call('POST', path, a.cookie, body)).status, 400);
    const response = await call('POST', path, a.cookie, { title: '  Descoberta  ' });
    assert.equal(response.status, 201);
    first = await data<Stage>(response);
    assert.equal(first.title, 'Descoberta');
    assert.equal(first.isClientVisible, false);
    assert.equal(first.position, 0);
    second = await data<Stage>(
      await call('POST', path, a.cookie, { title: 'Entrega', isClientVisible: true }),
    );
  });
  await suite.test(
    'listar, criar, editar, mover, excluir e visibilidade de outro usuário retornam 404',
    async () => {
      const target = await data<Stage>(await call('POST', other, b.cookie, { title: 'Etapa B' }));
      for (const method of ['GET', 'POST'])
        assert.equal(
          (
            await call(
              method,
              other,
              a.cookie,
              method === 'POST' ? { title: 'Intrusão' } : undefined,
            )
          ).status,
          404,
        );
      assert.equal(
        (
          await call('PATCH', `/project-stages/${target.id}`, a.cookie, {
            title: 'Intrusão',
            isClientVisible: true,
          })
        ).status,
        404,
      );
      assert.equal(
        (await call('PATCH', `/project-stages/${target.id}/move`, a.cookie, { position: 0 }))
          .status,
        404,
      );
      assert.equal((await call('DELETE', `/project-stages/${target.id}`, a.cookie)).status, 404);
      const list = await data<Stage[]>(await call('GET', path, a.cookie));
      assert.equal(list.length, 2);
      assert(!list.some((s) => s.id === target.id));
    },
  );
  await suite.test('editar título, status e visibilidade', async () => {
    const response = await call('PATCH', `/project-stages/${first.id}`, a.cookie, {
      title: 'Planejamento',
      status: 'COMPLETED',
      isClientVisible: true,
    });
    assert.equal(response.status, 200);
    const changed = await data<Stage>(response);
    assert.equal(changed.status, 'COMPLETED');
    assert.equal(changed.isClientVisible, true);
    assert.equal(changed.title, 'Planejamento');
    const titleOnly = await data<Stage>(
      await call('PATCH', `/project-stages/${first.id}`, a.cookie, { title: 'Título ajustado' }),
    );
    assert.equal(titleOnly.status, 'COMPLETED');
    assert.equal(titleOnly.isClientVisible, true);
    assert.equal((await call('PATCH', `/project-stages/${first.id}`, a.cookie, {})).status, 400);
  });
  await suite.test('mover e excluir normalizam posições; limite é ajustado ao fim', async () => {
    assert.equal(
      (await call('PATCH', `/project-stages/${second.id}/move`, a.cookie, { position: -1 })).status,
      400,
    );
    await call('PATCH', `/project-stages/${second.id}/move`, a.cookie, { position: 0 });
    let list = await data<Stage[]>(await call('GET', path, a.cookie));
    assert.deepEqual(
      list.map((s) => s.id),
      [second.id, first.id],
    );
    assert.deepEqual(
      list.map((s) => s.position),
      [0, 1],
    );
    await call('PATCH', `/project-stages/${second.id}/move`, a.cookie, { position: 999 });
    list = await data<Stage[]>(await call('GET', path, a.cookie));
    assert.deepEqual(
      list.map((s) => s.id),
      [first.id, second.id],
    );
    assert.equal((await call('DELETE', `/project-stages/${first.id}`, a.cookie)).status, 204);
    list = await data<Stage[]>(await call('GET', path, a.cookie));
    assert.deepEqual(
      list.map((s) => s.position),
      [0],
    );
  });
  await suite.test('criações concorrentes preservam sequência', async () => {
    const results = await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        call('POST', path, a.cookie, { title: `Etapa ${String(i)}` }),
      ),
    );
    assert(results.every((r) => r.status === 201));
    const list = await data<Stage[]>(await call('GET', path, a.cookie));
    assert.deepEqual(
      list.map((s) => s.position),
      [0, 1, 2, 3, 4],
    );
  });
  await suite.test('arquivado permite leitura e bloqueia todas as mutações', async () => {
    await call('PATCH', `/projects/${a.project.id}/archive`, a.cookie, {});
    assert.equal((await call('GET', path, a.cookie)).status, 200);
    assert.equal((await call('POST', path, a.cookie, { title: 'Bloqueada' })).status, 409);
    assert.equal(
      (await call('PATCH', `/project-stages/${second.id}`, a.cookie, { isClientVisible: false }))
        .status,
      409,
    );
    assert.equal(
      (await call('PATCH', `/project-stages/${second.id}/move`, a.cookie, { position: 1 })).status,
      409,
    );
    assert.equal((await call('DELETE', `/project-stages/${second.id}`, a.cookie)).status, 409);
    await call('PATCH', `/projects/${a.project.id}/restore`, a.cookie, {});
    assert.equal(
      (await call('PATCH', `/project-stages/${second.id}`, a.cookie, { status: 'IN_PROGRESS' }))
        .status,
      200,
    );
  });
});
