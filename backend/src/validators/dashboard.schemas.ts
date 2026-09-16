import { z } from 'zod';

export const dashboardQuerySchema = z.strictObject({
  period: z.enum(['TODAY', '7D', '30D']).default('30D'),
});

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
