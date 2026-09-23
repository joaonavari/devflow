import { useEffect } from 'react';
import { AuthProvider } from '../auth/AuthProvider';
import { AppRoutes } from './AppRoutes';

// Keep session discovery and the administrative shell outside the public bundle.
export function AuthenticatedApp() {
  useEffect(() => {
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = robots?.content;
    if (robots) robots.content = 'noindex, nofollow';
    return () => {
      if (robots && previous !== undefined) robots.content = previous;
    };
  }, []);

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
