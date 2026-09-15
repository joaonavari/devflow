import { z } from 'zod';

const userResponse = z.object({
  user: z.object({ id: z.uuid(), name: z.string(), email: z.email(), timezone: z.string() }),
});
export type AuthUser = z.infer<typeof userResponse>['user'];
const errorResponse = z.object({ error: z.object({ message: z.string() }) });

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request(path: string, body?: object): Promise<Response> {
  try {
    return await fetch(`/api/v1/auth/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'include',
      cache: 'no-store',
      headers:
        body === undefined ? {} : { 'Content-Type': 'application/json', 'X-DevFlow-Request': '1' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(
      0,
      'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
    );
  }
}

async function readUser(response: Response): Promise<AuthUser> {
  const data: unknown = await response.json();
  if (!response.ok) {
    const error = errorResponse.safeParse(data);
    throw new ApiError(
      response.status,
      error.success ? error.data.error.message : 'Não foi possível concluir a solicitação.',
    );
  }
  return userResponse.parse(data).user;
}

// Web Locks coordinate cookie mutations across tabs; the promise below also covers StrictMode.
async function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  return 'locks' in navigator ? await navigator.locks.request('devflow-session', action) : action();
}

let sessionRequest: Promise<AuthUser | null> | undefined;
export function discoverSession(): Promise<AuthUser | null> {
  sessionRequest ??= withSessionLock(async () => {
    const current = await request('me');
    if (current.status !== 401) return readUser(current);
    const refreshed = await request('refresh', {});
    if (refreshed.status === 401) return null;
    if (refreshed.status === 409) {
      // One bounded check for a concurrent winner, without retrying the stale token.
      const winner = await request('me');
      return winner.status === 401 ? null : readUser(winner);
    }
    return readUser(refreshed);
  }).finally(() => {
    sessionRequest = undefined;
  });
  return sessionRequest;
}

export function submitCredentials(path: 'login' | 'register', body: object): Promise<AuthUser> {
  return withSessionLock(async () => readUser(await request(path, body)));
}

export function revokeSession(): Promise<void> {
  return withSessionLock(async () => {
    const response = await request('logout', {});
    if (!response.ok) await readUser(response);
  });
}
