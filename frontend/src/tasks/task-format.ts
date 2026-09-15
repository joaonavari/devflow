import type { TaskPriority, TaskStatus } from './task-schemas';

export const taskStatusLabels: Record<TaskStatus, string> = {
  TODO: 'A fazer',
  IN_PROGRESS: 'Em andamento',
  DONE: 'Concluídas',
};

export const taskPriorityLabels: Record<TaskPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};

export const taskDueLabels = {
  all: 'Todos os prazos',
  overdue: 'Atrasadas',
  today: 'Vencem hoje',
  upcoming: 'Próximas',
  none: 'Sem prazo',
} as const;

export function formatTaskDate(value: string): string {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}
