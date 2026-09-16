import { z } from 'zod';

export function normalizeMoneyInput(value: string): string | null {
  const compact = value.trim().replace(/\s/g, '');
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/.test(compact)) return null;
  const [integer = '', fraction = ''] = compact.replace(',', '.').split('.');
  const normalized = `${integer}.${fraction.padEnd(2, '0')}`;
  return /^0+\.00$/.test(normalized) ? null : normalized;
}

export const paymentFormSchema = z.object({
  projectId: z.uuid('Selecione um projeto.'),
  description: z
    .string()
    .trim()
    .min(1, 'Informe uma descrição.')
    .max(300, 'Use até 300 caracteres.'),
  amount: z.string().refine((value) => normalizeMoneyInput(value) !== null, {
    message: 'Informe um valor maior que zero, como 2500,50.',
  }),
  dueDate: z.iso.date('Informe uma data válida.'),
});

export type PaymentFormInput = z.infer<typeof paymentFormSchema>;
