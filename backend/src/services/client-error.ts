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
