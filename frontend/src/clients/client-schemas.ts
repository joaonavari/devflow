import { z } from 'zod';

export const clientFormSchema = z.object({
  name: z.string().trim().min(1, 'Informe o nome do cliente.').max(120, 'Use até 120 caracteres.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Informe um email válido.').max(254)),
  phone: z.string().trim().max(40, 'Use até 40 caracteres.'),
  company: z.string().trim().max(120, 'Use até 120 caracteres.'),
});

export type ClientFormInput = z.infer<typeof clientFormSchema>;
