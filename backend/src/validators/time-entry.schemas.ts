import { z } from 'zod';

const workDate = z.iso.date('Informe uma data válida.');
const description = z
  .union([z.string().trim().max(1000, 'Use até 1000 caracteres.'), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value));
const durationMinutes = z
  .number()
  .int('Informe a duração em minutos inteiros.')
  .min(1, 'A duração deve ser maior que zero.')
  .max(1440, 'Um registro pode ter no máximo 24 horas.');

export const createTimeEntrySchema = z.strictObject({
  description: description.default(null),
  workDate,
  durationMinutes,
});

export const updateTimeEntrySchema = z
  .strictObject({
    description,
    workDate: workDate.optional(),
    durationMinutes: durationMinutes.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.');

export const timeEntryIdSchema = z.uuid('Identificador de registro inválido.');
export const timeEntryProjectIdSchema = z.uuid('Identificador de projeto inválido.');

const listFields = {
  from: workDate.optional(),
  to: workDate.optional(),
  q: z.string().trim().max(100, 'Use até 100 caracteres na busca.').default(''),
};

function validateRange(
  value: { from?: string | undefined; to?: string | undefined },
  context: z.RefinementCtx,
) {
  if (value.from && value.to && value.to < value.from) {
    context.addIssue({
      code: 'custom',
      path: ['to'],
      message: 'A data final não pode ser anterior à data inicial.',
    });
  }
}

export const listProjectTimeEntriesQuerySchema = z
  .strictObject(listFields)
  .superRefine(validateRange);

export const listGlobalTimeEntriesQuerySchema = z
  .strictObject({
    ...listFields,
    projectId: timeEntryProjectIdSchema.optional(),
    clientId: z.uuid('Identificador de cliente inválido.').optional(),
  })
  .superRefine(validateRange);

export type CreateTimeEntryInput = z.infer<typeof createTimeEntrySchema>;
export type UpdateTimeEntryInput = z.infer<typeof updateTimeEntrySchema>;
export type ListProjectTimeEntriesQuery = z.infer<typeof listProjectTimeEntriesQuerySchema>;
export type ListGlobalTimeEntriesQuery = z.infer<typeof listGlobalTimeEntriesQuerySchema>;
