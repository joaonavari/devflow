import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { discoverSession, revokeSession, submitCredentials, type AuthUser } from './auth-api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  const restore = useCallback(async () => {
    const current = ++generation.current;
    try {
      const restored = await discoverSession();
      if (current !== generation.current) return;
      setUser(restored);
      setError(null);
    } catch {
      if (current !== generation.current) return;
      setError('Não foi possível verificar sua sessão. Confira a conexão e tente novamente.');
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void discoverSession().then(
      (restored) => {
        if (active) {
          setUser(restored);
          setError(null);
          setLoading(false);
        }
      },
      () => {
        if (active) {
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
  }, [restore]);

  async function signIn(path: 'login' | 'register', input: object) {
    ++generation.current;
    const authenticated = await submitCredentials(path, input);
    ++generation.current;
    setUser(authenticated);
    setError(null);
    setLoading(false);
    channel.current?.postMessage('changed');
  }

  async function signOut() {
    ++generation.current;
    await revokeSession();
    ++generation.current;
    setUser(null);
    setError(null);
    setLoading(false);
    channel.current?.postMessage('changed');
  }

  return (
    <AuthContext value={{ user, loading, error, restore, signIn, signOut }}>{children}</AuthContext>
  );
}
