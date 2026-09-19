import { database } from '../config/database.js';
import { Prisma } from '../generated/prisma/client.js';
import type { DashboardQuery } from '../validators/dashboard.schemas.js';
import { calculatedProgress } from './project.service.js';

function dateFromApi(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function dateToApi(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function todayIn(timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((candidate) => candidate.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function dateWithOffset(value: string, offsetDays: number): string {
  const date = dateFromApi(value);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return dateToApi(date);
}

function startOfDayInTimeZone(value: string, timeZone: string): Date {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  const target = Date.UTC(year, month - 1, day);
  let guess = target;
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(guess));
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((candidate) => candidate.type === type)?.value ?? 0);
    const represented = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
      part('second'),
    );
    guess += target - represented;
  }
  return new Date(guess);
}

function periodDates(period: DashboardQuery['period'], timeZone: string) {
  const today = todayIn(timeZone);
  const days = period === 'TODAY' ? 1 : period === '7D' ? 7 : 30;
  const startDate = dateWithOffset(today, -(days - 1));
  return {
    today: dateFromApi(today),
    startDate: dateFromApi(startDate),
    startInstant: startOfDayInTimeZone(startDate, timeZone),
    startDateApi: startDate,
  };
}

function decimal(value: Prisma.Decimal | null | undefined): string {
  return (value ?? new Prisma.Decimal(0)).toFixed(2);
}

export async function getDashboard(userId: string, timeZone: string, query: DashboardQuery) {
  const dates = periodDates(query.period, timeZone);
  const activeProjectWhere = { userId, archivedAt: null } satisfies Prisma.ProjectWhereInput;
  const activeTaskWhere = {
    project: { userId, archivedAt: null },
  } satisfies Prisma.TaskWhereInput;
  const ownedPaymentWhere = { project: { userId } } satisfies Prisma.PaymentWhereInput;

  const [
    activeProjects,
    projects,
    taskGroups,
    doneInPeriod,
    attentionTasks,
    hourGroups,
    hourTotal,
    paymentGroups,
    overdueAggregate,
    paidInPeriodAggregate,
    recentProjects,
    recentTasks,
    recentTimeEntries,
    recentPayments,
  ] = await Promise.all([
    database.project.count({ where: activeProjectWhere }),
    database.project.findMany({
      where: {
        ...activeProjectWhere,
        status: { in: ['PLANNING', 'IN_PROGRESS', 'ON_HOLD'] },
      },
      select: {
        id: true,
        name: true,
        status: true,
        progress: true,
        progressMode: true,
        _count: { select: { tasks: true } },
        dueDate: true,
        updatedAt: true,
        client: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }, { updatedAt: 'desc' }, { id: 'asc' }],
      take: 5,
    }),
    database.task.groupBy({
      by: ['status'],
      where: activeTaskWhere,
      _count: { _all: true },
    }),
    database.task.count({
      where: { ...activeTaskWhere, status: 'DONE', completedAt: { gte: dates.startInstant } },
    }),
    database.task.findMany({
      where: {
        ...activeTaskWhere,
        status: { not: 'DONE' },
        dueDate: { not: null },
      },
      select: {
        id: true,
        title: true,
        priority: true,
        status: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { id: 'asc' }],
      take: 5,
    }),
    database.timeEntry.groupBy({
      by: ['projectId'],
      where: { project: { userId }, workDate: { gte: dates.startDate } },
      _sum: { durationMinutes: true },
      orderBy: { _sum: { durationMinutes: 'desc' } },
      take: 5,
    }),
    database.timeEntry.aggregate({
      where: { project: { userId }, workDate: { gte: dates.startDate } },
      _sum: { durationMinutes: true },
    }),
    database.payment.groupBy({
      by: ['status'],
      where: ownedPaymentWhere,
      _sum: { amount: true },
    }),
    database.payment.aggregate({
      where: { ...ownedPaymentWhere, status: 'PENDING', dueDate: { lt: dates.today } },
      _sum: { amount: true },
    }),
    database.payment.aggregate({
      where: { ...ownedPaymentWhere, status: 'PAID', paidAt: { gte: dates.startInstant } },
      _sum: { amount: true },
    }),
    database.project.findMany({
      where: { userId },
      select: { id: true, name: true, updatedAt: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 3,
    }),
    database.task.findMany({
      where: { project: { userId } },
      select: {
        id: true,
        title: true,
        status: true,
        completedAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 3,
    }),
    database.timeEntry.findMany({
      where: { project: { userId } },
      select: {
        id: true,
        description: true,
        createdAt: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 3,
    }),
    database.payment.findMany({
      where: ownedPaymentWhere,
      select: {
        id: true,
        description: true,
        status: true,
        paidAt: true,
        createdAt: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      take: 3,
    }),
  ]);

  const hourProjectIds = hourGroups.map((group) => group.projectId);
  const hourProjects = await database.project.findMany({
    where: { id: { in: hourProjectIds }, userId },
    select: { id: true, name: true, archivedAt: true },
  });
  const hourProjectsById = new Map(hourProjects.map((project) => [project.id, project]));
  const byProject = hourGroups.flatMap((group) => {
    const project = hourProjectsById.get(group.projectId);
    return project
      ? [
          {
            projectId: project.id,
            projectName: project.name,
            archivedAt: project.archivedAt,
            totalMinutes: group._sum.durationMinutes ?? 0,
          },
        ]
      : [];
  });
  const trackedMinutes = hourTotal._sum.durationMinutes ?? 0;
  const automaticIds = projects
    .filter((project) => project.progressMode === 'AUTO')
    .map((project) => project.id);
  const completedGroups =
    automaticIds.length === 0
      ? []
      : await database.task.groupBy({
          by: ['projectId'],
          where: { projectId: { in: automaticIds }, project: { userId }, status: 'DONE' },
          _count: { _all: true },
        });
  const completedByProject = new Map(
    completedGroups.map((group) => [group.projectId, group._count._all]),
  );
  const taskCount = (status: 'TODO' | 'IN_PROGRESS') =>
    taskGroups.find((group) => group.status === status)?._count._all ?? 0;
  const todo = taskCount('TODO');
  const inProgress = taskCount('IN_PROGRESS');
  const paymentTotal = (status: 'PENDING' | 'PAID') =>
    paymentGroups.find((group) => group.status === status)?._sum.amount;
  const pending = decimal(paymentTotal('PENDING'));
  const overdue = decimal(overdueAggregate._sum.amount);

  const recentActivity = [
    ...recentProjects.map((project) => ({
      id: `PROJECT:${project.id}`,
      type: 'PROJECT' as const,
      label: `Projeto atualizado: ${project.name}`,
      timestamp: project.updatedAt,
      href: `/projetos/${project.id}`,
    })),
    ...recentTasks.map((task) => ({
      id: `TASK:${task.id}`,
      type: 'TASK' as const,
      label:
        task.status === 'DONE'
          ? `Tarefa concluída: ${task.title}`
          : `Tarefa atualizada: ${task.title}`,
      timestamp: task.status === 'DONE' && task.completedAt ? task.completedAt : task.updatedAt,
      href: `/projetos/${task.project.id}`,
    })),
    ...recentTimeEntries.map((entry) => ({
      id: `TIME_ENTRY:${entry.id}`,
      type: 'TIME_ENTRY' as const,
      label: `Tempo registrado: ${entry.description ?? entry.project.name}`,
      timestamp: entry.createdAt,
      href: `/projetos/${entry.project.id}`,
    })),
    ...recentPayments.map((payment) => ({
      id: `PAYMENT:${payment.id}`,
      type: 'PAYMENT' as const,
      label:
        payment.status === 'PAID'
          ? `Pagamento recebido: ${payment.description}`
          : `Cobrança atualizada: ${payment.description}`,
      timestamp: payment.status === 'PAID' && payment.paidAt ? payment.paidAt : payment.updatedAt,
      href: `/projetos/${payment.project.id}`,
    })),
  ]
    .sort(
      (left, right) =>
        right.timestamp.getTime() - left.timestamp.getTime() || left.id.localeCompare(right.id),
    )
    .slice(0, 8)
    .map((activity) => ({ ...activity, timestamp: activity.timestamp.toISOString() }));

  return {
    period: query.period,
    periodStart: dates.startDateApi,
    summary: {
      activeProjects,
      openTasks: todo + inProgress,
      trackedMinutes,
      pendingAmount: pending,
      overdueAmount: overdue,
    },
    projects: projects.map(({ progressMode, _count, ...project }) => ({
      ...project,
      progress:
        progressMode === 'AUTO'
          ? calculatedProgress(_count.tasks, completedByProject.get(project.id) ?? 0)
          : project.progress,
      dueDate: project.dueDate ? dateToApi(project.dueDate) : null,
    })),
    tasks: {
      counts: { todo, inProgress, doneInPeriod },
      attention: attentionTasks.map((task) => ({
        ...task,
        dueDate: task.dueDate ? dateToApi(task.dueDate) : null,
        isOverdue: Boolean(task.dueDate && task.dueDate < dates.today),
      })),
    },
    hours: { totalMinutes: trackedMinutes, byProject },
    finance: {
      paidInPeriod: decimal(paidInPeriodAggregate._sum.amount),
      pendingCurrent: pending,
      overdueCurrent: overdue,
    },
    recentActivity,
  };
}
