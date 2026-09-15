import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Informe um email válido.').max(254));
const password = z
  .string()
  .min(12, 'Use pelo menos 12 caracteres.')
  .refine(
    (value) => Buffer.byteLength(value, 'utf8') <= 72,
    'Use uma senha de até 72 bytes (acentos e emojis ocupam mais de um byte).',
  );

export const loginSchema = z.strictObject({
  email,
  password: z
    .string()
    .min(1)
    .max(72)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= 72),
});
export const registerSchema = z.strictObject({
  name: z.string().trim().min(2, 'Informe seu nome.').max(100),
  email,
  password,
  timezone: z
    .string()
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat('pt-BR', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Fuso horário inválido.')
    .default('America/Sao_Paulo'),
});
export type RegisterInput = z.infer<typeof registerSchema>;
