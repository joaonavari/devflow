import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BriefcaseBusiness,
  CircleDollarSign,
  Clock3,
  FolderKanban,
  ListTodo,
  Plus,
  ReceiptText,
  UsersRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { PageHeader } from '../components/PageHeader';
import { dashboardKeys, getDashboard, type DashboardPeriod } from '../dashboard/dashboard-api';
import { formatMoney } from '../payments/payment-format';
import { formatProjectDate, projectStatusLabels } from '../projects/project-format';
import { formatTaskDate, taskPriorityLabels, taskStatusLabels } from '../tasks/task-format';
import { formatDuration } from '../time-entries/time-entry-format';

const periodLabels: Record<DashboardPeriod, string> = {
  TODAY: 'Hoje',
  '7D': 'Últimos 7 dias',
  '30D': 'Últimos 30 dias',
};

const activityIcons = {
  PROJECT: FolderKanban,
  TASK: ListTodo,
  TIME_ENTRY: Clock3,
  PAYMENT: CircleDollarSign,
} as const;

export function DashboardPage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [period, setPeriod] = useState<DashboardPeriod>('30D');
  const query = useQuery({
    queryKey: dashboardKeys.detail(userId, period),
    queryFn: () => getDashboard(period),
    enabled: Boolean(userId),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (query.isPending) {
    return (
      <div className="dashboard-loading" role="status">
        Preparando seu Dashboard…
      </div>
    );
  }
  if (query.isError) {
    return (
      <section className="dashboard-error" role="alert">
        <BriefcaseBusiness size={28} aria-hidden="true" />
        <h1>Não foi possível carregar o Dashboard</h1>
        <p>Confira sua conexão e tente novamente.</p>
        <button className="secondary-button" type="button" onClick={() => void query.refetch()}>
          Tentar novamente
        </button>
      </section>
    );
  }

  const data = query.data;
  const isNewAccount = data.summary.activeProjects === 0 && data.recentActivity.length === 0;
  return (
    <>
      <div className="dashboard-heading-row">
        <PageHeader
          title="Dashboard"
          description="Uma visão objetiva do trabalho, tempo e financeiro."
        />
        <label className="dashboard-period">
          <span>Período</span>
          <select
            data-dashboard-period
            value={period}
            onChange={(event) => {
              setPeriod(event.target.value as DashboardPeriod);
            }}
          >
            {Object.entries(periodLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="dashboard-shortcuts" aria-label="Ações rápidas">
        <span>Ações rápidas</span>
        <Link to="/clientes">
          <UsersRound size={15} aria-hidden="true" /> Novo cliente
        </Link>
        <Link to="/projetos">
          <FolderKanban size={15} aria-hidden="true" /> Novo projeto
        </Link>
        <Link to="/tarefas">
          <ListTodo size={15} aria-hidden="true" /> Nova tarefa
        </Link>
        <Link to="/horas">
          <Clock3 size={15} aria-hidden="true" /> Registrar tempo
        </Link>
        <Link to="/financeiro">
          <ReceiptText size={15} aria-hidden="true" /> Nova cobrança
        </Link>
      </nav>

      {isNewAccount && (
        <section className="dashboard-onboarding" aria-labelledby="dashboard-onboarding-title">
          <div>
            <span>Primeiros passos</span>
            <h2 id="dashboard-onboarding-title">Organize seu primeiro projeto</h2>
            <p>
              Cadastre um cliente e crie o projeto para começar a acompanhar tarefas, horas e
              cobranças.
            </p>
          </div>
          <Link className="primary-button" to="/clientes">
            <Plus size={17} aria-hidden="true" /> Cadastrar primeiro cliente
          </Link>
        </section>
      )}

      <section className="dashboard-metrics" aria-label="Resumo principal">
        <Metric
          label="Projetos ativos"
          value={String(data.summary.activeProjects)}
          note="Estado atual"
          name="projects"
        />
        <Metric
          label="Tarefas abertas"
          value={String(data.summary.openTasks)}
          note="Estado atual"
          name="tasks"
        />
        <Metric
          label="Horas registradas"
          value={formatDuration(data.summary.trackedMinutes)}
          note={periodLabels[period]}
          name="hours"
        />
        <Metric
          label="Valor pendente"
          value={formatMoney(data.summary.pendingAmount)}
          note="Estado atual"
          name="pending"
        />
        <Metric
          label="Valor vencido"
          value={formatMoney(data.summary.overdueAmount)}
          note="Estado atual"
          name="overdue"
          danger
        />
      </section>

      <div className="dashboard-primary-grid">
        <section className="dashboard-panel" aria-labelledby="dashboard-projects-title">
          <PanelHeading
            eyebrow="Projetos"
            title="Em andamento"
            href="/projetos"
            id="dashboard-projects-title"
          />
          {data.projects.length === 0 ? (
            <PanelEmpty text="Nenhum projeto em andamento." />
          ) : (
            <ul className="dashboard-project-list">
              {data.projects.map((project) => (
                <li key={project.id}>
                  <Link to={`/projetos/${project.id}`}>
                    <div>
                      <strong>{project.name}</strong>
                      <span>{project.client.name}</span>
                    </div>
                    <div className="dashboard-project-meta">
                      <span>{projectStatusLabels[project.status]}</span>
                      <b>{project.progress}%</b>
                    </div>
                    <span
                      className="dashboard-progress"
                      aria-label={`${String(project.progress)}% concluído`}
                    >
                      <span style={{ width: `${String(project.progress)}%` }} />
                    </span>
                    <small>
                      {project.dueDate
                        ? `Prazo ${formatProjectDate(project.dueDate)}`
                        : 'Sem prazo definido'}
                    </small>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dashboard-panel" aria-labelledby="dashboard-tasks-title">
          <PanelHeading
            eyebrow="Tarefas"
            title="Exigem atenção"
            href="/tarefas"
            id="dashboard-tasks-title"
          />
          <div className="dashboard-task-counts">
            <span>
              <b data-dashboard-task-count="todo">{data.tasks.counts.todo}</b> A fazer
            </span>
            <span>
              <b data-dashboard-task-count="progress">{data.tasks.counts.inProgress}</b> Em
              andamento
            </span>
            <span>
              <b data-dashboard-task-count="done">{data.tasks.counts.doneInPeriod}</b> Concluídas no
              período
            </span>
          </div>
          {data.tasks.attention.length === 0 ? (
            <PanelEmpty text="Nenhuma tarefa com prazo exige atenção." />
          ) : (
            <ul className="dashboard-task-list">
              {data.tasks.attention.map((task) => (
                <li key={task.id}>
                  <Link to={`/projetos/${task.project.id}`}>
                    <div>
                      <strong>{task.title}</strong>
                      <span>{task.project.name}</span>
                    </div>
                    <span className="dashboard-priority" data-priority={task.priority}>
                      {taskPriorityLabels[task.priority]}
                    </span>
                    <span className="dashboard-task-status">{taskStatusLabels[task.status]}</span>
                    <time className={task.isOverdue ? 'is-overdue' : ''} dateTime={task.dueDate}>
                      {task.isOverdue ? 'Atrasada · ' : ''}
                      {formatTaskDate(task.dueDate)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="dashboard-secondary-grid">
        <section className="dashboard-panel" aria-labelledby="dashboard-hours-title">
          <PanelHeading
            eyebrow="Horas"
            title="Projetos com mais tempo"
            href="/horas"
            id="dashboard-hours-title"
          />
          <p className="dashboard-panel-total" data-dashboard-hours-total>
            {formatDuration(data.hours.totalMinutes)}{' '}
            <span>{periodLabels[period].toLowerCase()}</span>
          </p>
          {data.hours.byProject.length === 0 ? (
            <PanelEmpty text="Nenhuma hora registrada no período." />
          ) : (
            <HoursRanking projects={data.hours.byProject} />
          )}
        </section>
        <section className="dashboard-panel" aria-labelledby="dashboard-finance-title">
          <PanelHeading
            eyebrow="Financeiro"
            title="Recebimentos"
            href="/financeiro"
            id="dashboard-finance-title"
          />
          <dl className="dashboard-finance-list">
            <div>
              <dt>Pago no período</dt>
              <dd data-dashboard-finance="paid">{formatMoney(data.finance.paidInPeriod)}</dd>
            </div>
            <div>
              <dt>Pendente atual</dt>
              <dd data-dashboard-finance="pending">{formatMoney(data.finance.pendingCurrent)}</dd>
            </div>
            <div>
              <dt>Vencido atual</dt>
              <dd className="is-overdue" data-dashboard-finance="overdue">
                {formatMoney(data.finance.overdueCurrent)}
              </dd>
            </div>
          </dl>
          <p className="dashboard-finance-note">
            Pago considera {periodLabels[period].toLowerCase()}; pendente e vencido mostram a
            posição atual.
          </p>
        </section>
      </div>

      <section
        className="dashboard-panel dashboard-activity"
        aria-labelledby="dashboard-activity-title"
      >
        <div className="dashboard-panel-heading">
          <div>
            <span>Recentes</span>
            <h2 id="dashboard-activity-title">Atividade recente</h2>
          </div>
        </div>
        {data.recentActivity.length === 0 ? (
          <PanelEmpty text="A atividade dos projetos aparecerá aqui." />
        ) : (
          <ul>
            {data.recentActivity.map((activity) => {
              const Icon = activityIcons[activity.type];
              return (
                <li key={activity.id}>
                  <Link to={activity.href}>
                    <span className="dashboard-activity-icon">
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <strong>{activity.label}</strong>
                    <time dateTime={activity.timestamp}>
                      {formatTimestamp(activity.timestamp, user?.timezone ?? 'UTC')}
                    </time>
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

function Metric({
  label,
  value,
  note,
  name,
  danger = false,
}: {
  label: string;
  value: string;
  note: string;
  name: string;
  danger?: boolean;
}) {
  return (
    <div className={danger ? 'is-danger' : ''} data-dashboard-metric={name}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}

function PanelHeading({
  eyebrow,
  title,
  href,
  id,
}: {
  eyebrow: string;
  title: string;
  href: string;
  id: string;
}) {
  return (
    <div className="dashboard-panel-heading">
      <div>
        <span>{eyebrow}</span>
        <h2 id={id}>{title}</h2>
      </div>
      <Link to={href}>
        Ver todos <ArrowRight size={15} aria-hidden="true" />
      </Link>
    </div>
  );
}

function PanelEmpty({ text }: { text: string }) {
  return <p className="dashboard-panel-empty">{text}</p>;
}

function HoursRanking({
  projects,
}: {
  projects: {
    projectId: string;
    projectName: string;
    totalMinutes: number;
    archivedAt: string | null;
  }[];
}) {
  const maximum = useMemo(
    () => Math.max(...projects.map((project) => project.totalMinutes), 1),
    [projects],
  );
  return (
    <ul className="dashboard-hours-list">
      {projects.map((project) => (
        <li key={project.projectId}>
          <div>
            <Link to={`/projetos/${project.projectId}`}>{project.projectName}</Link>
            <span>
              {formatDuration(project.totalMinutes)}
              {project.archivedAt ? ' · arquivado' : ''}
            </span>
          </div>
          <span className="dashboard-hours-bar" aria-hidden="true">
            <span style={{ width: `${String((project.totalMinutes / maximum) * 100)}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

function formatTimestamp(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(value));
}
