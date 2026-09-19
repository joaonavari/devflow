import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { discoverSession, revokeSession, submitCredentials, type AuthUser } from './auth-api';
import { AuthContext } from './auth-context';
import { useQueryClient } from '@tanstack/react-query';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);
  const queryClient = useQueryClient();
  const identity = useRef<string | null | undefined>(undefined);
  const acceptUser = useCallback(
    (next: AuthUser | null) => {
      const nextId = next?.id ?? null;
      if (identity.current !== nextId) queryClient.clear();
      identity.current = nextId;
      setUser(next);
    },
    [queryClient],
  );

  const restore = useCallback(async () => {
    const current = ++generation.current;
    try {
      const restored = await discoverSession();
      if (current !== generation.current) return;
      acceptUser(restored);
      setError(null);
    } catch {
      if (current !== generation.current) return;
      setError('Não foi possível verificar sua sessão. Confira a conexão e tente novamente.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, [acceptUser]);

  useEffect(() => {
    let active = true;
    const current = ++generation.current;
    void discoverSession().then(
      (restored) => {
        if (active && current === generation.current) {
          acceptUser(restored);
          setError(null);
          setLoading(false);
        }
      },
      () => {
        if (active && current === generation.current) {
          setError('Não foi possível verificar sua sessão. Confira a conexão e tente novamente.');
          setLoading(false);
        }
      },
    );
    const onFocus = () => {
      void restore();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void restore();
    }, 60_000);
    window.addEventListener('focus', onFocus);
    if ('BroadcastChannel' in window) {
      channel.current = new BroadcastChannel('devflow-auth');
      channel.current.onmessage = onFocus;
    }
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      channel.current?.close();
    };
  }, [restore, acceptUser]);

  async function signIn(path: 'login' | 'register', input: object) {
    ++generation.current;
    const authenticated = await submitCredentials(path, input);
    ++generation.current;
    acceptUser(authenticated);
    setError(null);
    setLoading(false);
    channel.current?.postMessage('changed');
  }

  async function signOut() {
    ++generation.current;
    await revokeSession();
    ++generation.current;
    acceptUser(null);
    setError(null);
    setLoading(false);
    channel.current?.postMessage('changed');
  }

  return (
    <AuthContext value={{ user, loading, error, restore, signIn, signOut }}>{children}</AuthContext>
  );
}
