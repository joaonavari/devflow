import { app } from './app.js';
import { database } from './config/database.js';
import { env } from './config/env.js';

const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.info(`DevFlow API: http://${env.API_HOST}:${String(env.API_PORT)}/api/v1/health`);
});

let shuttingDown = false;

function shutdown(): void {
  if (shuttingDown) return;
  shuttingDown = true;

  const timeout = setTimeout(() => {
    console.error('O encerramento da API excedeu o tempo limite.');
    process.exit(1);
  }, 10_000);
  timeout.unref();

  server.close(() => {
    void database.$disconnect().then(
      () => {
        clearTimeout(timeout);
        process.exitCode = 0;
      },
      () => {
        clearTimeout(timeout);
        process.exitCode = 1;
      },
    );
  });
}

server.on('error', () => {
  console.error('Não foi possível iniciar a API. Verifique o endereço e a porta configurados.');
  process.exitCode = 1;
});

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
