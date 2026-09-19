import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { database } from '../backend/src/config/database.ts';

const origin = 'http://127.0.0.1:5173';
const output = '/private/tmp/devflow-stage11/browser';
const email = `refinement-${randomUUID()}@example.test`;
const sockets = [];
const errors = [];
const requests = [];
let browser;
let context;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect(url) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const call = pending.get(message.id);
      if (!call) return;
      clearTimeout(call.timer);
      pending.delete(message.id);
      if (message.error) call.reject(new Error(`CDP: ${call.method}`));
      else call.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown')
      errors.push(message.params.exceptionDetails.text);
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
      errors.push('console.error');
    if (message.method === 'Network.requestWillBeSent') {
      const request = message.params.request;
      // Record administrative endpoint paths only, never credentials or bodies.
      const path = new URL(request.url).pathname;
      if (path.startsWith('/api/') && !path.includes('/portal/'))
        requests.push({ path, method: request.method });
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const current = ++id;
      const timer = setTimeout(() => {
        pending.delete(current);
        reject(new Error(`CDP timeout: ${method}`));
      }, 20000);
      pending.set(current, { resolve, reject, timer, method });
      socket.send(JSON.stringify({ id: current, method, params }));
    });
}

try {
  await mkdir(output, { recursive: true });
  const registered = await fetch(`${origin}/api/v1/auth/register`, {
    method: 'POST',
    headers: { Origin: origin, 'X-DevFlow-Request': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Conta de refinamento',
      email,
      password: 'DevFlow8',
      timezone: 'America/Sao_Paulo',
    }),
  });
  assert.equal(registered.status, 201);
  const user = await database.user.findUniqueOrThrow({ where: { email } });
  const client = await database.client.create({
    data: { userId: user.id, name: 'Estúdio Horizonte', email: 'contato@example.test' },
  });
  const project = await database.project.create({
    data: {
      userId: user.id,
      clientId: client.id,
      name: 'Experiência digital Horizonte',
      startDate: new Date('2026-09-01'),
      progressMode: 'AUTO',
    },
  });
  await database.task.createMany({
    data: [
      {
        projectId: project.id,
        title: 'Planejamento concluído',
        status: 'DONE',
        completedAt: new Date(),
      },
      { projectId: project.id, title: 'Revisão da entrega', status: 'TODO' },
    ],
  });
  await database.timeEntry.create({
    data: { projectId: project.id, workDate: new Date(), durationMinutes: 90 },
  });
  await database.payment.create({
    data: {
      projectId: project.id,
      description: 'Entrada do projeto',
      amount: '1250.50',
      dueDate: new Date(),
    },
  });
  const version = await fetch('http://127.0.0.1:9222/json/version').then((r) => r.json());
  browser = await connect(version.webSocketDebuggerUrl);
  context = (await browser('Target.createBrowserContext')).browserContextId;
  const { targetId } = await browser('Target.createTarget', {
    url: 'about:blank',
    browserContextId: context,
  });
  const targets = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const send = await connect(targets.find((target) => target.id === targetId).webSocketDebuggerUrl);
  for (const domain of ['Page', 'Runtime', 'Network']) await send(`${domain}.enable`);
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error('Expressão de verificação do navegador falhou.');
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (await evaluate(expression)) return;
      } catch {
        /* Navigation replaces the context. */
      }
      await delay(100);
    }
    throw new Error(`Condição não atendida: ${expression}`);
  };
  const click = async (selector) => {
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).focus(); document.querySelector(${JSON.stringify(selector)}).click()`,
    );
  };
  const fill = async (name, value) => {
    await evaluate(
      `document.querySelector('[name="${name}"]').focus(); document.querySelector('[name="${name}"]').select()`,
    );
    await send('Input.insertText', { text: value });
  };
  const navigate = async (path, expected = path) => {
    await send('Page.navigate', { url: origin + path });
    await until(
      `location.pathname === ${JSON.stringify(expected)} && !!document.querySelector('h1')`,
    );
  };
  const viewport = (width) =>
    send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  const key = async (key, code, number) => {
    for (const type of ['keyDown', 'keyUp'])
      await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: number });
  };
  const noOverflow = async (label) => {
    await evaluate(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    );
    if (
      await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth')
    ) {
      console.log(
        label,
        await evaluate(
          `Array.from(document.querySelectorAll('main, main *')).filter(el => el.getBoundingClientRect().right > innerWidth && el.getClientRects().length).slice(0, 12).map(el => ({tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width, right: el.getBoundingClientRect().right}))`,
        ),
      );
    }
    assert.equal(
      await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'),
      false,
      label,
    );
  };
  const login = async (expected) => {
    await fill('email', email);
    await fill('password', 'DevFlow8');
    await click('.auth-submit');
    await until(
      `location.pathname === ${JSON.stringify(expected)} && !!document.querySelector('.app-shell')`,
    );
  };

  const detail = `/projetos/${project.id}`;
  await navigate(detail, '/login');
  await login(detail);
  await until('document.querySelector(".project-overview strong")?.textContent === "50%"');
  assert.equal(
    await evaluate(
      'document.querySelector(".desktop-sidebar a[aria-current=page]").getAttribute("href")',
    ),
    '/projetos',
  );
  console.log('PASS: deep link retorna ao detalhe após login; sidebar mantém projeto ativo.');

  const paths = [
    '/dashboard',
    '/clientes',
    `/clientes/${client.id}`,
    '/projetos',
    detail,
    '/tarefas',
    '/horas',
    '/financeiro',
    '/configuracoes',
    '/endereco-inexistente',
  ];
  for (const path of process.argv.includes('--interactions') ? [] : paths) {
    await navigate(path);
    await until('!!document.querySelector("main h1")');
    for (const width of [320, 360, 390, 430, 768, 1024, 1366, 1440]) {
      await viewport(width);
      await noOverflow(`${path}: ${width}px`);
      assert.equal(await evaluate('document.querySelectorAll("main").length'), 1);
      assert.deepEqual(
        await evaluate(
          `Array.from(document.querySelectorAll('[aria-describedby]')).filter(el => el.getClientRects().length && !el.getAttribute('aria-describedby').split(/\\s+/).every(id => document.getElementById(id))).map(el => el.tagName)`,
        ),
        [],
      );
    }
    await evaluate('window.__beforeReload = true');
    await send('Page.reload');
    await until(
      `!window.__beforeReload && location.pathname === ${JSON.stringify(path)} && !!document.querySelector('main h1')`,
    );
  }
  if (!process.argv.includes('--interactions'))
    console.log(
      'PASS: dez rotas com deep link/reload; oito larguras 320–1440 px; landmarks e referências ARIA.',
    );
  await navigate('/configuracoes');
  assert(
    await evaluate(
      'document.querySelector(".settings-details").innerText.includes("America/Sao_Paulo")',
    ),
  );
  await viewport(390);
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  await writeFile(`${output}/settings-mobile.png`, Buffer.from(screenshot.data, 'base64'));

  await viewport(1440);
  await navigate('/clientes');
  await until('!!document.querySelector(".clients-table [data-client-link]")');
  await click('[aria-label="Sair da conta"]');
  await until('location.pathname === "/login"');
  await database.client.update({
    where: { id: client.id },
    data: { name: 'Nome atualizado fora da sessão' },
  });
  await login('/clientes');
  await until(
    'document.querySelector(".clients-table")?.innerText.includes("Nome atualizado fora da sessão")',
  );
  assert(
    !(await evaluate(
      'document.querySelector(".clients-table").innerText.includes("Estúdio Horizonte")',
    )),
  );
  console.log('PASS: nova sessão não reutiliza dados da sessão anterior dentro do staleTime.');

  await click('[data-client-action="new"]');
  await until('document.querySelector(".client-dialog")?.open');
  assert.equal(await evaluate('document.activeElement.name'), 'name');
  for (const width of [320, 360, 390, 430, 768, 1024, 1366, 1440]) {
    await viewport(width);
    await noOverflow(`dialog ${width}px`);
    await key('Tab', 'Tab', 9);
    // Native modal dialogs may pass Tab through browser chrome (BODY in CDP).
    // The next Tab must return to the modal; background controls remain inert.
    if (await evaluate('document.activeElement === document.body')) await key('Tab', 'Tab', 9);
    assert(await evaluate('document.activeElement.closest("dialog") !== null'));
  }
  await key('Escape', 'Escape', 27);
  await until('!document.querySelector(".client-dialog").open');
  await until('document.activeElement.dataset.clientAction === "new"');
  await click('[data-client-action="new"]');
  await until('document.querySelector(".client-dialog")?.open');
  await fill('name', 'Envio único');
  await fill('email', 'unico@example.test');
  const beforeSubmit = requests.filter(
    (r) => r.path === '/api/v1/clients' && r.method === 'POST',
  ).length;
  await evaluate(`(() => {
    const original = window.fetch;
    window.fetch = async (...args) => { if (String(args[0]) === '/api/v1/clients' && args[1]?.method === 'POST') await new Promise(r => setTimeout(r, 400)); return original(...args); };
    const form = document.querySelector('.client-form');
    form.requestSubmit(); form.requestSubmit();
  })()`);
  await until('!document.querySelector(".client-dialog").open');
  assert.equal(
    requests.filter((r) => r.path === '/api/v1/clients' && r.method === 'POST').length -
      beforeSubmit,
    1,
  );
  assert.equal(await database.client.count({ where: { userId: user.id, name: 'Envio único' } }), 1);
  console.log(
    'PASS: modal mantém foco, Escape restaura o gatilho e dois submits geram apenas um POST.',
  );

  await navigate(detail);
  await until('!!document.querySelector("[data-task-action=new]")');
  await click('[data-task-action="new"]');
  await until('document.querySelector(".task-dialog")?.open');
  await key('Escape', 'Escape', 27);
  await until('!document.querySelector(".task-dialog")');
  await until('document.activeElement.dataset.taskAction === "new"');
  const beforeMove = requests.filter(
    (r) => r.path === `/api/v1/projects/${project.id}` && r.method === 'GET',
  ).length;
  await click('.task-card[data-task-id] [data-task-action="toggle"]');
  await until('document.body.innerText.includes("Ordem das tarefas atualizada.")');
  await delay(500);
  assert.equal(
    requests.filter((r) => r.path === `/api/v1/projects/${project.id}` && r.method === 'GET')
      .length - beforeMove,
    1,
  );

  await click('[data-project-action="archive"]');
  await until('!!document.querySelector("dialog[open] [data-confirm-action]")');
  assert.equal(await evaluate('document.activeElement.textContent.trim()'), 'Cancelar');
  await key('Escape', 'Escape', 27);
  await until('!document.querySelector("dialog[open]")');
  assert.equal(
    (await database.project.findUniqueOrThrow({ where: { id: project.id } })).archivedAt,
    null,
  );
  console.log('PASS: Kanban atualiza projeto uma vez; arquivamento cancelado não altera dados.');

  // Prime global caches, archive through SPA navigation, and verify read-only state
  // within staleTime without reloading away the QueryClient.
  await click('.desktop-sidebar a[href="/tarefas"]');
  await until('!!document.querySelector(".tasks-table tbody select:not(:disabled)")');
  await click('.desktop-sidebar a[href="/horas"]');
  await until('!!document.querySelector(".hours-table tbody button:not(:disabled)")');
  await click(`.hours-table a[href="${detail}"]`);
  await until('!!document.querySelector("[data-project-action=archive]")');
  await click('[data-project-action="archive"]');
  await until('!!document.querySelector("dialog[open] [data-confirm-action]")');
  await click('dialog[open] [data-confirm-action]');
  await until('document.body.innerText.includes("Projeto arquivado com sucesso.")');
  await click('.desktop-sidebar a[href="/tarefas"]');
  await until('!!document.querySelector(".tasks-table tbody select:disabled")');
  assert.equal(
    await evaluate('document.querySelectorAll(".tasks-table tbody select:not(:disabled)").length'),
    0,
  );
  await click('.desktop-sidebar a[href="/horas"]');
  await until('!!document.querySelector(".hours-table tbody button:disabled")');
  assert.equal(
    await evaluate('document.querySelectorAll(".hours-table tbody button:not(:disabled)").length'),
    0,
  );
  await click(`.hours-table a[href="${detail}"]`);
  await until('!!document.querySelector("[data-project-action=restore]")');
  await click('[data-project-action="restore"]');
  await until('document.body.innerText.includes("Projeto restaurado com sucesso.")');
  console.log('PASS: arquivamento invalida caches globais de tarefas e horas sem reload.');

  // Invalid resource URLs must retain an accessible page heading.
  for (const path of ['/clientes/invalido', '/projetos/invalido']) {
    await navigate(path);
    assert(
      await evaluate('document.querySelector("main h1").textContent.includes("não encontrado")'),
    );
  }
  await navigate(detail);
  await until('!!document.querySelector("[data-portal-action=generate]")');
  await evaluate(
    `(() => { const original = window.fetch; window.fetch = (...args) => String(args[0]).endsWith('/portal') && args[1]?.method === 'POST' ? Promise.resolve(new Response('<html>internal proxy stack SQL</html>', { status: 500 })) : original(...args); })()`,
  );
  await click('[data-portal-action="generate"]');
  await until(
    'document.querySelector(".portal-admin [role=alert]")?.textContent.includes("Não foi possível concluir")',
  );
  assert(!(await evaluate('document.body.innerText.includes("internal proxy stack SQL")')));
  assert.deepEqual(errors, []);
  const settled = requests.length;
  await delay(600);
  assert.equal(requests.length, settled);
  console.log(
    'PASS: 404 coerente; erro 500 HTML vira mensagem segura; sem erros de console ou loops de requests.',
  );
} catch (error) {
  console.error(
    String(error instanceof Error ? error.stack : error).replace(
      /(\/(?:api\/v1\/)?portal\/)[^\s"'<>?]+/gi,
      '$1[redacted]',
    ),
  );
  process.exitCode = 1;
} finally {
  if (browser && context)
    await browser('Target.disposeBrowserContext', { browserContextId: context });
  for (const socket of sockets) socket.close();
  try {
    await database.user.deleteMany({ where: { email } });
  } finally {
    await database.$disconnect();
  }
}
