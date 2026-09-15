import { z } from 'zod';

const optionalText = (maximum: number, message: string) =>
  z
    .union([z.string().trim().max(maximum, message), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value));

const clientFields = {
  name: z.string().trim().min(1, 'Informe o nome do cliente.').max(120, 'Use até 120 caracteres.'),
  email: z.string().trim().toLowerCase().pipe(z.email('Informe um email válido.').max(254)),
  phone: optionalText(40, 'Use até 40 caracteres.'),
  company: optionalText(120, 'Use até 120 caracteres.'),
};

export const createClientSchema = z.strictObject(clientFields).transform((value) => ({
  ...value,
  phone: value.phone ?? null,
  company: value.company ?? null,
}));
export const updateClientSchema = z
  .strictObject({
    name: clientFields.name.optional(),
    email: clientFields.email.optional(),
    phone: clientFields.phone,
    company: clientFields.company,
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe ao menos um campo para atualizar.');
export const clientIdSchema = z.uuid('Identificador de cliente inválido.');
export const listClientsQuerySchema = z.strictObject({
  status: z.enum(['active', 'archived']).default('active'),
  q: z.string().trim().max(100, 'Use até 100 caracteres na busca.').default(''),
});

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;
