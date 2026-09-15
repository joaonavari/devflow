import { createContext, useContext } from 'react';
import type { AuthUser } from './auth-api';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  restore: () => Promise<void>;
  signIn: (path: 'login' | 'register', input: object) => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider não encontrado.');
  return context;
}
