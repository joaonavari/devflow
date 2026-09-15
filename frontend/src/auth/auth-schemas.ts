import { z } from 'zod';

const email = z.string().trim().toLowerCase().pipe(z.email('Informe um email válido.').max(254));
export const loginSchema = z.object({ email, password: z.string().min(1, 'Informe sua senha.') });
export const registerSchema = loginSchema
  .extend({
    name: z.string().trim().min(2, 'Informe seu nome.').max(100, 'Use até 100 caracteres.'),
    password: z
      .string()
      .min(8, 'Use pelo menos 8 caracteres.')
      .refine(
        (value) => new TextEncoder().encode(value).length <= 72,
        'Use até 72 bytes. Acentos e emojis ocupam mais de um byte.',
      ),
    confirmPassword: z.string().min(1, 'Confirme sua senha.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'As senhas precisam ser iguais.',
    path: ['confirmPassword'],
  });
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
