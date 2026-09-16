import { z } from 'zod';

export const timeEntryFormSchema = z
  .object({
    projectId: z.uuid('Selecione um projeto.'),
    workDate: z.iso.date('Informe uma data válida.'),
    hours: z
      .number('Informe as horas.')
      .int('Use horas inteiras.')
      .min(0, 'As horas não podem ser negativas.')
      .max(24, 'Use no máximo 24 horas.'),
    minutes: z
      .number('Informe os minutos.')
      .int('Use minutos inteiros.')
      .min(0, 'Os minutos não podem ser negativos.')
      .max(59, 'Use de 0 a 59 minutos.'),
    description: z.string().trim().max(1000, 'Use até 1000 caracteres.'),
  })
  .superRefine((value, context) => {
    const total = value.hours * 60 + value.minutes;
    if (total === 0) {
      context.addIssue({
        code: 'custom',
        path: ['minutes'],
        message: 'Informe uma duração maior que zero.',
      });
    }
    if (total > 1440) {
      context.addIssue({
        code: 'custom',
        path: ['hours'],
        message: 'Um registro pode ter no máximo 24 horas.',
      });
    }
  });

export type TimeEntryFormInput = z.infer<typeof timeEntryFormSchema>;
