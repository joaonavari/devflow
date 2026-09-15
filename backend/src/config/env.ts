import { z } from 'zod';
import { loadEnvironment } from './load-env.js';

loadEnvironment();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_HOST: z.string().min(1).default('127.0.0.1'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  APP_ORIGIN: z
    .url()
    .refine((value) => {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    }, 'Informe somente a origem, sem caminho ou barra final.')
    .default('http://127.0.0.1:5173'),
  JWT_SECRET: z.string().regex(/^[a-f0-9]{64}$/i),
  DATABASE_URL: z.url().refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'postgresql:' || protocol === 'postgres:';
  }, 'Use uma URL PostgreSQL válida.'),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.')))];
  throw new Error(`Configuração inválida: ${fields.join(', ')}. Confira o .env.example.`);
}

export const env = result.data;

if (env.NODE_ENV === 'production' && !env.APP_ORIGIN.startsWith('https://')) {
  throw new Error('APP_ORIGIN deve usar HTTPS em produção.');
}
