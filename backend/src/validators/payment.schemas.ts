import { z } from 'zod';

const description = z
  .string()
  .trim()
  .min(1, 'Informe uma descrição.')
  .max(300, 'Use até 300 caracteres.');
const amount = z
  .string()
  .regex(/^\d{1,10}\.\d{2}$/, 'Informe um valor monetário válido com duas casas decimais.')
  .refine((value) => !/^0+\.00$/.test(value), 'O valor deve ser maior que zero.');
const dueDate = z.iso.date('Informe uma data válida.');

export const createPaymentSchema = z.strictObject({ description, amount, dueDate });

export const updatePaymentSchema = z
  .strictObject({
    description: description.optional(),
    amount: amount.optional(),
    dueDate: dueDate.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.');

export const paymentIdSchema = z.uuid('Identificador de cobrança inválido.');
export const paymentProjectIdSchema = z.uuid('Identificador de projeto inválido.');

const listFields = {
  q: z.string().trim().max(100, 'Use até 100 caracteres na busca.').default(''),
  status: z.enum(['PENDING', 'PAID']).optional(),
  overdue: z.enum(['true', 'false']).optional(),
  from: dueDate.optional(),
  to: dueDate.optional(),
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

export const listProjectPaymentsQuerySchema = z.strictObject(listFields).superRefine(validateRange);

export const listGlobalPaymentsQuerySchema = z
  .strictObject({
    ...listFields,
    projectId: paymentProjectIdSchema.optional(),
    clientId: z.uuid('Identificador de cliente inválido.').optional(),
  })
  .superRefine(validateRange);

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type ListProjectPaymentsQuery = z.infer<typeof listProjectPaymentsQuerySchema>;
export type ListGlobalPaymentsQuery = z.infer<typeof listGlobalPaymentsQuerySchema>;
