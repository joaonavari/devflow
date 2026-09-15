import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { NotFoundPage } from '../pages/NotFoundPage';
import { PlaceholderPage } from '../pages/PlaceholderPage';
import { navigationItems } from './navigation';
import { AuthGuard } from '../auth/AuthGuard';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { ClientsPage } from '../pages/ClientsPage';
import { ClientDetailPage } from '../pages/ClientDetailPage';
import { ProjectDetailPage } from '../pages/ProjectDetailPage';
import { ProjectsPage } from '../pages/ProjectsPage';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthGuard guest />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>
      <Route element={<AuthGuard />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/clientes/:clientId" element={<ClientDetailPage />} />
          <Route path="/projetos" element={<ProjectsPage />} />
          <Route path="/projetos/:projectId" element={<ProjectDetailPage />} />
          {navigationItems
            .filter((item) => !['/clientes', '/projetos'].includes(item.path))
            .map((item) => (
              <Route
                key={item.path}
                path={item.path}
                element={
                  <PlaceholderPage
                    title={item.label}
                    description={item.description}
                    placeholder={item.placeholder}
                    icon={item.icon}
                  />
                }
              />
            ))}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
