import { defineConfig, env } from 'prisma/config';
import { loadEnvironment } from './src/config/load-env.js';

loadEnvironment();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
