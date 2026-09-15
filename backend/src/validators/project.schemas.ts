import { z } from 'zod';

export const projectStatusSchema = z.enum([
  'PLANNING',
  'IN_PROGRESS',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
]);
export const progressModeSchema = z.enum(['MANUAL', 'AUTO']);

const projectDate = z.iso.date('Informe uma data válida.');
const optionalDescription = z
  .union([z.string().trim().max(2000, 'Use até 2000 caracteres.'), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value));
const optionalDueDate = z.union([projectDate, z.null()]).optional();
const budget = z
  .string()
  .trim()
  .regex(/^\d{1,10}(?:\.\d{1,2})?$/, 'Informe um valor com até duas casas decimais.');

const projectFields = {
  clientId: z.uuid('Identificador de cliente inválido.'),
  name: z.string().trim().min(1, 'Informe o nome do projeto.').max(120, 'Use até 120 caracteres.'),
  description: optionalDescription,
  status: projectStatusSchema,
  startDate: projectDate,
  dueDate: optionalDueDate,
  budget,
  progress: z.number().int('Informe um progresso inteiro.').min(0).max(100),
  progressMode: progressModeSchema,
};

function validateDateRange(
  value: { startDate?: string | undefined; dueDate?: string | null | undefined },
  context: z.RefinementCtx,
) {
  if (value.startDate && value.dueDate && value.dueDate < value.startDate) {
    context.addIssue({
      code: 'custom',
      path: ['dueDate'],
      message: 'O prazo não pode ser anterior à data de início.',
    });
  }
}

export const createProjectSchema = z
  .strictObject({
    ...projectFields,
    description: projectFields.description.default(null),
    status: projectFields.status.default('PLANNING'),
    dueDate: projectFields.dueDate.default(null),
    budget: projectFields.budget.default('0.00'),
    progress: projectFields.progress.default(0),
    progressMode: projectFields.progressMode.default('MANUAL'),
  })
  .superRefine(validateDateRange);

export const updateProjectSchema = z
  .strictObject({
    clientId: projectFields.clientId.optional(),
    name: projectFields.name.optional(),
    description: projectFields.description,
    status: projectFields.status.optional(),
    startDate: projectFields.startDate.optional(),
    dueDate: projectFields.dueDate,
    budget: projectFields.budget.optional(),
    progress: projectFields.progress.optional(),
    progressMode: projectFields.progressMode.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.')
  .superRefine(validateDateRange);

export const projectIdSchema = z.uuid('Identificador de projeto inválido.');
export const listProjectsQuerySchema = z.strictObject({
  view: z.enum(['active', 'archived']).default('active'),
  status: projectStatusSchema.optional(),
  clientId: z.uuid('Identificador de cliente inválido.').optional(),
  q: z.string().trim().max(100, 'Use até 100 caracteres na busca.').default(''),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ListProjectsQuery = z.infer<typeof listProjectsQuerySchema>;
