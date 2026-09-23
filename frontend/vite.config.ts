import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig, loadEnv, type Plugin } from 'vite';

const portalPrivacyPlugin: Plugin = {
  name: 'portal-privacy',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (/^\/(?:api\/v1\/)?portal(?:\/|\?|$)/i.test(req.url ?? '')) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      // Keep a private HTML shell even before JavaScript runs. Do not rewrite API calls.
      if (/^\/portal(?:\/|\?|$)/i.test(req.url ?? '')) req.url = '/portal.html';
      next();
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (/^\/(?:api\/v1\/)?portal(?:\/|\?|$)/i.test(req.url ?? '')) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Referrer-Policy', 'no-referrer');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      }
      if (/^\/portal(?:\/|\?|$)/i.test(req.url ?? '')) req.url = '/portal.html';
      next();
    });
  },
};

// The Vite proxy includes request URLs in errors. Bearer links must be redacted.
const logger = createLogger();
for (const method of ['info', 'warn', 'warnOnce', 'error'] as const) {
  const original = logger[method].bind(logger);
  logger[method] = (message, options) => {
    original(message.replace(/(\/(?:api\/v1\/)?portal\/)[^\s"'<>?]+/gi, '$1[redacted]'), options);
  };
}

const rootDirectory = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDirectory, 'API_');
  const apiPort = env.API_PORT ?? '3001';

  return {
    customLogger: logger,
    plugins: [portalPrivacyPlugin, react(), tailwindcss()],
    envDir: rootDirectory,
    build: {
      manifest: true,
      rolldownOptions: {
        input: {
          index: fileURLToPath(new URL('./index.html', import.meta.url)),
          portal: fileURLToPath(new URL('./portal.html', import.meta.url)),
        },
      },
    },
    preview: { headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' } },
    server: {
      headers: { 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' },
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: `http://127.0.0.1:${apiPort}`,
        },
      },
    },
  };
});
