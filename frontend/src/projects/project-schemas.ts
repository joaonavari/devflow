import { z } from 'zod';

export const projectStatusSchema = z.enum([
  'PLANNING',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
]);

const date = z.iso.date('Informe uma data válida.');
const dueDate = z.union([z.literal(''), date]);

export const projectFormSchema = z
  .object({
    clientId: z.uuid('Selecione um cliente.'),
    name: z
      .string()
      .trim()
      .min(1, 'Informe o nome do projeto.')
      .max(120, 'Use até 120 caracteres.'),
    description: z.string().trim().max(2000, 'Use até 2000 caracteres.'),
    status: projectStatusSchema,
    startDate: date,
    dueDate,
    budget: z
      .string()
      .trim()
      .regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Informe um valor com até duas casas decimais.'),
    progress: z.number().int('Informe um número inteiro.').min(0).max(100),
  })
  .superRefine((value, context) => {
    if (value.dueDate && value.dueDate < value.startDate) {
      context.addIssue({
        code: 'custom',
        path: ['dueDate'],
        message: 'O prazo não pode ser anterior à data de início.',
      });
    }
  });

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type ProjectFormInput = z.infer<typeof projectFormSchema>;
