import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { database } from '../backend/src/config/database.ts';

// Uses an isolated Chrome context. Requires npm run dev and Chrome with CDP on 9222.
const origin = 'http://127.0.0.1:5173';
const email = `browser-auth-${randomUUID()}@example.test`;
const password = 'DevFlow8';
const output = process.env.AUTH_SCREENSHOT_DIR ?? '/private/tmp/devflow-stage3';
const sockets = [];
const exceptions = [];
let refreshRequests = 0;
let clientRequests = 0;
let projectRequests = 0;
let taskRequests = 0;
let timeEntryRequests = 0;
let paymentRequests = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function dateInTimeZone(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type) => parts.find((candidate) => candidate.type === type)?.value ?? '';
  const date = new Date(`${part('year')}-${part('month')}-${part('day')}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

async function connect(url) {
  const socket = new WebSocket(url);
  sockets.push(socket);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timeout);
      if (message.error) task.reject(new Error(`${task.method}: ${JSON.stringify(message.error)}`));
      else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown')
      exceptions.push(message.params.exceptionDetails.text);
    if (
      message.method === 'Network.requestWillBeSent' &&
      message.params.request.url.endsWith('/auth/refresh')
    )
      refreshRequests++;
    if (
      message.method === 'Network.requestWillBeSent' &&
      message.params.request.url.includes('/api/v1/clients')
    )
      clientRequests++;
    if (
      message.method === 'Network.requestWillBeSent' &&
      message.params.request.url.includes('/api/v1/projects')
    )
      projectRequests++;
    if (
      message.method === 'Network.requestWillBeSent' &&
      message.params.request.url.includes('/api/v1/tasks')
    )
      taskRequests++;
    if (
      message.method === 'Network.requestWillBeSent' &&
      message.params.request.url.includes('/time-entries')
    )
      timeEntryRequests++;
    if (
      message.method === 'Network.requestWillBeSent' &&
      message.params.request.url.includes('/payments')
    )
      paymentRequests++;
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      const timeout = setTimeout(() => {
        pending.delete(callId);
        reject(new Error(`CDP timeout: ${method}`));
      }, 20_000);
      pending.set(callId, { resolve, reject, timeout, method });
      socket.send(JSON.stringify({ id: callId, method, params }));
    });
}

async function page(browser, context) {
  const { targetId } = await browser('Target.createTarget', {
    url: 'about:blank',
    browserContextId: context,
  });
  const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) =>
    response.json(),
  );
  const target = targets.find((item) => item.id === targetId);
  assert(target);
  const send = await connect(target.webSocketDebuggerUrl);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description ?? result.exceptionDetails.text,
      );
    return result.result.value;
  };
  const until = async (expression) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      try {
        if (await evaluate(expression)) return;
      } catch {
        /* A navigation may replace the execution context. */
      }
      await delay(100);
    }
    throw new Error(
      `Browser assertion timed out: ${expression}\n${await evaluate('document.body.innerText')}`,
    );
  };
  const navigate = async (path, expected = path) => {
    await send('Page.navigate', { url: `${origin}${path}` });
    await until(
      `location.pathname === ${JSON.stringify(expected)} && !!document.querySelector('h1')`,
    );
  };
  const reload = async () => {
    await evaluate('document.documentElement.dataset.beforeReload = "true"');
    await send('Page.reload');
    await until(
      '!document.documentElement.dataset.beforeReload && document.readyState === "complete" && !!document.querySelector(".app-shell")',
    );
  };
  const fill = async (name, text) => {
    await evaluate(
      `document.querySelector('[name=${JSON.stringify(name)}]').focus(); document.querySelector('[name=${JSON.stringify(name)}]').select()`,
    );
    await send('Input.insertText', { text });
  };
  const fillSelector = async (selector, text) => {
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).focus(); document.querySelector(${JSON.stringify(selector)}).select()`,
    );
    if (text) {
      await send('Input.insertText', { text });
    } else {
      await send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: 'Backspace',
        code: 'Backspace',
        windowsVirtualKeyCode: 8,
      });
      await send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: 'Backspace',
        code: 'Backspace',
        windowsVirtualKeyCode: 8,
      });
    }
  };
  const click = (selector) =>
    evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const pointerClick = async (selector) => {
    await evaluate(
      `document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center' })`,
    );
    await delay(100);
    const point = await evaluate(`(() => {
      const rect = document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    })()`);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: point.x,
      y: point.y,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: 'left',
      buttons: 1,
      clickCount: 1,
      x: point.x,
      y: point.y,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: 'left',
      buttons: 0,
      clickCount: 1,
      x: point.x,
      y: point.y,
    });
  };
  const drag = async (sourceSelector, targetSelector) => {
    const points = await evaluate(`(() => {
      const source = document.querySelector(${JSON.stringify(sourceSelector)}).getBoundingClientRect();
      const target = document.querySelector(${JSON.stringify(targetSelector)}).getBoundingClientRect();
      return {
        source: { x: source.left + source.width / 2, y: source.top + source.height / 2 },
        target: { x: target.left + target.width / 2, y: target.top + target.height / 2 },
      };
    })()`);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: points.source.x,
      y: points.source.y,
    });
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      button: 'left',
      buttons: 1,
      clickCount: 1,
      x: points.source.x,
      y: points.source.y,
    });
    await delay(100);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      button: 'left',
      buttons: 1,
      x: points.source.x + 10,
      y: points.source.y + 10,
    });
    await delay(100);
    for (let step = 1; step <= 5; step += 1) {
      await send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        button: 'left',
        buttons: 1,
        x: points.source.x + ((points.target.x - points.source.x) * step) / 5,
        y: points.source.y + ((points.target.y - points.source.y) * step) / 5,
      });
      await delay(50);
    }
    await delay(100);
    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      button: 'left',
      buttons: 0,
      clickCount: 1,
      x: points.target.x,
      y: points.target.y,
    });
  };
  const setValue = (selector, value) =>
    evaluate(`(() => {
      const element = document.querySelector(${JSON.stringify(selector)});
      const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set;
      setter.call(element, ${JSON.stringify(value)});
      const reactPropsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'));
      const reactOnChange = reactPropsKey && element[reactPropsKey]?.onChange;
      if (typeof reactOnChange === 'function') {
        reactOnChange({
          target: {
            name: element.name,
            type: element.type,
            value: ${JSON.stringify(value)},
            checked: element.checked,
          },
          type: 'change',
        });
      } else {
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()`);
  const viewport = (width) =>
    send('Emulation.setDeviceMetricsOverride', {
      width,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false,
    });
  const screenshot = async (name) => {
    await evaluate('document.fonts.ready.then(() => true)');
    const result = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: false,
    });
    await writeFile(`${output}/${name}.png`, Buffer.from(result.data, 'base64'));
  };
  return {
    send,
    evaluate,
    until,
    navigate,
    reload,
    fill,
    fillSelector,
    click,
    pointerClick,
    drag,
    setValue,
    viewport,
    screenshot,
  };
}

let browser;
let context;
try {
  await mkdir(output, { recursive: true });
  const version = await fetch('http://127.0.0.1:9222/json/version').then((response) =>
    response.json(),
  );
  browser = await connect(version.webSocketDebuggerUrl);
  ({ browserContextId: context } = await browser('Target.createBrowserContext'));
  const tab = await page(browser, context);
  const paths = [
    '/dashboard',
    '/projetos',
    '/clientes',
    '/tarefas',
    '/financeiro',
    '/horas',
    '/configuracoes',
  ];
  for (const path of paths) {
    await tab.navigate(path, '/login');
    assert.equal(await tab.evaluate('!!document.querySelector(".app-shell")'), false);
  }
  console.log('PASS: as sete rotas privadas redirecionam visitantes para login.');
  await tab.viewport(1440);
  await tab.screenshot('login-desktop');
  for (const width of [1440, 1024, 768, 390, 320]) {
    await tab.viewport(width);
    assert.equal(
      await tab.evaluate(
        'document.documentElement.scrollWidth > document.documentElement.clientWidth',
      ),
      false,
    );
  }
  await tab.screenshot('login-mobile');
  await tab.navigate('/register');
  await tab.screenshot('register-mobile');
  await tab.click('button[type=submit]');
  await tab.until('document.querySelectorAll("[aria-invalid=true]").length === 4');
  assert.equal(await tab.evaluate('document.activeElement.name'), 'name');
  await tab.fill('name', 'Usuário de Validação');
  await tab.fill('email', email);
  await tab.fill('password', '1234567');
  await tab.fill('confirmPassword', '1234567');
  await tab.click('button[type=submit]');
  await tab.until(
    'document.querySelector(".field-error")?.textContent === "Use pelo menos 8 caracteres."',
  );
  await tab.fill('password', password);
  await tab.fill('confirmPassword', 'different-password');
  await tab.click('button[type=submit]');
  await tab.until('document.body.innerText.includes("As senhas precisam ser iguais.")');
  await tab.fill('confirmPassword', password);
  await tab.click('button[type=submit]');
  await tab.until('location.pathname === "/dashboard" && !!document.querySelector(".app-shell")');
  assert.equal(
    await tab.evaluate('document.querySelector(".sidebar-user p").textContent'),
    'Usuário de Validação',
  );
  assert.deepEqual(
    await tab.evaluate(
      '({ local: localStorage.length, session: sessionStorage.length, cookie: document.cookie })',
    ),
    { local: 0, session: 0, cookie: '' },
  );
  console.log(
    'PASS: formulário de cadastro, validação, foco de erro, identidade real e ausência de tokens em Web Storage.',
  );
  await tab.viewport(1440);
  await tab.screenshot('dashboard-desktop');
  for (const path of paths) await tab.navigate(path);
  await tab.navigate('/login', '/dashboard');
  await tab.navigate('/register', '/dashboard');
  await tab.reload();
  console.log(
    'PASS: rotas internas acessíveis, páginas públicas redirecionam autenticados, sessão persiste no reload.',
  );
  const beforeCookies = await browser('Storage.getCookies', { browserContextId: context });
  assert(beforeCookies.cookies.every((cookie) => cookie.httpOnly && cookie.sameSite === 'Lax'));
  const oldRefresh = beforeCookies.cookies.find(
    (cookie) => cookie.name === 'devflow_refresh',
  )?.value;
  await tab.send('Network.deleteCookies', {
    name: 'devflow_access',
    domain: '127.0.0.1',
    path: '/api',
  });
  const beforeRefresh = refreshRequests;
  await tab.reload();
  assert.equal(refreshRequests - beforeRefresh, 1);
  const afterCookies = await browser('Storage.getCookies', { browserContextId: context });
  assert.notEqual(
    afterCookies.cookies.find((cookie) => cookie.name === 'devflow_refresh')?.value,
    oldRefresh,
  );
  console.log('PASS: reload sem access cookie renova uma vez e rotaciona refresh.');
  const second = await page(browser, context);
  await second.navigate('/dashboard');
  await tab.send('Network.deleteCookies', {
    name: 'devflow_access',
    domain: '127.0.0.1',
    path: '/api',
  });
  const concurrentBefore = refreshRequests;
  const discover =
    'import("/src/auth/auth-api.ts").then(async ({discoverSession}) => (await Promise.all(Array.from({length: 8}, () => discoverSession()))).every(user => !!user))';
  assert((await Promise.all([tab.evaluate(discover), second.evaluate(discover)])).every(Boolean));
  assert.equal(refreshRequests - concurrentBefore, 1);
  console.log('PASS: 16 descobertas concorrentes em duas abas causam somente um refresh.');
  await tab.click('[aria-label="Sair da conta"]');
  await tab.until('location.pathname === "/login"');
  await second.until('location.pathname === "/login"');
  assert.equal(
    (await browser('Storage.getCookies', { browserContextId: context })).cookies.length,
    0,
  );
  await tab.navigate('/projetos', '/login');
  await tab.fill('email', email);
  await tab.fill('password', 'wrong-password');
  await tab.click('button[type=submit]');
  await tab.until('document.body.innerText.includes("Email ou senha inválidos.")');
  await tab.fill('password', password);
  assert.equal(
    await tab.evaluate(
      `document.querySelector('[name="password"]').value === ${JSON.stringify(password)}`,
    ),
    true,
  );
  await tab.until('!document.querySelector("button[type=submit]").disabled');
  // Enter submits the form through the native keyboard path.
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Enter',
    code: 'Enter',
    text: '\r',
    unmodifiedText: '\r',
    windowsVirtualKeyCode: 13,
  });
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Enter',
    code: 'Enter',
    windowsVirtualKeyCode: 13,
  });
  await tab.until('location.pathname === "/projetos" && !!document.querySelector(".app-shell")');
  console.log(
    'PASS: logout sincroniza abas, login inválido mostra erro, login via Enter retorna à rota solicitada.',
  );

  await tab.viewport(1440);
  await tab.navigate('/clientes');
  await tab.until('document.body.innerText.includes("Cadastre seu primeiro cliente")');
  await tab.screenshot('clients-empty-desktop');
  await tab.click('[data-client-action="new"]');
  await tab.until('document.querySelector(".client-dialog").open');
  await tab.until('document.activeElement.name === "name"');
  await tab.fill('name', 'Navari Studio');
  await tab.fill('email', 'contato@navari.example');
  await tab.fill('phone', '+55 11 98888-7777');
  await tab.fill('company', 'Navari Design');
  await tab.click('[data-client-action="create"]');
  await tab.until(
    'document.body.innerText.includes("Navari Studio foi cadastrado com sucesso.") && !!document.querySelector(".clients-table [data-client-link]")',
  );
  await tab.screenshot('clients-list-desktop');
  console.log('PASS: estado vazio, criação e atualização da lista sem reload.');

  await tab.fillSelector('#client-search', 'Navari Design');
  await tab.until(
    'document.querySelectorAll(".clients-table tbody tr").length === 1 && document.body.innerText.includes("Navari Studio")',
  );
  await tab.fillSelector('#client-search', 'sem resultado');
  await tab.until('document.body.innerText.includes("Nenhum cliente encontrado")');
  await tab.click('.text-action');
  await tab.until('!!document.querySelector(".clients-table [data-client-link]")');
  console.log('PASS: busca por empresa e estado de nenhum resultado.');

  await tab.viewport(390);
  await tab.until('!!document.querySelector(".clients-mobile-list [data-client-link]")');
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.screenshot('clients-list-mobile');
  await tab.viewport(320);
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.viewport(1440);
  await tab.click('.clients-table [data-client-link]');
  await tab.until(
    'location.pathname.startsWith("/clientes/") && document.querySelector("h1")?.textContent === "Navari Studio"',
  );
  await tab.fill('name', 'Navari Studio Atualizado');
  await tab.fill('email', 'novo@navari.example');
  await tab.fill('phone', '+55 11 97777-6666');
  await tab.fill('company', 'Navari Produtos');
  await tab.click('[data-client-action="save"]');
  await tab.until(
    'document.body.innerText.includes("Navari Studio Atualizado foi atualizado com sucesso.")',
  );
  await tab.screenshot('client-detail-desktop');
  await tab.reload();
  await tab.until(
    'document.querySelector("h1")?.textContent === "Navari Studio Atualizado" && document.querySelector("[name=email]")?.value === "novo@navari.example"',
  );
  console.log('PASS: detalhe, edição e persistência após reload.');

  await tab.click('[data-client-action="archive"]');
  await tab.until(
    'document.body.innerText.includes("Cliente arquivado com sucesso.") && !!document.querySelector("[data-client-action=restore]")',
  );
  await tab.navigate('/clientes');
  await tab.until('document.body.innerText.includes("Cadastre seu primeiro cliente")');
  await tab.click('[data-client-status="archived"]');
  await tab.until('!!document.querySelector(".clients-table [data-client-link]")');
  await tab.click('.clients-table [data-client-link]');
  await tab.until('!!document.querySelector("[data-client-action=restore]")');
  await tab.click('[data-client-action="restore"]');
  await tab.until(
    'document.body.innerText.includes("Cliente restaurado com sucesso.") && !!document.querySelector("[data-client-action=archive]")',
  );
  await tab.navigate('/clientes');
  await tab.until('!!document.querySelector(".clients-table [data-client-link]")');
  console.log('PASS: arquivamento remove dos ativos, filtro de arquivados e restauração.');

  const clientPath = await tab.evaluate(
    'document.querySelector(".clients-table [data-client-link]").getAttribute("href")',
  );
  const clientId = clientPath.split('/').at(-1);
  await tab.navigate('/projetos');
  await tab.until('document.body.innerText.includes("Crie seu primeiro projeto")');
  await tab.screenshot('projects-empty-desktop');
  await tab.click('[data-project-action="new"]');
  await tab.until('document.querySelector(".project-dialog").open');
  await tab.until('document.activeElement.name === "name"');
  await tab.fill('name', 'Portal Navari');
  await tab.setValue('[name="clientId"]', clientId);
  await tab.fill('description', 'Entrega digital da nova operação.');
  await tab.setValue('[name="startDate"]', '2026-09-15');
  await tab.setValue('[name="dueDate"]', '2026-11-30');
  await tab.fill('budget', '12500.50');
  await tab.setValue('[name="progress"]', '10');
  await tab.click('[data-project-action="create"]');
  await tab.until(
    'document.body.innerText.includes("Portal Navari foi cadastrado com sucesso.") && !!document.querySelector(".projects-table [data-project-link]")',
  );
  await tab.screenshot('projects-list-desktop');
  console.log('PASS: criação de projeto com cliente ativo atualiza a lista sem reload.');

  await tab.fillSelector('#project-search', 'Navari Studio Atualizado');
  await tab.until(
    'document.querySelectorAll(".projects-table tbody tr").length === 1 && document.body.innerText.includes("Portal Navari")',
  );
  await tab.fillSelector('#project-search', 'sem resultado');
  await tab.until('document.body.innerText.includes("Nenhum projeto encontrado")');
  await tab.click('.text-action');
  await tab.until('!!document.querySelector(".projects-table [data-project-link]")');
  await tab.setValue('[data-project-filter="status"]', 'PLANNING');
  await tab.until('document.querySelectorAll(".projects-table tbody tr").length === 1');
  await tab.setValue('[data-project-filter="client"]', clientId);
  await tab.until('document.querySelectorAll(".projects-table tbody tr").length === 1');
  console.log('PASS: busca por cliente e filtros de status e cliente.');

  await tab.viewport(390);
  await tab.until('!!document.querySelector(".projects-mobile-list [data-project-link]")');
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.screenshot('projects-list-mobile');
  await tab.viewport(320);
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.viewport(1440);
  await tab.click('.projects-table [data-project-link]');
  await tab.until(
    'location.pathname.startsWith("/projetos/") && document.querySelector("h1")?.textContent === "Portal Navari"',
  );
  const projectPath = await tab.evaluate('location.pathname');
  await tab.fill('name', 'Portal Navari 2.0');
  await tab.setValue('[name="progress"]', '65');
  await tab.fill('budget', '15000.75');
  await tab.click('[data-project-action="save"]');
  await tab.until(
    'document.body.innerText.includes("Portal Navari 2.0 foi atualizado com sucesso.") && document.body.innerText.includes("65%")',
  );
  await tab.screenshot('project-detail-desktop');
  await tab.reload();
  await tab.until(
    'document.querySelector("h1")?.textContent === "Portal Navari 2.0" && document.querySelector("[name=progress]")?.value === "65"',
  );
  console.log('PASS: detalhe, edição de progresso/orçamento e persistência após reload.');

  await tab.click('[name="progressMode"][value="AUTO"]');
  await tab.click('[data-project-action="save"]');
  await tab.until(
    'document.querySelector("[name=progress]").disabled && document.body.innerText.includes("Calculado pelas tarefas concluídas") && document.body.innerText.includes("0%")',
  );
  await tab.click('[data-task-action="new"]');
  await tab.until(
    'document.querySelector(".task-dialog").open && document.activeElement.name === "title"',
  );
  await tab.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.until('!document.querySelector(".task-dialog")');
  await tab.click('[data-task-action="new"]');
  await tab.until(
    'document.querySelector(".task-dialog").open && document.activeElement.name === "title"',
  );
  await tab.fill('title', 'Preparar arquitetura');
  await tab.until(
    'document.querySelector(".task-dialog [name=title]").value === "Preparar arquitetura"',
  );
  await tab.fill('description', 'Definir o fluxo principal.');
  await tab.until(
    'document.querySelector(".task-dialog [name=description]").value === "Definir o fluxo principal."',
  );
  await tab.setValue('[name="priority"]', 'HIGH');
  await tab.setValue('[name="dueDate"]', '2026-10-15');
  await tab.until(
    'document.querySelector(".task-dialog [name=priority]").value === "HIGH" && document.querySelector(".task-dialog [name=dueDate]").value === "2026-10-15"',
  );
  await tab.click('[name="isClientVisible"]');
  await tab.click('[data-task-action="save"]');
  await tab.until(
    '!document.querySelector(".task-dialog") && document.querySelectorAll(".task-card").length === 1 && document.body.innerText.includes("Preparar arquitetura") && document.body.innerText.includes("15/10/2026") && document.body.innerText.includes("0%")',
  );
  await tab.click('[data-task-action="new"]');
  await tab.until('document.querySelector(".task-dialog").open');
  await tab.fill('title', 'Implementar interface');
  await tab.setValue('[name="priority"]', 'URGENT');
  await tab.click('[data-task-action="save"]');
  await tab.until(
    '!document.querySelector(".task-dialog") && document.querySelectorAll(".task-card").length === 2',
  );
  const rollbackTaskId = await tab.evaluate(
    'document.querySelector(".kanban-column[data-status=TODO] .task-card").dataset.taskId',
  );
  await tab.send('Network.setBlockedURLs', {
    urls: [`*/api/v1/tasks/${rollbackTaskId}/move`],
  });
  await tab.click(
    '.kanban-column[data-status="TODO"] .task-card:first-child [data-task-action="toggle"]',
  );
  await tab.until(
    'document.body.innerText.includes("Não foi possível mover a tarefa.") && document.querySelectorAll(".kanban-column[data-status=TODO] .task-card").length === 2',
  );
  await tab.send('Network.setBlockedURLs', { urls: [] });
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=TODO] .task-card:first-child .task-drag-handle").disabled',
  );
  await tab.drag(
    '.kanban-column[data-status="TODO"] .task-card:first-child .task-drag-handle',
    '.kanban-column[data-status="IN_PROGRESS"]',
  );
  await tab.until(
    'document.querySelectorAll(".kanban-column[data-status=IN_PROGRESS] .task-card").length === 1 && document.body.innerText.includes("0%")',
  );
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=IN_PROGRESS] .task-card [data-task-action=status]").disabled',
  );
  await tab.setValue(
    '.kanban-column[data-status="IN_PROGRESS"] .task-card [data-task-action="status"]',
    'DONE',
  );
  await tab.until(
    'document.querySelectorAll(".kanban-column[data-status=DONE] .task-card").length === 1 && document.body.innerText.includes("50%")',
  );
  const completedTaskId = await tab.evaluate(
    'document.querySelector(".kanban-column[data-status=DONE] .task-card").dataset.taskId',
  );
  await tab.until(
    `import('/src/tasks/task-api.ts').then(({ getTask }) => getTask(${JSON.stringify(completedTaskId)})).then((task) => typeof task.completedAt === 'string')`,
  );
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=DONE] .task-card [data-task-action=toggle]").disabled',
  );
  await tab.setValue(
    '.kanban-column[data-status="DONE"] .task-card [data-task-action="status"]',
    'TODO',
  );
  await tab.until(
    `import('/src/tasks/task-api.ts').then(({ getTask }) => getTask(${JSON.stringify(completedTaskId)})).then((task) => task.completedAt === null)`,
  );
  await tab.until(
    'document.querySelectorAll(".kanban-column[data-status=TODO] .task-card").length === 2 && document.body.innerText.includes("0%")',
  );
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=TODO] .task-card [data-task-action=status]").disabled',
  );
  const orderBefore = await tab.evaluate(
    '[...document.querySelectorAll(".kanban-column[data-status=TODO] .task-card strong")].map((item) => item.textContent).join("|")',
  );
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=TODO] .task-card:first-child .task-drag-handle").disabled',
  );
  await tab.drag(
    '.kanban-column[data-status="TODO"] .task-card:first-child .task-drag-handle',
    '.kanban-column[data-status="TODO"] .task-card:last-child',
  );
  await tab.until(
    `[...document.querySelectorAll(".kanban-column[data-status=TODO] .task-card strong")].map((item) => item.textContent).join("|") !== ${JSON.stringify(orderBefore)}`,
  );
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=TODO] .task-card:first-child [data-task-action=edit]").disabled',
  );
  await tab.pointerClick(
    '.kanban-column[data-status="TODO"] .task-card:first-child [data-task-action="edit"]',
  );
  await tab.until('document.querySelector(".task-dialog").open');
  await tab.fill('title', 'Implementar interface revisada');
  await tab.setValue('[name="priority"]', 'LOW');
  await tab.click('[data-task-action="save"]');
  await tab.until(
    '!document.querySelector(".task-dialog") && document.body.innerText.includes("Implementar interface revisada foi atualizada.")',
  );
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=TODO] .task-card:first-child [data-task-action=toggle]").disabled',
  );
  await tab.click(
    '.kanban-column[data-status="TODO"] .task-card:first-child [data-task-action="toggle"]',
  );
  await tab.until('document.body.innerText.includes("50%")');
  await tab.reload();
  await tab.until(
    'document.querySelectorAll(".task-card").length === 2 && document.querySelectorAll(".kanban-column[data-status=DONE] .task-card").length === 1 && document.body.innerText.includes("50%") && document.body.innerText.includes("15/10/2026")',
  );
  await tab.viewport(390);
  assert.deepEqual(
    await tab.evaluate(`(() => {
      const board = document.querySelector('.kanban-board');
      return {
        pageOverflows: document.body.scrollWidth > document.documentElement.clientWidth,
        boardInsideViewport: board.getBoundingClientRect().right <= document.documentElement.clientWidth,
        boardHasControlledScroll: board.scrollWidth > board.clientWidth && getComputedStyle(board).overflowX === 'auto',
      };
    })()`),
    { pageOverflows: false, boardInsideViewport: true, boardHasControlledScroll: true },
  );
  await tab.screenshot('project-kanban-mobile');
  await tab.viewport(1440);
  console.log(
    'PASS: criação, edição, movimento, reabertura, reordenação e persistência do Kanban com progresso AUTO.',
  );

  await tab.click('.kanban-column[data-status="TODO"] .task-card [data-task-action="delete"]');
  await tab.until('!!document.querySelector(".confirm-dialog[open]")');
  await tab.click('[data-task-action="confirm-delete"]');
  await tab.until(
    '!document.querySelector(".confirm-dialog").open && document.querySelectorAll(".task-card").length === 1 && document.body.innerText.includes("100%")',
  );
  await tab.navigate('/tarefas');
  await tab.until(
    'document.querySelectorAll(".tasks-table tbody tr").length === 1 && document.body.innerText.includes("Portal Navari 2.0")',
  );
  const globalProjectId = await tab.evaluate(
    'document.querySelector(".tasks-table tbody tr td:nth-child(2) a").getAttribute("href").split("/").at(-1)',
  );
  const filterRequestsBefore = taskRequests;
  await tab.setValue('[data-task-filter="project"]', globalProjectId);
  await tab.setValue('[data-task-filter="status"]', 'DONE');
  await tab.setValue('[data-task-filter="priority"]', 'LOW');
  await tab.setValue('[data-task-filter="due"]', 'upcoming');
  await tab.until(
    'document.querySelectorAll(".tasks-table tbody tr").length === 1 && document.querySelector("[data-task-filter=project]").value && document.querySelector("[data-task-filter=status]").value === "DONE" && document.querySelector("[data-task-filter=priority]").value === "LOW" && document.querySelector("[data-task-filter=due]").value === "upcoming"',
  );
  assert(taskRequests > filterRequestsBefore);
  await tab.setValue('[data-task-filter="project"]', '');
  await tab.setValue('[data-task-filter="status"]', '');
  await tab.setValue('[data-task-filter="priority"]', '');
  await tab.setValue('[data-task-filter="due"]', 'all');
  await tab.fillSelector('#task-search', 'sem resultado');
  await tab.until('document.body.innerText.includes("Nenhuma tarefa encontrada")');
  await tab.click('.text-action');
  await tab.until('document.querySelectorAll(".tasks-table tbody tr").length === 1');
  await tab.viewport(390);
  await tab.until('document.querySelectorAll(".tasks-mobile-list li").length === 1');
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.screenshot('tasks-global-mobile');
  await tab.viewport(320);
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.viewport(1440);
  await tab.click('.tasks-table tbody tr td:nth-child(2) a');
  await tab.until(
    `location.pathname === ${JSON.stringify(projectPath)} && !!document.querySelector('[name="progressMode"][value="MANUAL"]')`,
  );
  await tab.click('[name="progressMode"][value="MANUAL"]');
  await tab.click('[data-project-action="save"]');
  await tab.until(
    '!document.querySelector("[name=progress]").disabled && document.body.innerText.includes("Atualização manual") && document.querySelector("[name=progress]").value === "100"',
  );
  await tab.setValue('[name="progress"]', '72');
  await tab.click('[data-project-action="save"]');
  await tab.until('document.body.innerText.includes("72%")');
  await tab.until(
    '!document.querySelector(".kanban-column[data-status=DONE] .task-card [data-task-action=toggle]").disabled',
  );
  await tab.setValue(
    '.kanban-column[data-status="DONE"] .task-card [data-task-action="status"]',
    'TODO',
  );
  await tab.until(
    'document.querySelectorAll(".kanban-column[data-status=TODO] .task-card").length === 1 && document.body.innerText.includes("72%")',
  );
  await tab.click('[name="progressMode"][value="AUTO"]');
  await tab.click('[data-project-action="save"]');
  await tab.until(
    'document.body.innerText.includes("0%") && document.querySelector("[name=progress]").disabled',
  );
  const settledTaskRequests = taskRequests;
  await delay(500);
  assert.equal(taskRequests, settledTaskRequests);
  assert(taskRequests < 45);
  console.log(
    'PASS: visão global responsiva, exclusão e transições AUTO ↔ MANUAL sem loops de requests.',
  );

  await tab.navigate('/horas');
  await tab.until(
    '!document.querySelector("[data-time-action=new]").disabled && document.body.innerText.includes("Nenhuma hora registrada")',
  );
  await tab.click('[data-time-action="new"]');
  await tab.until(
    'document.querySelector(".time-entry-dialog").open && document.activeElement.name === "workDate"',
  );
  await tab.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.until('!document.querySelector(".time-entry-dialog")');
  await tab.click('[data-time-action="new"]');
  await tab.until('document.querySelector(".time-entry-dialog").open');
  await tab.setValue('.time-entry-dialog [name="projectId"]', globalProjectId);
  await tab.setValue('.time-entry-dialog [name="workDate"]', '2026-09-15');
  await tab.fillSelector('.time-entry-dialog [name="hours"]', '1');
  await tab.fillSelector('.time-entry-dialog [name="minutes"]', '30');
  await tab.fillSelector(
    '.time-entry-dialog [name="description"]',
    'Implementação do controle de horas',
  );
  await tab.click('[data-time-action="save"]');
  await tab.until(
    '!document.querySelector(".time-entry-dialog") && document.querySelectorAll(".hours-table tbody tr").length === 1 && document.querySelector("[data-hours-overall]").textContent === "1h 30min" && document.querySelector("[data-hours-filtered]").textContent === "1h 30min"',
  );
  await tab.click('[data-time-action="new"]');
  await tab.until('document.querySelector(".time-entry-dialog").open');
  await tab.setValue('.time-entry-dialog [name="projectId"]', globalProjectId);
  await tab.setValue('.time-entry-dialog [name="workDate"]', '2026-09-15');
  await tab.fillSelector('.time-entry-dialog [name="hours"]', '0');
  await tab.fillSelector('.time-entry-dialog [name="minutes"]', '45');
  await tab.fillSelector('.time-entry-dialog [name="description"]', 'Reunião de alinhamento');
  await tab.click('[data-time-action="save"]');
  await tab.until(
    '!document.querySelector(".time-entry-dialog") && document.querySelectorAll(".hours-table tbody tr").length === 2 && document.querySelector("[data-hours-overall]").textContent === "2h 15min"',
  );
  await tab.evaluate(`(() => {
    const row = [...document.querySelectorAll('.hours-table tbody tr')]
      .find((candidate) => candidate.textContent.includes('Implementação do controle de horas'));
    row.querySelector('button[aria-label^="Editar"]')?.click();
  })()`);
  await tab.until('document.querySelector(".time-entry-dialog").open');
  await tab.fillSelector('.time-entry-dialog [name="hours"]', '2');
  await tab.fillSelector('.time-entry-dialog [name="minutes"]', '0');
  await tab.fillSelector(
    '.time-entry-dialog [name="description"]',
    'Implementação revisada do controle de horas',
  );
  await tab.click('[data-time-action="save"]');
  await tab.until(
    '!document.querySelector(".time-entry-dialog") && document.querySelector("[data-hours-overall]").textContent === "2h 45min" && document.body.innerText.includes("Registro de horas atualizado.")',
  );
  await tab.reload();
  await tab.until(
    'document.querySelector("[data-hours-overall]").textContent === "2h 45min" && document.body.innerText.includes("Implementação revisada do controle de horas")',
  );
  await tab.setValue('[data-time-filter="project"]', globalProjectId);
  const globalClientId = await tab.evaluate(
    `document.querySelector('[data-time-filter="client"] option:not([value=""])').value`,
  );
  await tab.setValue('[data-time-filter="client"]', globalClientId);
  await tab.setValue('[data-time-filter="from"]', '2026-09-15');
  await tab.setValue('[data-time-filter="to"]', '2026-09-15');
  await tab.fillSelector('#hours-search', 'Implementação revisada');
  await tab.until(
    'document.querySelectorAll(".hours-table tbody tr").length === 1 && document.querySelector("[data-hours-filtered]").textContent === "2h"',
  );
  await tab.viewport(390);
  await tab.until('document.querySelectorAll(".hours-mobile-list li").length === 1');
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.screenshot('hours-global-mobile');
  await tab.viewport(320);
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.viewport(1440);
  await tab.navigate(projectPath);
  await tab.until(
    'document.querySelector(".project-time-section [data-time-total]").textContent === "2h 45min" && document.querySelectorAll(".project-time-list li").length === 2',
  );
  await tab.evaluate(`(() => {
    const row = [...document.querySelectorAll('.project-time-list li')]
      .find((candidate) => candidate.textContent.includes('Reunião de alinhamento'));
    row.querySelector('button[aria-label^="Excluir"]')?.click();
  })()`);
  await tab.until('!!document.querySelector(".confirm-dialog[open]")');
  await tab.click('[data-time-action="confirm-delete"]');
  await tab.until(
    '!document.querySelector(".confirm-dialog[open]") && document.querySelector(".project-time-section [data-time-total]").textContent === "2h" && document.querySelectorAll(".project-time-list li").length === 1',
  );
  const remainingTimeEntryId = await tab.evaluate(
    'document.querySelector(".project-time-list li").dataset.timeEntryId',
  );
  const settledTimeEntryRequests = timeEntryRequests;
  await delay(500);
  assert.equal(timeEntryRequests, settledTimeEntryRequests);
  console.log(
    'PASS: Horas registra 1h30 + 45min, soma 2h15, edita, persiste, filtra, integra ao projeto e exclui atualizando o total.',
  );

  await tab.navigate('/financeiro');
  await tab.until(
    '!document.querySelector("[data-payment-action=new]").disabled && document.body.innerText.includes("Nenhuma cobrança registrada")',
  );
  await tab.click('[data-payment-action="new"]');
  await tab.until(
    'document.querySelector(".payment-dialog").open && document.activeElement.name === "description"',
  );
  await tab.send('Input.dispatchKeyEvent', {
    type: 'rawKeyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.until('!document.querySelector(".payment-dialog")');

  const createBrowserPayment = async (description, amount, dueDate) => {
    await tab.click('[data-payment-action="new"]');
    await tab.until('document.querySelector(".payment-dialog").open');
    await tab.setValue('.payment-dialog [name="projectId"]', globalProjectId);
    await tab.fillSelector('.payment-dialog [name="description"]', description);
    await tab.fillSelector('.payment-dialog [name="amount"]', amount);
    await tab.setValue('.payment-dialog [name="dueDate"]', dueDate);
    await tab.click('[data-payment-action="save"]');
    await tab.until(
      `!document.querySelector(".payment-dialog") && document.body.innerText.includes(${JSON.stringify(description)})`,
    );
  };
  await createBrowserPayment('Entrada do projeto', '1000', dateInTimeZone(1));
  await createBrowserPayment('Parcela vencida', '500,00', dateInTimeZone(-1));
  await tab.until(
    'document.querySelector("[data-finance-total=expected]").textContent.includes("1.500,00") && document.querySelector("[data-finance-total=pending]").textContent.includes("1.500,00") && document.querySelector("[data-finance-total=overdue]").textContent.includes("500,00")',
  );

  await tab.evaluate(`(() => {
    const row = [...document.querySelectorAll('.finance-table tbody tr')]
      .find((candidate) => candidate.textContent.includes('Entrada do projeto'));
    row.querySelector('.payment-row-actions button')?.click();
  })()`);
  await tab.until(
    'document.querySelector("[data-finance-total=paid]").textContent.includes("1.000,00") && document.querySelector("[data-finance-total=pending]").textContent.includes("500,00")',
  );
  await tab.evaluate(`(() => {
    const row = [...document.querySelectorAll('.finance-table tbody tr')]
      .find((candidate) => candidate.textContent.includes('Entrada do projeto'));
    row.querySelector('.payment-row-actions button')?.click();
  })()`);
  await tab.until(
    'document.querySelector("[data-finance-total=paid]").textContent.includes("0,00") && document.querySelector("[data-finance-total=pending]").textContent.includes("1.500,00")',
  );
  await tab.evaluate(`(() => {
    const row = [...document.querySelectorAll('.finance-table tbody tr')]
      .find((candidate) => candidate.textContent.includes('Parcela vencida'));
    row.querySelector('button[aria-label^="Editar"]')?.click();
  })()`);
  await tab.until('document.querySelector(".payment-dialog").open');
  assert.equal(
    await tab.evaluate('!!document.querySelector(".payment-dialog [name=projectId][type=hidden]")'),
    true,
  );
  await tab.fillSelector('.payment-dialog [name="amount"]', '600,00');
  await tab.click('[data-payment-action="save"]');
  await tab.until(
    '!document.querySelector(".payment-dialog") && document.querySelector("[data-finance-total=expected]").textContent.includes("1.600,00")',
  );
  await tab.reload();
  await tab.until(
    'document.querySelector("[data-finance-total=expected]").textContent.includes("1.600,00") && document.body.innerText.includes("Parcela vencida")',
  );
  await tab.setValue('[data-payment-filter="status"]', 'OVERDUE');
  await tab.setValue('[data-payment-filter="project"]', globalProjectId);
  const financeClientId = await tab.evaluate(
    `document.querySelector('[data-payment-filter="client"] option:not([value=""])').value`,
  );
  await tab.setValue('[data-payment-filter="client"]', financeClientId);
  await tab.fillSelector('#finance-search', 'Parcela vencida');
  await tab.until(
    'document.querySelectorAll(".finance-table tbody tr").length === 1 && document.querySelector("[data-finance-total=overdue]").textContent.includes("600,00")',
  );
  await tab.viewport(390);
  await tab.until('document.querySelectorAll(".finance-mobile-list li").length === 1');
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.screenshot('finance-global-mobile');
  await tab.viewport(320);
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  await tab.viewport(1440);
  await tab.navigate(projectPath);
  await tab.until(
    'document.querySelector("[data-project-payment-total=expected]").textContent.includes("1.600,00") && document.querySelectorAll(".project-payment-list li").length === 2',
  );
  await tab.evaluate(`(() => {
    const row = [...document.querySelectorAll('.project-payment-list li')]
      .find((candidate) => candidate.textContent.includes('Parcela vencida'));
    row.querySelector('button[aria-label^="Excluir"]')?.click();
  })()`);
  await tab.until('!!document.querySelector(".confirm-dialog[open]")');
  assert.equal(await tab.evaluate('document.activeElement.textContent.trim()'), 'Cancelar');
  await tab.click('[data-payment-action="confirm-delete"]');
  await tab.until(
    '!document.querySelector(".confirm-dialog[open]") && document.querySelector("[data-project-payment-total=expected]").textContent.includes("1.000,00") && document.querySelectorAll(".project-payment-list li").length === 1',
  );
  const remainingPaymentId = await tab.evaluate(
    'document.querySelector(".project-payment-list li").dataset.paymentId',
  );
  const settledPaymentRequests = paymentRequests;
  await delay(500);
  assert.equal(paymentRequests, settledPaymentRequests);
  console.log(
    'PASS: Financeiro soma 1000 + 500, paga/reabre, edita com decimal BRL, persiste, filtra, identifica vencido e atualiza totais após excluir.',
  );

  await tab.navigate(clientPath);
  await tab.until('!!document.querySelector("[data-client-action=delete]")');
  await tab.click('[data-client-action="delete"]');
  await tab.until('document.querySelector(".confirmation-dialog").open');
  assert.equal(await tab.evaluate('document.activeElement.textContent.trim()'), 'Cancelar');
  await tab.screenshot('client-delete-confirmation');
  await tab.click('[data-client-action="confirm-delete"]');
  await tab.until(
    'document.querySelector(".confirmation-dialog").open && document.body.innerText.includes("possui projetos e não pode ser excluído")',
  );
  await tab.screenshot('client-delete-blocked');
  await tab.click('.confirmation-dialog .secondary-button');
  await tab.until('!document.querySelector(".confirmation-dialog").open');
  console.log('PASS: cliente com projeto recebe bloqueio 409 com feedback claro.');

  await tab.navigate(projectPath);
  await tab.click('[data-project-action="archive"]');
  await tab.until(
    'document.body.innerText.includes("Projeto arquivado com sucesso.") && !!document.querySelector("[data-project-action=restore]")',
  );
  assert.equal(
    await tab.evaluate(
      'document.querySelector("[data-task-action=new]").disabled && [...document.querySelectorAll(".task-drag-handle")].every((button) => button.disabled)',
    ),
    true,
  );
  await tab.until(
    'document.body.innerText.includes("Restaure o projeto para alterar os registros de horas.") && !!document.querySelector(".project-time-list li") && !document.querySelector("[data-time-action=new-project-entry]")',
  );
  await tab.until(
    'document.body.innerText.includes("Restaure o projeto para alterar suas cobranças.") && !!document.querySelector(".project-payment-list li") && !document.querySelector("[data-payment-action=new-project-payment]")',
  );
  assert.equal(
    await tab.evaluate(
      `Promise.all([
        import('/src/time-entries/time-entry-api.ts').then(({ createTimeEntry }) =>
          createTimeEntry({ projectId: ${JSON.stringify(globalProjectId)}, workDate: '2026-09-15', hours: 0, minutes: 10, description: 'Bloqueado' }).then(() => false, (error) => error.status === 409)),
        import('/src/time-entries/time-entry-api.ts').then(({ updateTimeEntry }) =>
          updateTimeEntry(${JSON.stringify(remainingTimeEntryId)}, { projectId: ${JSON.stringify(globalProjectId)}, workDate: '2026-09-15', hours: 2, minutes: 1, description: 'Bloqueado' }).then(() => false, (error) => error.status === 409)),
        import('/src/time-entries/time-entry-api.ts').then(({ deleteTimeEntry }) =>
          deleteTimeEntry(${JSON.stringify(remainingTimeEntryId)}).then(() => false, (error) => error.status === 409)),
      ]).then((results) => results.every(Boolean))`,
    ),
    true,
  );
  assert.equal(
    await tab.evaluate(
      `Promise.all([
        import('/src/payments/payment-api.ts').then(({ createPayment }) =>
          createPayment({ projectId: ${JSON.stringify(globalProjectId)}, description: 'Bloqueada', amount: '10,00', dueDate: ${JSON.stringify(dateInTimeZone())} }).then(() => false, (error) => error.status === 409)),
        import('/src/payments/payment-api.ts').then(({ updatePayment }) =>
          updatePayment(${JSON.stringify(remainingPaymentId)}, { projectId: ${JSON.stringify(globalProjectId)}, description: 'Bloqueada', amount: '10,00', dueDate: ${JSON.stringify(dateInTimeZone())} }).then(() => false, (error) => error.status === 409)),
        import('/src/payments/payment-api.ts').then(({ changePaymentStatus }) =>
          changePaymentStatus(${JSON.stringify(remainingPaymentId)}, 'pay').then(() => false, (error) => error.status === 409)),
        import('/src/payments/payment-api.ts').then(({ changePaymentStatus }) =>
          changePaymentStatus(${JSON.stringify(remainingPaymentId)}, 'reopen').then(() => false, (error) => error.status === 409)),
        import('/src/payments/payment-api.ts').then(({ deletePayment }) =>
          deletePayment(${JSON.stringify(remainingPaymentId)}).then(() => false, (error) => error.status === 409)),
      ]).then((results) => results.every(Boolean))`,
    ),
    true,
  );
  await tab.navigate('/projetos');
  await tab.until('document.body.innerText.includes("Crie seu primeiro projeto")');
  await tab.click('[data-project-view="archived"]');
  await tab.until('!!document.querySelector(".projects-table [data-project-link]")');
  await tab.click('.projects-table [data-project-link]');
  await tab.until('!!document.querySelector("[data-project-action=restore]")');
  await tab.click('[data-project-action="restore"]');
  await tab.until(
    'document.body.innerText.includes("Projeto restaurado com sucesso.") && !!document.querySelector("[data-project-action=archive]")',
  );
  await tab.click('[data-time-action="new-project-entry"]');
  await tab.until('document.querySelector(".time-entry-dialog").open');
  await tab.setValue('.time-entry-dialog [name="workDate"]', '2026-09-16');
  await tab.fillSelector('.time-entry-dialog [name="hours"]', '0');
  await tab.fillSelector('.time-entry-dialog [name="minutes"]', '15');
  await tab.fillSelector('.time-entry-dialog [name="description"]', 'Após restauração');
  await tab.click('[data-time-action="save"]');
  await tab.until(
    '!document.querySelector(".time-entry-dialog") && document.querySelector(".project-time-section [data-time-total]").textContent === "2h 15min"',
  );
  await tab.evaluate(
    'document.querySelector(".project-payment-list .payment-row-actions button")?.click()',
  );
  await tab.until(
    'document.querySelector("[data-project-payment-total=paid]").textContent.includes("1.000,00")',
  );
  console.log(
    'PASS: projeto arquivado mantém horas e financeiro visíveis, bloqueia mutações e restauração reativa operações.',
  );

  await tab.click('[data-project-action="delete"]');
  await tab.until('document.querySelector(".confirmation-dialog").open');
  assert.equal(await tab.evaluate('document.activeElement.textContent.trim()'), 'Cancelar');
  await tab.click('[data-project-action="confirm-delete"]');
  await tab.until(
    'location.pathname === "/projetos" && document.body.innerText.includes("foi excluído permanentemente") && document.body.innerText.includes("Crie seu primeiro projeto")',
  );
  const settledProjectRequests = projectRequests;
  await delay(500);
  assert.equal(projectRequests, settledProjectRequests);
  console.log('PASS: confirmação, exclusão permanente do projeto e nenhuma chamada em loop.');

  await tab.navigate(clientPath);
  await tab.click('[data-client-action="delete"]');
  await tab.until('document.querySelector(".confirmation-dialog").open');
  await tab.click('[data-client-action="confirm-delete"]');
  await tab.until(
    'location.pathname === "/clientes" && document.body.innerText.includes("foi excluído permanentemente") && document.body.innerText.includes("Cadastre seu primeiro cliente")',
  );
  const settledClientRequests = clientRequests;
  await delay(500);
  assert.equal(clientRequests, settledClientRequests);
  console.log(
    'PASS: cliente pode ser excluído após a remoção do projeto e não há chamadas em loop.',
  );

  await tab.viewport(390);
  await tab.click('.mobile-menu-trigger');
  await tab.until('document.querySelector("#mobile-navigation").open');
  assert.equal(
    await tab.evaluate('document.activeElement.getAttribute("aria-label")'),
    'Fechar menu de navegação',
  );
  await tab.screenshot('navigation-mobile');
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Escape',
    code: 'Escape',
    windowsVirtualKeyCode: 27,
  });
  await tab.until('!document.querySelector("#mobile-navigation").open');
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await tab.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  assert.equal(
    await tab.evaluate('getComputedStyle(document.activeElement).outlineStyle'),
    'solid',
  );
  assert.equal(
    await tab.evaluate(
      'document.documentElement.scrollWidth > document.documentElement.clientWidth',
    ),
    false,
  );
  assert.deepEqual(exceptions, []);
  console.log(
    `PASS: menu móvel, Escape, foco visível, sem overflow (320–1440 px), sem exceções JS. Capturas: ${output}`,
  );
} catch (error) {
  console.error(error);
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
