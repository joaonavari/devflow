import { matchPath, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from './auth-context';
import { navigationItems } from '../routes/navigation';

export function AuthGuard({ guest = false }: { guest?: boolean }) {
  const { user, loading, error, restore } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="session-status" role="status">
        Verificando sua sessão…
      </main>
    );
  if (error)
    return (
      <main className="session-status">
        <p role="alert">{error}</p>
        <button
          className="auth-submit"
          onClick={() => {
            void restore();
          }}
        >
          Tentar novamente
        </button>
      </main>
    );
  if (guest) {
    const destination: unknown = location.state;
    const from =
      typeof destination === 'object' && destination !== null && 'from' in destination
        ? destination.from
        : undefined;
    let path = '/dashboard';
    if (
      typeof from === 'string' &&
      from.startsWith('/') &&
      !from.startsWith('//') &&
      !from.includes('\\')
    ) {
      const destination = new URL(from, window.location.origin);
      if (
        destination.origin === window.location.origin &&
        (navigationItems.some((item) => item.path === destination.pathname) ||
          ['/clientes/:clientId', '/projetos/:projectId'].some((pattern) =>
            matchPath(pattern, destination.pathname),
          ))
      )
        path = destination.pathname + destination.search + destination.hash;
    }
    return user ? <Navigate to={path} replace /> : <Outlet />;
  }
  return user ? (
    <Outlet />
  ) : (
    <Navigate
      to="/login"
      state={{ from: location.pathname + location.search + location.hash }}
      replace
    />
  );
}
