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
  const clientsStart = clientRequests;
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

  await tab.click('.clients-table [data-client-link]');
  await tab.until('!!document.querySelector("[data-client-action=delete]")');
  await tab.click('[data-client-action="delete"]');
  await tab.until('document.querySelector(".confirmation-dialog").open');
  assert.equal(await tab.evaluate('document.activeElement.textContent.trim()'), 'Cancelar');
  await tab.screenshot('client-delete-confirmation');
  await tab.click('[data-client-action="confirm-delete"]');
  await tab.until(
    'location.pathname === "/clientes" && document.body.innerText.includes("foi excluído permanentemente") && document.body.innerText.includes("Cadastre seu primeiro cliente")',
  );
  const settledClientRequests = clientRequests;
  await delay(500);
  assert.equal(clientRequests, settledClientRequests);
  assert(clientRequests - clientsStart < 30);
  console.log('PASS: confirmação acessível, exclusão permanente e nenhuma chamada em loop.');

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
