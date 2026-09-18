import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer, preview } from 'vite';

// Isolated HTTP servers, no database or real credentials. Also checks proxy failure logs.
const token = randomBytes(32).toString('base64url');
const messages = [];
const originals = new Map(['log', 'warn', 'error'].map((method) => [method, console[method]]));
let development;
let built;
try {
  for (const method of originals.keys()) {
    console[method] = (...values) => messages.push(values.map(String).join(' '));
  }
  development = await createServer({
    root: resolve('frontend'),
    configFile: resolve('frontend/vite.config.ts'),
    cacheDir: '/private/tmp/devflow-portal-privacy-vite',
    // This check fetches HTML only; dependency crawling is unnecessary and can
    // leave transforms waiting for optimization during server shutdown.
    optimizeDeps: { noDiscovery: true, include: [] },
    server: {
      host: '127.0.0.1',
      port: 0,
      strictPort: false,
      hmr: false,
      proxy: { '/api': { target: 'http://127.0.0.1:1' } },
    },
  });
  await development.listen();
  const address = development.httpServer.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  for (const path of [
    `/portal/${token}`,
    `/Portal/${token}`,
    `/api/v1/portal/${token}`,
    `/api/v1/PORTAL/${token}`,
  ]) {
    const response = await fetch(base + path, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, path.startsWith('/api') ? 502 : 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('pragma'), 'no-cache');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    const html = await response.text();
    if (!path.startsWith('/api')) {
      assert.match(html, /name="robots" content="noindex, nofollow"/);
      assert.match(html, /name="referrer" content="no-referrer"/);
    }
  }
  built = await preview({
    root: resolve('frontend'),
    configFile: resolve('frontend/vite.config.ts'),
    preview: { host: '127.0.0.1', port: 0, strictPort: false },
  });
  const previewAddress = built.httpServer.address();
  assert(previewAddress && typeof previewAddress !== 'string');
  const response = await fetch(`http://127.0.0.1:${previewAddress.port}/portal/${token}`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  const html = await response.text();
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert(
    messages.some((line) => line.includes('http proxy error:') && line.includes('[redacted]')),
  );
  assert(!messages.some((line) => line.includes(token)), 'Credencial encontrada no log do proxy.');
} finally {
  await development?.close();
  await built?.close();
  for (const [method, original] of originals) console[method] = original;
}
console.log(
  'PASS: headers/metas no HTML dev e preview; no-store no erro 502; token mascarado no log real do proxy.',
);
