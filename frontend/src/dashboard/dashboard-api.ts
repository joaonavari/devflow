import { z } from 'zod';
import { ApiError, authenticatedFetch } from '../auth/auth-api';
import { projectStatusSchema } from '../projects/project-schemas';
import { taskPrioritySchema, taskStatusSchema } from '../tasks/task-schemas';

export const dashboardPeriodSchema = z.enum(['TODAY', '7D', '30D']);
const dashboardSchema = z.object({
  period: dashboardPeriodSchema,
  periodStart: z.iso.date(),
  summary: z.object({
    activeProjects: z.number().int().nonnegative(),
    openTasks: z.number().int().nonnegative(),
    trackedMinutes: z.number().int().nonnegative(),
    pendingAmount: z.string(),
    overdueAmount: z.string(),
  }),
  projects: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      status: projectStatusSchema,
      progress: z.number().int().min(0).max(100),
      dueDate: z.iso.date().nullable(),
      updatedAt: z.iso.datetime(),
      client: z.object({ id: z.uuid(), name: z.string() }),
    }),
  ),
  tasks: z.object({
    counts: z.object({
      todo: z.number().int().nonnegative(),
      inProgress: z.number().int().nonnegative(),
      doneInPeriod: z.number().int().nonnegative(),
    }),
    attention: z.array(
      z.object({
        id: z.uuid(),
        title: z.string(),
        priority: taskPrioritySchema,
        status: taskStatusSchema,
        dueDate: z.iso.date(),
        isOverdue: z.boolean(),
        project: z.object({ id: z.uuid(), name: z.string() }),
      }),
    ),
  }),
  hours: z.object({
    totalMinutes: z.number().int().nonnegative(),
    byProject: z.array(
      z.object({
        projectId: z.uuid(),
        projectName: z.string(),
        archivedAt: z.iso.datetime().nullable(),
        totalMinutes: z.number().int().nonnegative(),
      }),
    ),
  }),
  finance: z.object({
    paidInPeriod: z.string(),
    pendingCurrent: z.string(),
    overdueCurrent: z.string(),
  }),
  recentActivity: z.array(
    z.object({
      id: z.string(),
      type: z.enum(['PROJECT', 'TASK', 'TIME_ENTRY', 'PAYMENT']),
      label: z.string(),
      timestamp: z.iso.datetime(),
      href: z.string(),
    }),
  ),
});
const responseSchema = z.object({ data: dashboardSchema });
const errorResponseSchema = z.object({ error: z.object({ message: z.string() }) });

export type DashboardPeriod = z.infer<typeof dashboardPeriodSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;

export class DashboardApiError extends ApiError {}

export async function getDashboard(period: DashboardPeriod) {
  const response = await authenticatedFetch(`/api/v1/dashboard?period=${period}`);
  if (!response.ok) {
    let message = 'Não foi possível carregar o Dashboard.';
    try {
      const parsed = errorResponseSchema.safeParse(await response.json());
      if (parsed.success) message = parsed.data.error.message;
    } catch {
      // Keep the stable fallback when the response is not JSON.
    }
    throw new DashboardApiError(response.status, message);
  }
  return responseSchema.parse(await response.json()).data;
}

export const dashboardKeys = {
  all: (userId: string) => ['dashboard', userId] as const,
  detail: (userId: string, period: DashboardPeriod) => ['dashboard', userId, period] as const,
};
