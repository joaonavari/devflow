import { z } from 'zod';

export const taskPrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const taskStatusSchema = z.enum(['TODO', 'IN_PROGRESS', 'DONE']);
const taskDate = z.iso.date('Informe uma data válida.');
const optionalDescription = z
  .union([z.string().trim().max(2000, 'Use até 2000 caracteres.'), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value));
const optionalDueDate = z.union([taskDate, z.null()]).optional();

const taskFields = {
  title: z
    .string()
    .trim()
    .min(1, 'Informe o título da tarefa.')
    .max(160, 'Use até 160 caracteres.'),
  description: optionalDescription,
  priority: taskPrioritySchema,
  status: taskStatusSchema,
  dueDate: optionalDueDate,
  isClientVisible: z.boolean(),
};

export const createTaskSchema = z.strictObject({
  title: taskFields.title,
  description: taskFields.description.default(null),
  priority: taskFields.priority.default('MEDIUM'),
  status: taskFields.status.default('TODO'),
  dueDate: taskFields.dueDate.default(null),
  isClientVisible: taskFields.isClientVisible.default(false),
});

export const updateTaskSchema = z
  .strictObject({
    title: taskFields.title.optional(),
    description: taskFields.description,
    priority: taskFields.priority.optional(),
    status: taskFields.status.optional(),
    dueDate: taskFields.dueDate,
    isClientVisible: taskFields.isClientVisible.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.');

export const moveTaskSchema = z.strictObject({
  status: taskStatusSchema,
  position: z.number().int('Informe uma posição inteira.').min(0),
});

export const taskIdSchema = z.uuid('Identificador de tarefa inválido.');
export const taskProjectIdSchema = z.uuid('Identificador de projeto inválido.');
export const listTasksQuerySchema = z.strictObject({
  status: taskStatusSchema.optional(),
  priority: taskPrioritySchema.optional(),
  due: z.enum(['all', 'overdue', 'today', 'upcoming', 'none']).default('all'),
  q: z.string().trim().max(100, 'Use até 100 caracteres na busca.').default(''),
});
export const listGlobalTasksQuerySchema = listTasksQuerySchema.extend({
  projectId: taskProjectIdSchema.optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type MoveTaskInput = z.infer<typeof moveTaskSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type ListGlobalTasksQuery = z.infer<typeof listGlobalTasksQuerySchema>;
