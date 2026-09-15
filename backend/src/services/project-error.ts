export class ProjectError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function projectNotFound(): ProjectError {
  return new ProjectError(404, 'PROJECT_NOT_FOUND', 'Projeto não encontrado.');
}

export function projectClientUnavailable(): ProjectError {
  return new ProjectError(
    404,
    'PROJECT_CLIENT_UNAVAILABLE',
    'Cliente não encontrado ou indisponível.',
  );
}

export function invalidProjectDates(): ProjectError {
  return new ProjectError(
    400,
    'INVALID_PROJECT_DATES',
    'O prazo não pode ser anterior à data de início.',
  );
}

export function projectProgressManaged(): ProjectError {
  return new ProjectError(
    409,
    'PROJECT_PROGRESS_MANAGED',
    'O progresso deste projeto é calculado automaticamente pelas tarefas.',
  );
}
