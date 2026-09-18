import { z } from 'zod';
export const portalProjectIdSchema = z.uuid();
export const stageIdSchema = z.uuid();
export const createPortalSchema = z.strictObject({
  validityDays: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
});
export const createStageSchema = z.strictObject({
  title: z.string().trim().min(1, 'Informe o título.').max(160),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).default('PENDING'),
  isClientVisible: z.boolean().default(false),
});
export const updateStageSchema = z
  .strictObject({
    title: z.string().trim().min(1, 'Informe o título.').max(160).optional(),
    status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
    isClientVisible: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Informe uma alteração.');
export const moveStageSchema = z.strictObject({ position: z.number().int().min(0).max(100000) });
export type CreateStageInput = z.infer<typeof createStageSchema>;
export type UpdateStageInput = z.infer<typeof updateStageSchema>;
