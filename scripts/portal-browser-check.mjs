import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { database } from '../backend/src/config/database.ts';
const origin = 'http://127.0.0.1:5173';
const email = `portal-browser-${randomUUID()}@example.test`;
const output = process.env.PORTAL_SCREENSHOT_DIR ?? '/private/tmp/devflow-stage10';
const sockets = [];
const exceptions = [];
const contexts = [];
let watchPublic = false;
let publicAuthRequests = 0;
let publicPortalRequests = 0;
let publicCookieHeaders = 0;
let publicReferrers = 0;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function connect(url, monitorPublic = false) {
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
      if (message.error) task.reject(new Error(`CDP: ${task.method} falhou.`));
      else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown')
      exceptions.push(message.params.exceptionDetails.text);
    if (watchPublic && monitorPublic && message.method === 'Network.requestWillBeSent') {
      const { request } = message.params;
      if (request.url.includes('/api/v1/auth/')) publicAuthRequests++;
      if (request.url.includes('/api/v1/portal/')) {
        publicPortalRequests++;
        if (request.headers.Cookie || request.headers.cookie) publicCookieHeaders++;
        if (request.headers.Referer || request.headers.referer) publicReferrers++;
      }
    }
    if (watchPublic && monitorPublic && message.method === 'Network.requestWillBeSentExtraInfo') {
      const headers = message.params.headers;
      if (headers.Cookie || headers.cookie) publicCookieHeaders++;
      const referrer = headers.Referer ?? headers.referer;
      if (
        typeof referrer === 'string' &&
        /^\/(?:api\/v1\/)?portal\//.test(new URL(referrer).pathname)
      )
        publicReferrers++;
    }
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      const timeout = setTimeout(() => {
        pending.delete(callId);
        reject(new Error(`CDP timeout: ${method}`));
      }, 20000);
      pending.set(callId, { resolve, reject, timeout, method });
      socket.send(JSON.stringify({ id: callId, method, params }));
    });
}
async function page(browser, context, monitorPublic = false) {
  const { targetId } = await browser('Target.createTarget', {
    url: 'about:blank',
    browserContextId: context,
  });
  const targets = await fetch('http://127.0.0.1:9222/json/list').then((response) =>
    response.json(),
  );
  const target = targets.find((item) => item.id === targetId);
  assert(target);
  const send = await connect(target.webSocketDebuggerUrl, monitorPublic);
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
    throw new Error('A verificação do navegador excedeu o tempo esperado.');
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
      '!document.documentElement.dataset.beforeReload && document.readyState === "complete" && !!document.querySelector("h1")',
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
try {
  await mkdir(output, { recursive: true });
  const registered = await fetch(`${origin}/api/v1/auth/register`, {
    method: 'POST',
    headers: { Origin: origin, 'X-DevFlow-Request': '1', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Portal Browser',
      email,
      password: 'DevFlow8',
      timezone: 'America/Sao_Paulo',
    }),
  });
  assert.equal(registered.status, 201);
  const version = await fetch('http://127.0.0.1:9222/json/version').then((r) => r.json());
  browser = await connect(version.webSocketDebuggerUrl);
  for (let i = 0; i < 2; i++)
    contexts.push((await browser('Target.createBrowserContext')).browserContextId);
  const admin = await page(browser, contexts[0]);
  const visitor = await page(browser, contexts[1], true);
  await admin.viewport(1440);
  await admin.navigate('/login');
  await admin.fill('email', email);
  await admin.fill('password', 'DevFlow8');
  await admin.click('.auth-submit');
  await admin.until('location.pathname === "/dashboard"');
  await admin.navigate('/clientes');
  await admin.until('!!document.querySelector("[data-client-action=new]")');
  await admin.click('[data-client-action="new"]');
  await admin.until('document.querySelector(".client-dialog").open');
  await admin.fill('name', 'Estúdio Aurora');
  await admin.fill('email', 'cliente-aurora@example.test');
  await admin.click('[data-client-action="create"]');
  await admin.until('!!document.querySelector(".clients-table [data-client-link]")');
  const clientId = (
    await admin.evaluate(
      'document.querySelector(".clients-table [data-client-link]").getAttribute("href")',
    )
  )
    .split('/')
    .at(-1);
  await admin.navigate('/projetos');
  await admin.until('!!document.querySelector("[data-project-action=new]")');
  await admin.click('[data-project-action="new"]');
  await admin.until('document.querySelector(".project-dialog").open');
  await admin.fill('name', 'Aurora — presença digital');
  await admin.setValue('[name="clientId"]', clientId);
  await admin.fill(
    'description',
    'Uma nova experiência digital para conectar o Estúdio Aurora a quem valoriza design. Acompanhe as entregas e os próximos passos do projeto.',
  );
  await admin.setValue('[name="startDate"]', '2026-09-01');
  await admin.setValue('[name="dueDate"]', '2026-11-30');
  await admin.fill('budget', '9876.54');
  await admin.setValue('[name="progress"]', '37');
  await admin.click('[data-project-action="create"]');
  await admin.until('!!document.querySelector(".projects-table [data-project-link]")');
  const projectPath = await admin.evaluate(
    'document.querySelector(".projects-table [data-project-link]").getAttribute("href")',
  );
  const projectId = projectPath.split('/').at(-1);
  await admin.navigate(projectPath);
  await admin.until('!!document.querySelector("[data-task-action=new]")');
  for (const [title, visible, status] of [
    ['Revisão da página inicial', true, 'TODO'],
    ['Análise interna de custos', false, 'DONE'],
  ]) {
    await admin.click('[data-task-action="new"]');
    await admin.until('document.querySelector(".task-dialog").open');
    await admin.fill('title', title);
    await admin.fill(
      'description',
      visible
        ? 'Revise a proposta visual e o conteúdo da primeira entrega.'
        : 'Descrição interna secreta',
    );
    await admin.setValue('.task-dialog [name="status"]', status);
    if (visible) await admin.click('.task-dialog [name="isClientVisible"]');
    await admin.click('[data-task-action="save"]');
    await admin.until('!document.querySelector(".task-dialog")');
  }
  for (const [title, visible, status] of [
    ['Descoberta e direção', true, 'COMPLETED'],
    ['Design e experiência', true, 'IN_PROGRESS'],
    ['Entrega e lançamento', true, 'PENDING'],
    ['Planejamento interno', false, 'PENDING'],
  ]) {
    await admin.evaluate(
      `Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Adicionar etapa')).click()`,
    );
    await admin.until('document.querySelector(".task-dialog").open');
    assert.equal(await admin.evaluate('document.activeElement.name'), 'title');
    await admin.fill('title', title);
    await admin.setValue('.task-dialog [name="status"]', status);
    if (visible) await admin.click('.task-dialog [name="isClientVisible"]');
    await admin.click('[data-stage-action="save"]');
    await admin.until('!document.querySelector(".task-dialog")');
  }
  await admin.click('[aria-label="Mover Entrega e lançamento para cima"]');
  await admin.until(
    'document.querySelectorAll(".stage-admin-list h3")[1]?.textContent === "Entrega e lançamento"',
  );
  await admin.click('[aria-label="Mover Entrega e lançamento para baixo"]');
  await admin.until(
    'document.querySelectorAll(".stage-admin-list h3")[2]?.textContent === "Entrega e lançamento"',
  );
  await admin.click('[aria-label="Editar Planejamento interno"]');
  await admin.until('document.querySelector(".task-dialog").open');
  await admin.fill('title', 'Planejamento interno revisado');
  await admin.click('[data-stage-action="save"]');
  await admin.until('!document.querySelector(".task-dialog")');
  await admin.until(
    'document.activeElement.getAttribute("aria-label") === "Editar Planejamento interno revisado"',
  );
  await database.payment.create({
    data: {
      projectId,
      description: 'Financeiro sigiloso',
      amount: '7654.32',
      dueDate: new Date('2026-10-01'),
    },
  });
  await database.timeEntry.create({
    data: {
      projectId,
      description: 'Horas sigilosas',
      durationMinutes: 420,
      workDate: new Date('2026-09-01'),
    },
  });
  await admin.evaluate(
    'document.querySelector(".portal-admin").scrollIntoView({ block: "start" })',
  );
  await admin.screenshot('admin-desktop');
  await admin.click('[data-portal-action="generate"]');
  await admin.until('!!document.querySelector("[data-portal-url]")');
  let url = await admin.evaluate('document.querySelector("[data-portal-url]").value');
  await browser('Browser.grantPermissions', {
    origin,
    browserContextId: contexts[0],
    permissions: ['clipboardReadWrite', 'clipboardSanitizedWrite'],
  });
  await admin.send('Page.bringToFront');
  await admin.evaluate(
    `Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes('Copiar link')).click()`,
  );
  await admin.until('document.body.innerText.includes("Link copiado.")');
  assert.equal(await admin.evaluate('navigator.clipboard.readText()'), url);
  await admin.evaluate('navigator.clipboard.writeText("")');
  assert.equal(
    await admin.evaluate('Object.keys(localStorage).length + Object.keys(sessionStorage).length'),
    0,
  );
  await admin.reload();
  await admin.until('!!document.querySelector("[data-portal-action=generate]")');
  assert.equal(await admin.evaluate('!!document.querySelector("[data-portal-url]")'), false);
  console.log(
    'PASS: login, cliente/projeto/tarefas/etapas via UI; ordem, edição, foco, geração e cópia; token não recuperado após reload.',
  );

  watchPublic = true;
  await visitor.viewport(1440);
  await visitor.navigate(new URL(url).pathname);
  await visitor.until('!!document.querySelector("#portal-project-title")');
  assert.equal(
    await visitor.evaluate('document.querySelector("#portal-project-title").textContent'),
    'Aurora — presença digital',
  );
  assert.equal(await visitor.evaluate('document.querySelector("progress").value'), 37);
  assert.equal(
    await visitor.evaluate('document.querySelectorAll(".portal-timeline li").length'),
    3,
  );
  assert.equal(await visitor.evaluate('document.querySelectorAll(".portal-tasks li").length'), 1);
  const publicText = await visitor.evaluate('document.body.innerText');
  for (const forbidden of [
    'Análise interna',
    'Descrição interna',
    'Planejamento interno',
    'Financeiro',
    'Horas sigilosas',
    '9.876',
    '7.654',
    email,
  ])
    assert(!publicText.includes(forbidden));
  assert.equal(await visitor.evaluate('!!document.querySelector(".sidebar, .app-shell")'), false);
  assert.equal(
    await visitor.evaluate('document.querySelector("meta[name=robots]").content'),
    'noindex, nofollow',
  );
  assert.equal(
    await visitor.evaluate('document.querySelector("meta[name=referrer]").content'),
    'no-referrer',
  );
  assert.equal(
    (await browser('Storage.getCookies', { browserContextId: contexts[1] })).cookies.length,
    0,
  );
  assert.equal(
    await visitor.evaluate('Object.keys(localStorage).length + Object.keys(sessionStorage).length'),
    0,
  );
  await visitor.reload();
  await visitor.until('!!document.querySelector("#portal-project-title")');
  for (const width of [320, 360, 390, 430, 768, 1024, 1366, 1440]) {
    await visitor.viewport(width);
    await delay(100);
    assert.equal(
      await visitor.evaluate(
        'document.documentElement.scrollWidth > document.documentElement.clientWidth',
      ),
      false,
    );
    await visitor.screenshot(`portal-${width}`);
  }
  await visitor.evaluate('document.activeElement?.blur()');
  await visitor.send('Input.dispatchKeyEvent', {
    type: 'keyDown',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  await visitor.send('Input.dispatchKeyEvent', {
    type: 'keyUp',
    key: 'Tab',
    code: 'Tab',
    windowsVirtualKeyCode: 9,
  });
  assert.equal(
    await visitor.evaluate('getComputedStyle(document.activeElement).outlineStyle'),
    'solid',
  );
  assert.equal(publicAuthRequests, 0, 'Requisições de autenticação no portal');
  assert(publicPortalRequests > 0);
  assert.equal(publicCookieHeaders, 0, 'Cookies enviados pelo portal');
  assert.equal(publicReferrers, 0, 'Referer enviado pelo portal');
  watchPublic = false;
  await admin.click('[name="progressMode"][value="AUTO"]');
  await admin.click('[data-project-action="save"]');
  await admin.until('document.querySelector(".project-overview strong").textContent === "50%"');
  await visitor.reload();
  await visitor.until('document.querySelector("progress")?.value === 50');
  // Logged-in access still uses the public DTO and never mounts the administrative layout.
  await admin.navigate(new URL(url).pathname);
  await admin.until('!!document.querySelector("#portal-project-title")');
  assert.equal(await admin.evaluate('!!document.querySelector(".app-shell")'), false);
  await admin.navigate(projectPath);
  await admin.until('!!document.querySelector("[data-portal-action=revoke]")');
  await admin.click('[data-portal-action="revoke"]');
  await admin.until('!!document.querySelector("dialog[open] [data-confirm-action]")');
  assert.equal(await admin.evaluate('document.activeElement.textContent.trim()'), 'Cancelar');
  await admin.click('dialog[open] [data-confirm-action]');
  await admin.until('document.body.innerText.includes("Link revogado.")');
  await visitor.click('.portal-refresh button');
  await visitor.until(
    'document.body.innerText.includes("Este link não está disponível ou expirou.")',
  );
  assert.equal(await visitor.evaluate('!!document.querySelector("#portal-project-title")'), false);
  await visitor.screenshot('portal-revogado');
  const old = url;
  await admin.click('[data-portal-action="generate"]');
  await admin.until('!!document.querySelector("[data-portal-url]")');
  url = await admin.evaluate('document.querySelector("[data-portal-url]").value');
  assert.notEqual(old, url);
  await visitor.navigate(new URL(old).pathname);
  await visitor.until(
    'document.body.innerText.includes("Este link não está disponível ou expirou.")',
  );
  await visitor.navigate(new URL(url).pathname);
  await visitor.until('!!document.querySelector("#portal-project-title")');
  const beforeRotation = url;
  await admin.click('[data-portal-action="generate"]');
  await admin.until('!!document.querySelector("dialog[open] [data-confirm-action]")');
  await admin.click('dialog[open] [data-confirm-action]');
  await admin.until('!!document.querySelector("[data-portal-url]")');
  url = await admin.evaluate('document.querySelector("[data-portal-url]").value');
  assert.notEqual(beforeRotation, url);
  await visitor.reload();
  await visitor.until(
    'document.body.innerText.includes("Este link não está disponível ou expirou.")',
  );
  await visitor.navigate(new URL(url).pathname);
  await visitor.until('!!document.querySelector("#portal-project-title")');
  await database.portalLink.update({
    where: { projectId },
    data: { expiresAt: new Date(Date.now() - 1000) },
  });
  await visitor.click('.portal-refresh button');
  await visitor.until(
    'document.body.innerText.includes("Este link não está disponível ou expirou.")',
  );
  assert.equal(await visitor.evaluate('!!document.querySelector("#portal-project-title")'), false);
  await admin.navigate(projectPath);
  await admin.until(
    '!!document.querySelector("[data-portal-action=generate]") && !document.querySelector("[data-portal-action=revoke]")',
  );
  await admin.click('[data-portal-action="generate"]');
  await admin.until('!!document.querySelector("[data-portal-url]")');
  url = await admin.evaluate('document.querySelector("[data-portal-url]").value');
  await visitor.navigate(new URL(url).pathname);
  await visitor.until('!!document.querySelector("#portal-project-title")');
  await admin.click('[data-project-action="archive"]');
  await admin.until('!!document.querySelector("dialog[open] [data-confirm-action]")');
  await admin.click('dialog[open] [data-confirm-action]');
  await admin.until('!!document.querySelector("[data-project-action=restore]")');
  await visitor.reload();
  await visitor.until(
    'document.body.innerText.includes("Este link não está disponível ou expirou.")',
  );
  await admin.click('[data-project-action="restore"]');
  await admin.until('!!document.querySelector("[data-project-action=archive]")');
  await visitor.reload();
  await visitor.until(
    'document.body.innerText.includes("Este link não está disponível ou expirou.")',
  );
  await admin.send('Page.bringToFront');
  await admin.click('[aria-label="Excluir Planejamento interno revisado"]');
  await admin.click('.stage-delete-confirm .danger-link');
  await admin.until(`!document.querySelector('[data-stage-row="Planejamento interno revisado"]')`);
  for (const width of [320, 360, 390, 430, 768, 1024, 1366, 1440]) {
    await admin.viewport(width);
    await delay(100);
    assert.equal(
      await admin.evaluate(
        'document.documentElement.scrollWidth > document.documentElement.clientWidth',
      ),
      false,
    );
  }
  await admin.evaluate(
    'document.querySelector(".portal-stages-admin").scrollIntoView({ block: "start" })',
  );
  await admin.screenshot('stages-admin');
  assert.deepEqual(exceptions, []);
  console.log(
    'PASS: portal público sem sessão/cookies/referrer/auth requests; allowlist; manual/AUTO; reload, 320–1440px, teclado, foco; revogação, rotação, expiração, arquivamento/restauração; sem exceções JS.',
  );
  console.log(`Capturas sem credenciais: ${output}`);
} catch (error) {
  // Avoid printing raw portal URLs even if a browser assertion includes a credential.
  console.error(
    String(error instanceof Error ? error.stack : error).replace(
      /\/portal\/[A-Za-z0-9_-]+/g,
      '/portal/[redacted]',
    ),
  );
  process.exitCode = 1;
} finally {
  if (browser)
    for (const context of contexts)
      await browser('Target.disposeBrowserContext', { browserContextId: context });
  for (const socket of sockets) socket.close();
  try {
    await database.user.deleteMany({ where: { email } });
  } finally {
    await database.$disconnect();
  }
}
