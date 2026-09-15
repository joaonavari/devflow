import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { app } from '../app.js';
import { database } from '../config/database.js';
import { env } from '../config/env.js';
import { accessCookie, refreshCookie } from '../controllers/auth-cookies.js';
import { hashRefreshToken, refreshSessionId } from '../services/auth-tokens.js';

const email = `auth-test-${randomUUID()}@example.test`;
const password = 'DevFlow-test-password-2026';
const server = app.listen(0, '127.0.0.1');
let base = '';

before(async () => {
  if (!server.listening) await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  base = `http://127.0.0.1:${String(address.port)}/api/v1/auth`;
});
after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  try {
    await database.user.deleteMany({ where: { email } });
  } finally {
    await database.$disconnect();
  }
});

function cookies(response: Response) {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0] ?? '')
    .join('; ');
}
function value(cookie: string, name: string) {
  return cookie
    .split('; ')
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}
function call(path: string, body?: object, cookie = '', headers?: Record<string, string>) {
  return fetch(`${base}/${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: env.APP_ORIGIN,
      'X-DevFlow-Request': '1',
      'Content-Type': 'application/json',
      Cookie: cookie,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

void test('autenticação integrada ao PostgreSQL', async (suite) => {
  let registeredCookie = '';
  let loggedCookie = '';
  let rotatedCookie = '';
  let userId = '';
  await suite.test('me sem autenticação protege o endpoint', async () => {
    const response = await call('me');
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  });
  await suite.test('cadastro válido, cookies e hashes seguros, sem campos sensíveis', async () => {
    const response = await call('register', {
      name: 'Teste DevFlow',
      email: ` ${email.toUpperCase()} `,
      password,
      timezone: 'America/Sao_Paulo',
    });
    assert.equal(response.status, 201);
    const body: unknown = await response.json();
    assert(body && typeof body === 'object' && 'user' in body);
    assert.deepEqual(Object.keys(body), ['user']);
    assert(
      body.user &&
        typeof body.user === 'object' &&
        'id' in body.user &&
        typeof body.user.id === 'string',
    );
    assert.deepEqual(Object.keys(body.user).sort(), ['email', 'id', 'name', 'timezone']);
    userId = body.user.id;
    registeredCookie = cookies(response);
    const setCookies = response.headers.getSetCookie();
    assert.equal(setCookies.length, 2);
    assert(
      setCookies.every(
        (cookie) =>
          cookie.includes('HttpOnly') &&
          cookie.includes('SameSite=Lax') &&
          !cookie.includes('Domain='),
      ),
    );
    assert(
      setCookies.every((cookie) => cookie.includes('Secure') === (env.NODE_ENV === 'production')),
    );
    assert(setCookies[0]?.includes('Max-Age=900'));
    const user = await database.user.findUniqueOrThrow({
      where: { id: userId },
      include: { sessions: true },
    });
    assert.equal(bcrypt.getRounds(user.passwordHash), 12);
    assert(await bcrypt.compare(password, user.passwordHash));
    const session = user.sessions[0];
    assert(session);
    const token = value(registeredCookie, refreshCookie);
    assert(token);
    assert.equal(session.refreshTokenHash, hashRefreshToken(token));
    assert.notEqual(session.refreshTokenHash, token);
    assert(Math.abs(session.expiresAt.getTime() - Date.now() - 7 * 86400_000) < 10_000);
  });
  await suite.test('email duplicado não cria outra conta nem sessão', async () => {
    const response = await call('register', { name: 'Outro nome', email, password });
    assert.equal(response.status, 409);
    assert.equal(response.headers.getSetCookie().length, 0);
    assert.equal(await database.user.count({ where: { email } }), 1);
    assert.equal(await database.authSession.count({ where: { userId } }), 1);
  });
  await suite.test(
    'login inválido tem mesma resposta para conta ausente e senha errada',
    async () => {
      const wrong = await call('login', { email, password: 'wrong-password' });
      const absent = await call('login', { email: `absent-${email}`, password: 'wrong-password' });
      assert.equal(wrong.status, 401);
      assert.equal(absent.status, 401);
      assert.deepEqual(await wrong.json(), await absent.json());
    },
  );
  await suite.test('login válido e me autenticado', async () => {
    const response = await call('login', { email, password });
    assert.equal(response.status, 200);
    loggedCookie = cookies(response);
    const me = await call('me', undefined, loggedCookie);
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), await response.json());
  });
  await suite.test(
    'JWT adulterado, expirado, algoritmo e audiência incorretos são rejeitados',
    async () => {
      const sid = refreshSessionId(value(loggedCookie, refreshCookie));
      for (const variant of ['expired', 'algorithm', 'audience', 'signature']) {
        const token = await new SignJWT({ sid })
          .setProtectedHeader({ alg: variant === 'algorithm' ? 'HS384' : 'HS256', typ: 'JWT' })
          .setSubject(userId)
          .setIssuer('devflow-api')
          .setAudience(variant === 'audience' ? 'other' : 'devflow-web')
          .setIssuedAt()
          .setExpirationTime(variant === 'expired' ? '-1s' : '15m')
          .sign(Buffer.from(variant === 'signature' ? 'aa'.repeat(32) : env.JWT_SECRET, 'hex'));
        assert.equal(
          (await call('me', undefined, `${accessCookie}=${token}`)).status,
          401,
          variant,
        );
      }
    },
  );
  await suite.test('refresh sem access token, rotação e rejeição do token consumido', async () => {
    const oldToken = value(loggedCookie, refreshCookie);
    const response = await call('refresh', {}, `${refreshCookie}=${oldToken ?? ''}`);
    assert.equal(response.status, 200);
    rotatedCookie = cookies(response);
    assert.notEqual(value(rotatedCookie, refreshCookie), oldToken);
    const session = await database.authSession.findUniqueOrThrow({
      where: { id: refreshSessionId(oldToken) },
    });
    assert.equal(
      session.refreshTokenHash,
      hashRefreshToken(value(rotatedCookie, refreshCookie) ?? ''),
    );
    assert.equal((await call('me', undefined, rotatedCookie)).status, 200);
    const replay = await call('refresh', {}, loggedCookie);
    assert.equal(replay.status, 409);
    assert.equal(replay.headers.getSetCookie().length, 0);
  });
  await suite.test('requests concorrentes consomem o refresh uma única vez', async () => {
    const responses = await Promise.all([
      call('refresh', {}, rotatedCookie),
      call('refresh', {}, rotatedCookie),
    ]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [200, 409]);
    const winner = responses.find((response) => response.status === 200);
    const loser = responses.find((response) => response.status === 409);
    assert(winner && loser);
    assert.equal(loser.headers.getSetCookie().length, 0);
    rotatedCookie = cookies(winner);
    assert.equal((await call('me', undefined, rotatedCookie)).status, 200);
  });
  await suite.test(
    'CSRF: origem externa, null, ausente e ausência de header são bloqueados',
    async () => {
      for (const path of ['register', 'login', 'refresh', 'logout']) {
        for (const Origin of ['https://attacker.example', 'null', '']) {
          assert.equal((await call(path, {}, rotatedCookie, { Origin })).status, 403);
        }
        assert.equal(
          (await call(path, {}, rotatedCookie, { 'X-DevFlow-Request': '' })).status,
          403,
        );
      }
      assert.equal(
        (await call('logout', {}, rotatedCookie, { 'Sec-Fetch-Site': 'cross-site' })).status,
        403,
      );
      const absentOrigin = await fetch(`${base}/logout`, {
        method: 'POST',
        headers: { Cookie: rotatedCookie, 'X-DevFlow-Request': '1' },
      });
      assert.equal(absentOrigin.status, 403);
      assert.equal((await call('me', undefined, rotatedCookie)).status, 200);
    },
  );
  await suite.test('CORS permite somente a origem configurada e credenciais', async () => {
    const allowed = await fetch(`${base}/refresh`, {
      method: 'OPTIONS',
      headers: {
        Origin: env.APP_ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type,x-devflow-request',
      },
    });
    assert.equal(allowed.status, 204);
    assert.equal(allowed.headers.get('access-control-allow-origin'), env.APP_ORIGIN);
    assert.equal(allowed.headers.get('access-control-allow-credentials'), 'true');
    const denied = await call('me', undefined, rotatedCookie, {
      Origin: 'https://attacker.example',
    });
    assert.equal(denied.status, 403);
    assert.equal(denied.headers.get('access-control-allow-origin'), null);
  });
  await suite.test('validação rejeita ownership, senha truncável e fuso inválido', async () => {
    for (const extra of [
      { userId: randomUUID() },
      { password: '😀'.repeat(19) },
      { timezone: 'not/a-zone' },
      { password: 'short' },
    ]) {
      assert.equal(
        (await call('register', { name: 'Teste', email, password, ...extra })).status,
        400,
      );
    }
  });
  await suite.test('JSON malformado e corpo excessivo não viram erro interno', async () => {
    for (const [body, status] of [
      ['{', 400],
      [JSON.stringify({ data: 'x'.repeat(17_000) }), 413],
    ] as const) {
      const response = await fetch(`${base}/login`, {
        method: 'POST',
        headers: {
          Origin: env.APP_ORIGIN,
          'X-DevFlow-Request': '1',
          'Content-Type': 'application/json',
        },
        body,
      });
      assert.equal(response.status, status);
    }
  });
  await suite.test('logout revoga somente a sessão correspondente e limpa cookies', async () => {
    const response = await call('logout', {}, rotatedCookie);
    assert.equal(response.status, 204);
    assert.equal(response.headers.getSetCookie().length, 2);
    assert(
      response.headers
        .getSetCookie()
        .every((cookie) => cookie.includes('Expires=Thu, 01 Jan 1970')),
    );
    assert.equal((await call('me', undefined, rotatedCookie)).status, 401);
    assert.equal((await call('refresh', {}, rotatedCookie)).status, 401);
    assert.equal((await call('me', undefined, registeredCookie)).status, 200);
    const session = await database.authSession.findUniqueOrThrow({
      where: { id: refreshSessionId(value(rotatedCookie, refreshCookie)) },
    });
    assert(session.revokedAt);
  });
  await suite.test('logout funciona só com refresh e é idempotente', async () => {
    const cookie = `${refreshCookie}=${value(registeredCookie, refreshCookie) ?? ''}`;
    assert.equal((await call('logout', {}, cookie)).status, 204);
    assert.equal((await call('refresh', {}, registeredCookie)).status, 401);
    assert.equal((await call('logout', {}, cookie)).status, 204);
    assert.equal((await call('logout', {})).status, 204);
  });
  await suite.test('sessão expirada não renova e invalida mesmo um JWT válido', async () => {
    const response = await call('login', { email, password });
    assert.equal(response.status, 200);
    const cookie = cookies(response);
    await database.authSession.update({
      where: { id: refreshSessionId(value(cookie, refreshCookie)) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await call('me', undefined, cookie)).status, 401);
    assert.equal((await call('refresh', {}, cookie)).status, 401);
  });
  await suite.test('limite de tentativas retorna 429 com Retry-After', async () => {
    let response = await call('login', {});
    for (let attempt = 0; attempt < 21 && response.status !== 429; attempt++)
      response = await call('login', {});
    assert.equal(response.status, 429);
    assert(response.headers.get('retry-after'));
  });
});
