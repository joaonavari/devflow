import { defineConfig, env } from 'prisma/config';
import { loadEnvironment } from './src/config/load-env.js';

loadEnvironment();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Prisma 7 uses this URL for CLI operations; the backend adapter uses DATABASE_URL.
  datasource: { url: process.env.DIRECT_URL ? env('DIRECT_URL') : env('DATABASE_URL') },
});
