import { z } from 'zod';

export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);

export const taskFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Informe o título da tarefa.')
    .max(160, 'Use até 160 caracteres.'),
  description: z.string().trim().max(2000, 'Use até 2000 caracteres.'),
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: z.union([z.literal(''), z.iso.date('Informe uma data válida.')]),
  isClientVisible: z.boolean(),
});

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskFormInput = z.infer<typeof taskFormSchema>;
