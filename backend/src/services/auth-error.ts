export class AuthError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function unauthorized(): AuthError {
  return new AuthError(401, 'UNAUTHENTICATED', 'Sua sessão expirou. Entre novamente.');
}
