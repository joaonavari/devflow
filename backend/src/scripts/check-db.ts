import { database } from '../config/database.js';
import { checkDatabaseConnection } from '../services/health.service.js';

try {
  await checkDatabaseConnection();
  console.info('PostgreSQL acessível: SELECT 1 executado com sucesso pelo Prisma.');
} catch {
  console.error(
    'Falha na conexão com PostgreSQL. Verifique DATABASE_URL no .env e execute npm run db:up.',
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
