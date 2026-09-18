import { useQuery } from '@tanstack/react-query';
import { Check, Layers, LockKeyhole, RefreshCw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { PublicPortalError, readPublicPortal } from '../portal/public-portal-api';
import { formatProjectDate, projectStatusLabels } from '../projects/project-format';
import { taskPriorityLabels, taskStatusLabels } from '../tasks/task-format';
const stageLabels = { PENDING: 'Pendente', IN_PROGRESS: 'Em andamento', COMPLETED: 'Concluída' };

export function PortalPage() {
  const { token = '' } = useParams();
  const query = useQuery({
    queryKey: ['public-portal', token],
    queryFn: ({ signal }) => readPublicPortal(token, signal),
    gcTime: 0,
    staleTime: 0,
    retry: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const unavailable =
    query.isError && query.error instanceof PublicPortalError && query.error.status === 404;
  return (
    <div className="client-portal">
      <title>Portal do cliente · DevFlow</title>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="referrer" content="no-referrer" />
      <a className="portal-skip" href="#portal-content">
        Ir para o conteúdo
      </a>
      <header className="portal-masthead">
        <span className="portal-brand">
          <Layers size={22} strokeWidth={1.7} aria-hidden="true" /> DevFlow
          <span className="portal-brand-divider" />
          Portal do cliente
        </span>
        <span className="portal-readonly">
          <LockKeyhole size={14} aria-hidden="true" /> Somente leitura
        </span>
      </header>
      <main id="portal-content" tabIndex={-1}>
        {query.isPending ? (
          <div className="portal-message" role="status">
            <p className="portal-eyebrow">Acompanhamento do projeto</p>
            <h1>Carregando seu portal…</h1>
          </div>
        ) : query.isError ? (
          <div className="portal-message" role="alert">
            <LockKeyhole size={28} aria-hidden="true" />
            <p className="portal-eyebrow">Portal do cliente</p>
            <h1>
              {unavailable
                ? 'Este link não está disponível ou expirou.'
                : 'Não foi possível carregar o portal.'}
            </h1>
            <p>
              {unavailable
                ? 'Peça um novo link à pessoa responsável pelo projeto.'
                : 'Verifique sua conexão e tente novamente.'}
            </p>
            <button
              className="secondary-button"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Tentar novamente
            </button>
          </div>
        ) : (
          <>
            <section className="portal-hero" aria-labelledby="portal-project-title">
              <div className="portal-hero-copy">
                <p className="portal-eyebrow">Seu projeto, em perspectiva</p>
                <h1 id="portal-project-title">{query.data.project.name}</h1>
                <span className="project-status" data-status={query.data.project.status}>
                  {projectStatusLabels[query.data.project.status]}
                </span>
                {query.data.project.description && (
                  <p className="portal-description">{query.data.project.description}</p>
                )}
                <dl className="portal-dates">
                  <div>
                    <dt>Início</dt>
                    <dd>{formatProjectDate(query.data.project.startDate)}</dd>
                  </div>
                  {query.data.project.dueDate && (
                    <div>
                      <dt>Prazo de entrega</dt>
                      <dd>{formatProjectDate(query.data.project.dueDate)}</dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="portal-progress">
                <span>Progresso do projeto</span>
                <strong>
                  {query.data.project.progress}
                  <small>%</small>
                </strong>
                <progress
                  max={100}
                  value={query.data.project.progress}
                  aria-label="Progresso do projeto"
                />
                <p>Acompanhe cada avanço por aqui.</p>
              </div>
            </section>
            {query.data.stages.length > 0 && (
              <section className="portal-timeline" aria-labelledby="portal-stages-title">
                <div className="portal-section-heading">
                  <p className="portal-eyebrow">O caminho até a entrega</p>
                  <h2 id="portal-stages-title">Etapas do projeto</h2>
                </div>
                <ol>
                  {query.data.stages.map((stage, index) => (
                    <li key={index} data-status={stage.status}>
                      <span className="portal-milestone" aria-hidden="true">
                        {stage.status === 'COMPLETED' ? (
                          <Check size={17} />
                        ) : (
                          String(index + 1).padStart(2, '0')
                        )}
                      </span>
                      <div>
                        <h3>{stage.title}</h3>
                        <p>{stageLabels[stage.status]}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {query.data.tasks.length > 0 && (
              <section className="portal-tasks" aria-labelledby="portal-tasks-title">
                <div className="portal-section-heading">
                  <p className="portal-eyebrow">Em detalhe</p>
                  <h2 id="portal-tasks-title">Tarefas compartilhadas</h2>
                </div>
                <ul>
                  {query.data.tasks.map((task, index) => (
                    <li key={index}>
                      <div className="portal-task-heading">
                        <h3>{task.title}</h3>
                        <span className="portal-task-status" data-status={task.status}>
                          {taskStatusLabels[task.status]}
                        </span>
                      </div>
                      {task.description && (
                        <p className="portal-task-description">{task.description}</p>
                      )}
                      <div className="portal-task-meta">
                        <span>Prioridade {taskPriorityLabels[task.priority].toLowerCase()}</span>
                        {task.dueDate && <span>Prazo: {formatProjectDate(task.dueDate)}</span>}
                        {task.completedAt && (
                          <span>
                            Concluída em{' '}
                            {new Intl.DateTimeFormat('pt-BR').format(new Date(task.completedAt))}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="portal-refresh">
              <span>Informações compartilhadas pela pessoa responsável pelo projeto.</span>
              <button
                type="button"
                className="secondary-button"
                disabled={query.isFetching}
                onClick={() => void query.refetch()}
              >
                <RefreshCw size={15} aria-hidden="true" />
                {query.isFetching ? 'Atualizando…' : 'Atualizar'}
              </button>
            </div>
          </>
        )}
      </main>
      <footer className="portal-footer">
        DevFlow <span>Acompanhamento com clareza.</span>
      </footer>
    </div>
  );
}
