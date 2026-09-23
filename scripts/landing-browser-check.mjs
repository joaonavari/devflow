import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

// Focused routing/UI check, no database changes. Requires Chrome CDP on 9222.
// API responses are intercepted to exercise guest and authenticated guards.
const origin = process.env.LANDING_ORIGIN ?? 'http://127.0.0.1:5173';
const output = '/private/tmp/devflow-landing-validation';
const sockets = [];
const errors = [];
const requests = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
let context;
let signedIn = false;

async function connect(url, onEvent = () => {}) {
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
    if (!message.id) {
      onEvent(message);
      return;
    }
    const task = pending.get(message.id);
    if (!task) return;
    pending.delete(message.id);
    clearTimeout(task.timeout);
    if (message.error) task.reject(new Error(JSON.stringify(message.error)));
    else task.resolve(message.result);
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const callId = ++id;
      const timeout = setTimeout(() => {
        pending.delete(callId);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
      pending.set(callId, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id: callId, method, params }));
    });
}

try {
  await mkdir(output, { recursive: true });
  const version = await fetch('http://127.0.0.1:9222/json/version').then((r) => r.json());
  browser = await connect(version.webSocketDebuggerUrl);
  context = (await browser('Target.createBrowserContext')).browserContextId;
  const { targetId } = await browser('Target.createTarget', {
    url: 'about:blank',
    browserContextId: context,
  });
  const targets = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
  const send = await connect(
    targets.find((target) => target.id === targetId).webSocketDebuggerUrl,
    (message) => {
      if (message.method === 'Runtime.exceptionThrown')
        errors.push(message.params.exceptionDetails.text);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error')
        errors.push(message.params.args.map((arg) => arg.value).join(' '));
      if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
      if (message.method === 'Fetch.requestPaused') {
        const { requestId, request } = message.params;
        const path = new URL(request.url).pathname;
        const authenticated = signedIn && path === '/api/v1/auth/me';
        const responseCode = authenticated ? 200 : path.startsWith('/api/v1/portal/') ? 404 : 401;
        const body = authenticated
          ? {
              user: {
                id: '7f40f127-95a9-438f-a3a1-3c79b975b663',
                name: 'Teste de navegação',
                email: 'landing@example.test',
                timezone: 'America/Sao_Paulo',
              },
            }
          : { error: { message: 'Recurso indisponível.' } };
        void send('Fetch.fulfillRequest', {
          requestId,
          responseCode,
          responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
          body: Buffer.from(JSON.stringify(body)).toString('base64'),
        }).catch((error) => errors.push(String(error)));
      }
    },
  );
  for (const domain of ['Page', 'Runtime', 'Network']) await send(`${domain}.enable`);
  await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] });
  const evaluate = async (expression) => {
    const result = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const until = async (expression) => {
    for (let i = 0; i < 100; i++) {
      try {
        if (await evaluate(expression)) return;
      } catch {
        /* Navigation swaps contexts. */
      }
      await delay(100);
    }
    console.log(
      'Estado de diagnóstico:',
      await evaluate(
        'JSON.stringify({scrollY,innerHeight,innerWidth,hash:location.hash,top:document.getElementById("como-funciona")?.getBoundingClientRect().top})',
      ),
    );
    throw new Error(`Condição não atendida: ${expression}`);
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
  const settle = () =>
    evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
  const click = async (selector) => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
    await settle();
  };
  const key = async (key, code, number) => {
    for (const type of ['keyDown', 'keyUp'])
      await send('Input.dispatchKeyEvent', {
        type,
        key,
        code,
        windowsVirtualKeyCode: number,
        ...(key === 'Enter' && type === 'keyDown' ? { text: '\r', unmodifiedText: '\r' } : {}),
      });
    await settle();
  };
  const screenshot = async (name) => {
    const { cssContentSize } = await send('Page.getLayoutMetrics');
    const capture = await send('Page.captureScreenshot', {
      format: 'png',
      captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: cssContentSize.width, height: cssContentSize.height, scale: 1 },
    });
    await writeFile(`${output}/${name}.png`, Buffer.from(capture.data, 'base64'));
  };

  await navigate('/');
  await evaluate('document.fonts.ready');
  await until('document.querySelector(".landing-preview-image")?.complete');
  const landingRequests = [...requests];
  assert.equal(landingRequests.filter((url) => url.includes('/api/')).length, 0);
  assert.equal(
    landingRequests.some((url) =>
      /AuthenticatedApp|DashboardPage|ProjectKanban|ProjectDetailPage|FinancePage|dnd-kit|schemas-/.test(
        url,
      ),
    ),
    false,
  );
  assert.equal(
    landingRequests.some((url) => url.endsWith('/images/devflow-dashboard.webp')),
    true,
  );
  assert.equal(
    landingRequests.some((url) => /devflow-(?:kanban|financeiro|portal)\.webp$/.test(url)),
    false,
  );
  assert.deepEqual(
    await evaluate(
      `Array.from(document.querySelectorAll('.landing-page img')).map(image => ({width: image.getAttribute('width'), height: image.getAttribute('height'), loading: image.getAttribute('loading'), alt: image.alt}))`,
    ),
    [
      {
        width: '1600',
        height: '1000',
        loading: null,
        alt: 'Dashboard do DevFlow com projetos, tarefas, horas e resumo financeiro.',
      },
      {
        width: '1600',
        height: '1000',
        loading: 'lazy',
        alt: 'Kanban do DevFlow com tarefas organizadas por etapa.',
      },
      {
        width: '1600',
        height: '1000',
        loading: 'lazy',
        alt: 'Painel financeiro do DevFlow com valores pagos, pendentes e vencidos.',
      },
      {
        width: '1600',
        height: '1000',
        loading: 'lazy',
        alt: 'Portal do cliente do DevFlow com progresso, etapas e tarefas públicas.',
      },
    ],
  );
  assert.equal(await evaluate('document.querySelectorAll("h1").length'), 1);
  assert.equal(await evaluate('document.querySelectorAll("main").length'), 1);
  assert.equal(await evaluate('!!document.querySelector(".app-shell, .desktop-sidebar")'), false);
  assert.equal(await evaluate('document.title'), 'DevFlow — Gestão de projetos para freelancers');
  assert.equal(
    await evaluate('document.querySelector("meta[name=robots]").content'),
    'index, follow',
  );
  assert.equal(await evaluate(`document.querySelectorAll('meta[property^="og:"]').length`), 3);
  assert.deepEqual(
    await evaluate(
      `Array.from(document.querySelectorAll('.landing-page a[href^="/"]')).map(a => a.getAttribute('href')).filter(href => !['/', '/login', '/register'].includes(href))`,
    ),
    [],
  );
  await evaluate(`(async () => {
    for (const image of document.querySelectorAll('img[loading="lazy"]')) {
      image.scrollIntoView({block: 'center'});
      if (!image.complete) await new Promise(resolve => {
        image.addEventListener('load', resolve, {once: true});
        image.addEventListener('error', resolve, {once: true});
      });
    }
    scrollTo(0, 0);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`);

  for (const width of [320, 360, 390, 430, 768, 1024, 1366, 1440]) {
    await viewport(width);
    await evaluate(
      'new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))',
    );
    assert.equal(
      await evaluate('document.documentElement.scrollWidth > document.documentElement.clientWidth'),
      false,
      `Overflow: ${width}px`,
    );
    assert.deepEqual(
      await evaluate(
        `Array.from(document.querySelectorAll('.landing-page h1, .landing-page h2, .landing-page h3, .landing-button')).filter(el => el.getClientRects().length && (el.scrollWidth > el.clientWidth + 1 || el.getBoundingClientRect().right > innerWidth)).map(el => el.textContent)`,
      ),
      [],
      `Conteúdo cortado: ${width}px`,
    );
    if (width === 390 || width === 1440) await screenshot(`landing-${width}`);
  }
  console.log(
    'PASS: Landing sem API/admin; SEO; 8 larguras sem overflow ou títulos/CTAs cortados.',
  );

  await viewport(390);
  await navigate('/');
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.className'), 'skip-link');
  assert.equal(await evaluate('getComputedStyle(document.activeElement).outlineStyle'), 'solid');
  await key('Enter', 'Enter', 13);
  await until('document.activeElement.id === "landing-content"');
  await evaluate('document.querySelector(".landing-menu-toggle").focus()');
  await key('Enter', 'Enter', 13);
  assert.equal(
    await evaluate('document.querySelector(".landing-menu-toggle").getAttribute("aria-expanded")'),
    'true',
  );
  await key('Tab', 'Tab', 9);
  assert.equal(await evaluate('document.activeElement.getAttribute("href")'), '#recursos');
  await key('Escape', 'Escape', 27);
  assert.equal(
    await evaluate('document.activeElement.classList.contains("landing-menu-toggle")'),
    true,
  );
  assert.equal(
    await evaluate('getComputedStyle(document.querySelector("#landing-navigation")).display'),
    'none',
  );
  await click('.landing-menu-toggle');
  await click('.landing-nav-links a[href="#recursos"]');
  await until('location.hash === "#recursos" && document.activeElement.id === "recursos"');
  assert.equal(
    await evaluate('document.querySelector(".landing-menu-toggle").getAttribute("aria-expanded")'),
    'false',
  );
  await click('.landing-actions a[href="#como-funciona"]');
  await until('location.hash === "#como-funciona"');
  await until(
    'document.getElementById("workflow-title").getBoundingClientRect().top >= 0 && document.getElementById("workflow-title").getBoundingClientRect().bottom < innerHeight',
  );
  await click('.landing-menu-toggle');
  await viewport(1024);
  await until(
    'document.querySelector(".landing-menu-toggle").getAttribute("aria-expanded") === "false"',
  );
  await viewport(390);
  assert.equal(
    await evaluate('getComputedStyle(document.querySelector("#landing-navigation")).display'),
    'none',
  );
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  });
  assert.equal(await evaluate('getComputedStyle(document.documentElement).scrollBehavior'), 'auto');
  assert.equal(
    await evaluate(
      'getComputedStyle(document.querySelector(".landing-button")).transitionDuration',
    ),
    '0s',
  );
  console.log('PASS: teclado, skip link, foco, Escape, menu/resizing, anchors e reduced motion.');

  await navigate('/');
  await click('.landing-actions a[href="/register"]');
  await until('location.pathname === "/register" && !!document.querySelector("input[name=name]")');
  await navigate('/');
  await viewport(1440);
  await click('.landing-login');
  await until('location.pathname === "/login" && !!document.querySelector("input[name=email]")');
  await navigate('/');
  await send('Page.reload');
  await until('!!document.querySelector(".landing-page h1")');
  for (const path of [
    '/dashboard',
    '/clientes',
    '/clientes/teste',
    '/projetos',
    '/projetos/teste',
    '/tarefas',
    '/horas',
    '/financeiro',
    '/configuracoes',
  ]) {
    await navigate(path, '/login');
    assert.equal(await evaluate('history.state.usr.from'), path);
    assert.equal(
      await evaluate('document.querySelector("meta[name=robots]").content'),
      'noindex, nofollow',
    );
  }
  signedIn = true;
  await navigate('/configuracoes');
  assert.equal(await evaluate('!!document.querySelector(".app-shell")'), true);
  await navigate('/');
  assert.equal(await evaluate('!!document.querySelector(".landing-page")'), true);
  await navigate('/configuracoes');
  await send('Page.reload');
  await until('!!document.querySelector(".app-shell")');
  signedIn = false;
  await navigate('/portal/invalid-test-token');
  await until('document.body.innerText.includes("Este link não está disponível")');
  assert.equal(await evaluate('!!document.querySelector(".landing-page, .app-shell")'), false);
  assert.equal(await evaluate(`document.querySelectorAll('meta[property^="og:"]').length`), 0);
  assert(
    await evaluate(
      'Array.from(document.querySelectorAll("meta[name=robots]")).every(meta => meta.content === "noindex, nofollow")',
    ),
  );
  assert.deepEqual(errors, []);
  const settled = requests.length;
  await delay(500);
  assert.equal(requests.length, settled);
  await writeFile(`${output}/requests.json`, JSON.stringify(landingRequests, null, 2));
  console.log(
    'PASS: CTAs, reload, 9 deep links protegidos, sessão simulada, Portal isolado/noindex; sem erros JS ou loops.',
  );
  console.log(`Capturas: ${output}/landing-{390,1440}.png`);
} finally {
  if (browser && context)
    await browser('Target.disposeBrowserContext', { browserContextId: context });
  for (const socket of sockets) socket.close();
}
