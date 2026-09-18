import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AppRoutes } from './routes/AppRoutes';
import { AuthProvider } from './auth/AuthProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

const PortalPage = lazy(() =>
  import('./pages/PortalPage').then((module) => ({ default: module.PortalPage })),
);

export function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <Routes>
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
              <AuthProvider>
                <AppRoutes />
              </AuthProvider>
            }
          />
        </Routes>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
