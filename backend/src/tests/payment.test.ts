import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';

const runId = randomUUID();
const emails = {
  a: `payment-owner-a-${runId}@example.test`,
  b: `payment-owner-b-${runId}@example.test`,
};
const password = 'DevFlow8';
const timeZone = 'America/Sao_Paulo';
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
    timezone: timeZone,
  });
  assert.equal(response.status, 201);
  const body: unknown = await response.json();
  assert(body && typeof body === 'object' && 'user' in body);
  assert(body.user && typeof body.user === 'object' && 'id' in body.user);
  return { cookie: cookies(response), userId: String(body.user.id) };
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
    startDate: '2026-01-01',
    budget: '10000.00',
  });
  assert.equal(response.status, 201);
  return String((await responseData(response)).id);
}

function currentDate(offsetDays = 0): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function paymentInput(overrides: Record<string, unknown> = {}) {
  return {
    description: '  Parcela de desenvolvimento  ',
    amount: '1000.00',
    dueDate: currentDate(1),
    ...overrides,
  };
}

async function createPayment(
  cookie: string,
  projectId: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await call(
    'POST',
    `/projects/${projectId}/payments`,
    cookie,
    paymentInput(overrides),
  );
  assert.equal(response.status, 201);
  return responseData(response);
}

void test('financeiro integrado com Decimal, ownership e atraso derivado', async (suite) => {
  const ownerA = await register('Proprietário A', emails.a);
  const ownerB = await register('Proprietário B', emails.b);
  const clientAId = await createClient(ownerA.cookie, 'Cliente A', `client-a-${runId}@test.dev`);
  const clientBId = await createClient(ownerB.cookie, 'Cliente B', `client-b-${runId}@test.dev`);
  const projectAId = await createProject(ownerA.cookie, clientAId, 'Projeto Financeiro A');
  const totalsProjectId = await createProject(ownerA.cookie, clientAId, 'Projeto Totais');
  const projectBId = await createProject(ownerB.cookie, clientBId, 'Projeto Financeiro B');
  const archivedProjectId = await createProject(ownerA.cookie, clientAId, 'Projeto Arquivado');
  const archivedPayment = await createPayment(ownerA.cookie, archivedProjectId, {
    description: 'Cobrança preservada',
  });
  assert.equal(
    (await call('PATCH', `/projects/${archivedProjectId}/archive`, ownerA.cookie, {})).status,
    200,
  );
  let paymentAId = '';
  let paymentBId = '';

  await suite.test('usuário cria cobrança em projeto próprio com precisão decimal', async () => {
    const payment = await createPayment(ownerA.cookie, projectAId, { amount: '9999999999.99' });
    paymentAId = String(payment.id);
    assert.equal(payment.projectId, projectAId);
    assert.equal(payment.description, 'Parcela de desenvolvimento');
    assert.equal(payment.amount, '9999999999.99');
    assert.equal(payment.status, 'PENDING');
    assert.equal(payment.paidAt, null);
    assert.equal(payment.isOverdue, false);
    assert.equal('userId' in payment, false);
  });

  await suite.test('não autenticado não cria cobrança', async () => {
    assert.equal(
      (await call('POST', `/projects/${projectAId}/payments`, '', paymentInput())).status,
      401,
    );
  });

  await suite.test('não cria em projeto alheio ou inexistente', async () => {
    assert.equal(
      (await call('POST', `/projects/${projectBId}/payments`, ownerA.cookie, paymentInput()))
        .status,
      404,
    );
    assert.equal(
      (await call('POST', `/projects/${randomUUID()}/payments`, ownerA.cookie, paymentInput()))
        .status,
      404,
    );
  });

  await suite.test('projeto arquivado bloqueia criação', async () => {
    assert.equal(
      (await call('POST', `/projects/${archivedProjectId}/payments`, ownerA.cookie, paymentInput()))
        .status,
      409,
    );
  });

  await suite.test('validação rejeita zero, negativo, formato e precisão inválidos', async () => {
    for (const amount of ['0.00', '-1.00', '1', '1.0', '1,00', '10000000000.00', '0.001']) {
      assert.equal(
        (
          await call(
            'POST',
            `/projects/${projectAId}/payments`,
            ownerA.cookie,
            paymentInput({ amount }),
          )
        ).status,
        400,
      );
    }
  });

  await suite.test('data e descrição inválidas são rejeitadas', async () => {
    for (const body of [
      paymentInput({ dueDate: '2026-02-30' }),
      paymentInput({ description: '   ' }),
    ]) {
      assert.equal(
        (await call('POST', `/projects/${projectAId}/payments`, ownerA.cookie, body)).status,
        400,
      );
    }
  });

  await suite.test('segundo usuário cria cobrança independente', async () => {
    paymentBId = String((await createPayment(ownerB.cookie, projectBId)).id);
  });

  await suite.test('usuário lista somente suas cobranças', async () => {
    const own = await listResponse(await call('GET', '/payments', ownerA.cookie));
    assert(own.data.some((payment) => payment.id === paymentAId));
    assert(!own.data.some((payment) => payment.id === paymentBId));
    const other = await listResponse(await call('GET', '/payments', ownerB.cookie));
    assert.deepEqual(
      other.data.map((payment) => payment.id),
      [paymentBId],
    );
  });

  await suite.test('listagem por projeto funciona e projeto alheio retorna 404', async () => {
    const own = await listResponse(
      await call('GET', `/projects/${projectAId}/payments`, ownerA.cookie),
    );
    assert.deepEqual(
      own.data.map((payment) => payment.id),
      [paymentAId],
    );
    assert.equal(
      (await call('GET', `/projects/${projectBId}/payments`, ownerA.cookie)).status,
      404,
    );
  });

  await suite.test('filtros por projeto e cliente respeitam ownership', async () => {
    for (const query of [`projectId=${projectAId}`, `clientId=${clientAId}`]) {
      const result = await listResponse(await call('GET', `/payments?${query}`, ownerA.cookie));
      assert(result.data.some((payment) => payment.id === paymentAId));
      assert(!result.data.some((payment) => payment.id === paymentBId));
    }
    assert.deepEqual(
      (await listResponse(await call('GET', `/payments?projectId=${projectBId}`, ownerA.cookie)))
        .data,
      [],
    );
  });

  await suite.test('busca, status e intervalo filtram a lista', async () => {
    const searched = await listResponse(
      await call('GET', '/payments?q=desenvolvimento', ownerA.cookie),
    );
    assert(searched.data.some((payment) => payment.id === paymentAId));
    const pending = await listResponse(
      await call('GET', '/payments?status=PENDING', ownerA.cookie),
    );
    assert(pending.data.some((payment) => payment.id === paymentAId));
    const range = await listResponse(
      await call('GET', `/payments?from=${currentDate()}&to=${currentDate(2)}`, ownerA.cookie),
    );
    assert(range.data.some((payment) => payment.id === paymentAId));
    assert.equal(
      (await call('GET', `/payments?from=${currentDate(2)}&to=${currentDate()}`, ownerA.cookie))
        .status,
      400,
    );
  });

  await suite.test('ontem atrasa, hoje e amanhã não atrasam', async () => {
    const yesterday = await createPayment(ownerA.cookie, totalsProjectId, {
      description: 'Vencida ontem',
      amount: '100.10',
      dueDate: currentDate(-1),
    });
    const today = await createPayment(ownerA.cookie, totalsProjectId, {
      description: 'Vence hoje',
      amount: '200.20',
      dueDate: currentDate(),
    });
    const tomorrow = await createPayment(ownerA.cookie, totalsProjectId, {
      description: 'Vence amanhã',
      amount: '300.30',
      dueDate: currentDate(1),
    });
    assert.equal(yesterday.isOverdue, true);
    assert.equal(today.isOverdue, false);
    assert.equal(tomorrow.isOverdue, false);
    const overdue = await listResponse(
      await call('GET', `/payments?projectId=${totalsProjectId}&overdue=true`, ownerA.cookie),
    );
    assert.deepEqual(
      overdue.data.map((payment) => payment.id),
      [yesterday.id],
    );
    const current = await listResponse(
      await call('GET', `/payments?projectId=${totalsProjectId}&overdue=false`, ownerA.cookie),
    );
    assert.deepEqual(
      new Set(current.data.map((payment) => payment.id)),
      new Set([today.id, tomorrow.id]),
    );
  });

  await suite.test('usuário visualiza e edita cobrança própria sem alterar projeto', async () => {
    assert.equal((await call('GET', `/payments/${paymentAId}`, ownerA.cookie)).status, 200);
    const response = await call('PATCH', `/payments/${paymentAId}`, ownerA.cookie, {
      description: '  Entrega revisada  ',
      amount: '1234.56',
      dueDate: currentDate(2),
    });
    assert.equal(response.status, 200);
    const payment = await responseData(response);
    assert.equal(payment.description, 'Entrega revisada');
    assert.equal(payment.amount, '1234.56');
    assert.equal(payment.projectId, projectAId);
    assert.equal(
      (await call('PATCH', `/payments/${paymentAId}`, ownerA.cookie, { projectId: projectBId }))
        .status,
      400,
    );
  });

  await suite.test('marcar como pago preenche paidAt e remove atraso', async () => {
    const overdue = await createPayment(ownerA.cookie, projectAId, {
      description: 'Pagamento passado',
      dueDate: currentDate(-1),
    });
    const response = await call('PATCH', `/payments/${String(overdue.id)}/pay`, ownerA.cookie, {});
    assert.equal(response.status, 200);
    const paid = await responseData(response);
    assert.equal(paid.status, 'PAID');
    assert.equal(typeof paid.paidAt, 'string');
    assert.equal(paid.isOverdue, false);
    const filtered = await listResponse(
      await call('GET', `/payments?projectId=${projectAId}&overdue=true`, ownerA.cookie),
    );
    assert(!filtered.data.some((payment) => payment.id === overdue.id));
  });

  await suite.test('reabrir limpa paidAt e restaura atraso derivado', async () => {
    const overdue = await createPayment(ownerA.cookie, projectAId, {
      description: 'Reabrir vencida',
      dueDate: currentDate(-1),
    });
    await call('PATCH', `/payments/${String(overdue.id)}/pay`, ownerA.cookie, {});
    const response = await call(
      'PATCH',
      `/payments/${String(overdue.id)}/reopen`,
      ownerA.cookie,
      {},
    );
    assert.equal(response.status, 200);
    const reopened = await responseData(response);
    assert.equal(reopened.status, 'PENDING');
    assert.equal(reopened.paidAt, null);
    assert.equal(reopened.isOverdue, true);
  });

  await suite.test('totais usam soma decimal exata e definições de status', async () => {
    const result = await listResponse(
      await call('GET', `/projects/${totalsProjectId}/payments`, ownerA.cookie),
    );
    assert.equal(result.meta.totalExpected, '600.60');
    assert.equal(result.meta.totalPaid, '0.00');
    assert.equal(result.meta.totalPending, '600.60');
    assert.equal(result.meta.totalOverdue, '100.10');
    assert.equal(result.meta.count, 3);
  });

  await suite.test('isolamento bloqueia GET, PATCH, PAY, REOPEN e DELETE alheios', async () => {
    assert.equal((await call('GET', `/payments/${paymentBId}`, ownerA.cookie)).status, 404);
    assert.equal(
      (await call('PATCH', `/payments/${paymentBId}`, ownerA.cookie, { amount: '10.00' })).status,
      404,
    );
    assert.equal(
      (await call('PATCH', `/payments/${paymentBId}/pay`, ownerA.cookie, {})).status,
      404,
    );
    assert.equal(
      (await call('PATCH', `/payments/${paymentBId}/reopen`, ownerA.cookie, {})).status,
      404,
    );
    assert.equal((await call('DELETE', `/payments/${paymentBId}`, ownerA.cookie)).status, 404);
  });

  await suite.test('projeto arquivado permite leitura e bloqueia todas as mutações', async () => {
    const id = String(archivedPayment.id);
    assert.equal(
      (await call('GET', `/projects/${archivedProjectId}/payments`, ownerA.cookie)).status,
      200,
    );
    assert.equal((await call('GET', `/payments/${id}`, ownerA.cookie)).status, 200);
    assert.equal(
      (await call('PATCH', `/payments/${id}`, ownerA.cookie, { amount: '10.00' })).status,
      409,
    );
    assert.equal((await call('PATCH', `/payments/${id}/pay`, ownerA.cookie, {})).status, 409);
    assert.equal((await call('PATCH', `/payments/${id}/reopen`, ownerA.cookie, {})).status, 409);
    assert.equal((await call('DELETE', `/payments/${id}`, ownerA.cookie)).status, 409);
  });

  await suite.test('restaurar projeto reativa mutações', async () => {
    assert.equal(
      (await call('PATCH', `/projects/${archivedProjectId}/restore`, ownerA.cookie, {})).status,
      200,
    );
    assert.equal(
      (
        await call('PATCH', `/payments/${String(archivedPayment.id)}`, ownerA.cookie, {
          amount: '10.00',
        })
      ).status,
      200,
    );
  });

  await suite.test('usuário exclui cobrança própria e totais atualizam', async () => {
    const disposable = await createPayment(ownerA.cookie, totalsProjectId, {
      description: 'Descartável',
      amount: '0.01',
    });
    let result = await listResponse(
      await call('GET', `/projects/${totalsProjectId}/payments`, ownerA.cookie),
    );
    assert.equal(result.meta.totalExpected, '600.61');
    assert.equal(
      (await call('DELETE', `/payments/${String(disposable.id)}`, ownerA.cookie)).status,
      204,
    );
    assert.equal(
      (await call('GET', `/payments/${String(disposable.id)}`, ownerA.cookie)).status,
      404,
    );
    result = await listResponse(
      await call('GET', `/projects/${totalsProjectId}/payments`, ownerA.cookie),
    );
    assert.equal(result.meta.totalExpected, '600.60');
  });

  await suite.test('IDs de propriedade enviados no corpo são rejeitados', async () => {
    for (const body of [
      paymentInput({ projectId: projectBId }),
      paymentInput({ userId: ownerB.userId }),
    ]) {
      assert.equal(
        (await call('POST', `/projects/${projectAId}/payments`, ownerA.cookie, body)).status,
        400,
      );
    }
  });
});
