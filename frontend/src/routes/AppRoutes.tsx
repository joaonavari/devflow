import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { AuthGuard } from '../auth/AuthGuard';

const LoginPage = lazy(() =>
  import('../pages/LoginPage').then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('../pages/RegisterPage').then((module) => ({ default: module.RegisterPage })),
);
const ClientsPage = lazy(() =>
  import('../pages/ClientsPage').then((module) => ({ default: module.ClientsPage })),
);
const ClientDetailPage = lazy(() =>
  import('../pages/ClientDetailPage').then((module) => ({ default: module.ClientDetailPage })),
);
const ProjectsPage = lazy(() =>
  import('../pages/ProjectsPage').then((module) => ({ default: module.ProjectsPage })),
);
const ProjectDetailPage = lazy(() =>
  import('../pages/ProjectDetailPage').then((module) => ({ default: module.ProjectDetailPage })),
);
const TasksPage = lazy(() =>
  import('../pages/TasksPage').then((module) => ({ default: module.TasksPage })),
);
const HoursPage = lazy(() =>
  import('../pages/HoursPage').then((module) => ({ default: module.HoursPage })),
);
const FinancePage = lazy(() =>
  import('../pages/FinancePage').then((module) => ({ default: module.FinancePage })),
);
const DashboardPage = lazy(() =>
  import('../pages/DashboardPage').then((module) => ({ default: module.DashboardPage })),
);
const NotFoundPage = lazy(() =>
  import('../pages/NotFoundPage').then((module) => ({ default: module.NotFoundPage })),
);
const SettingsPage = lazy(() =>
  import('../pages/SettingsPage').then((module) => ({ default: module.SettingsPage })),
);

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="route-loading" role="status">
          Carregando página…
        </div>
      }
    >
      <Routes>
        <Route element={<AuthGuard guest />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/clientes" element={<ClientsPage />} />
            <Route path="/clientes/:clientId" element={<ClientDetailPage />} />
            <Route path="/projetos" element={<ProjectsPage />} />
            <Route path="/projetos/:projectId" element={<ProjectDetailPage />} />
            <Route path="/tarefas" element={<TasksPage />} />
            <Route path="/horas" element={<HoursPage />} />
            <Route path="/financeiro" element={<FinancePage />} />
            <Route path="/configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
