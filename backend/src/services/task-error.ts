export class TaskError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function taskNotFound(): TaskError {
  return new TaskError(404, 'TASK_NOT_FOUND', 'Tarefa não encontrada.');
}

export function taskProjectNotFound(): TaskError {
  return new TaskError(404, 'TASK_PROJECT_NOT_FOUND', 'Projeto não encontrado.');
}

export function archivedProjectReadOnly(): TaskError {
  return new TaskError(
    409,
    'PROJECT_ARCHIVED',
    'Restaure o projeto antes de alterar suas tarefas.',
  );
}
