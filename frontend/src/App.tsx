import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouteErrorBoundary } from './components/RouteErrorBoundary';
import { isShowcase } from './site';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const PortalPage = lazy(() =>
  import('./pages/PortalPage').then((module) => ({ default: module.PortalPage })),
);
const LandingPage = lazy(() =>
  import('./pages/LandingPage').then((module) => ({ default: module.LandingPage })),
);
const AuthenticatedApp = lazy(() =>
  import('./routes/AuthenticatedApp').then((module) => ({ default: module.AuthenticatedApp })),
);

export function App() {
  return (
    <RouteErrorBoundary>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route
              path="/"
              element={
                <Suspense
                  fallback={
                    <div className="route-loading" role="status">
                      Carregando DevFlow…
                    </div>
                  }
                >
                  <LandingPage />
                </Suspense>
              }
            />
            {isShowcase ? (
              <Route path="*" element={<Navigate to="/" replace />} />
            ) : (
              <>
                <Route
                  path="/portal/:token"
                  element={
                    <Suspense
                      fallback={
                        <div className="client-portal route-loading" role="status">
                          Carregando portal…
                        </div>
                      }
                    >
                      <PortalPage />
                    </Suspense>
                  }
                />
                <Route
                  path="*"
                  element={
                    <Suspense
                      fallback={
                        <div className="route-loading" role="status">
                          Carregando página…
                        </div>
                      }
                    >
                      <AuthenticatedApp />
                    </Suspense>
                  }
                />
              </>
            )}
          </Routes>
        </QueryClientProvider>
      </BrowserRouter>
    </RouteErrorBoundary>
  );
}
