export class ClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function clientNotFound(): ClientError {
  return new ClientError(404, 'CLIENT_NOT_FOUND', 'Cliente não encontrado.');
}

export function clientHasProjects(): ClientError {
  return new ClientError(
    409,
    'CLIENT_HAS_PROJECTS',
    'Este cliente possui projetos e não pode ser excluído permanentemente.',
  );
}
