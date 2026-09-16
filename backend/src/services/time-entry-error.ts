export class TimeEntryError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function timeEntryNotFound(): TimeEntryError {
  return new TimeEntryError(404, 'TIME_ENTRY_NOT_FOUND', 'Registro de horas não encontrado.');
}

export function timeEntryProjectNotFound(): TimeEntryError {
  return new TimeEntryError(404, 'TIME_ENTRY_PROJECT_NOT_FOUND', 'Projeto não encontrado.');
}

export function archivedProjectReadOnly(): TimeEntryError {
  return new TimeEntryError(
    409,
    'PROJECT_ARCHIVED',
    'Restaure o projeto antes de alterar seus registros de horas.',
  );
}
