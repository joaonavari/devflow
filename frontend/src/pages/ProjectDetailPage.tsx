import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, FolderX, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { clientKeys, listClients } from '../clients/client-api';
import { EmptyState } from '../components/EmptyState';
import { DeleteProjectDialog } from '../components/projects/DeleteProjectDialog';
import { ProjectEditForm } from '../components/projects/ProjectEditForm';
import { ProjectKanban } from '../components/tasks/ProjectKanban';
import { ProjectTimeEntries } from '../components/time-entries/ProjectTimeEntries';
import { ProjectPayments } from '../components/payments/ProjectPayments';
import { ProjectPortal } from '../components/portal/ProjectPortal';
import { ProjectStages } from '../components/portal/ProjectStages';
import { portalKeys } from '../portal/portal-api';
import { paymentKeys } from '../payments/payment-api';
import {
  changeProjectArchive,
  deleteProject,
  getProject,
  ProjectApiError,
  projectKeys,
  type Project,
} from '../projects/project-api';
import {
  formatBudget,
  formatProjectDate,
  formatProjectTimestamp,
  projectStatusLabels,
} from '../projects/project-format';

export function ProjectDetailPage() {
  const { projectId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const userId = user?.id ?? '';
  const query = useQuery({
    queryKey: projectKeys.detail(userId, projectId),
    queryFn: () => getProject(projectId),
    enabled: Boolean(userId && projectId),
    retry: false,
  });
  const clientsQuery = useQuery({
    queryKey: clientKeys.list(userId, 'active', ''),
    queryFn: () => listClients('active', ''),
    enabled: Boolean(userId),
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'archive' | 'restore' }) =>
      changeProjectArchive(id, action),
  });
  const deleteMutation = useMutation({ mutationFn: deleteProject });

  async function changeArchive(project: Project) {
    setNotice(null);
    const action = project.archivedAt ? 'restore' : 'archive';
    try {
      const updated = await archiveMutation.mutateAsync({ id: project.id, action });
      queryClient.setQueryData(projectKeys.detail(userId, project.id), updated);
      await queryClient.invalidateQueries({ queryKey: projectKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: paymentKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: portalKeys.state(userId, project.id) });
      setNotice(
        action === 'archive' ? 'Projeto arquivado com sucesso.' : 'Projeto restaurado com sucesso.',
      );
    } catch {
      await queryClient.invalidateQueries({ queryKey: portalKeys.state(userId, project.id) });
      setNotice(
        action === 'archive'
          ? 'Não foi possível arquivar o projeto.'
          : 'Não foi possível restaurar o projeto.',
      );
    }
  }

  async function remove(project: Project) {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(project.id);
      await queryClient.invalidateQueries({ queryKey: projectKeys.all(userId) });
      await queryClient.invalidateQueries({ queryKey: paymentKeys.all(userId) });
      queryClient.removeQueries({ queryKey: projectKeys.detail(userId, project.id) });
      await navigate('/projetos', {
        replace: true,
        state: { notice: `${project.name} foi excluído permanentemente.` },
      });
    } catch (error) {
      setDeleteError(
        error instanceof ProjectApiError
          ? error.message
          : 'Não foi possível excluir o projeto. Tente novamente.',
      );
    }
  }

  if (query.isPending)
    return (
      <div className="detail-loading" role="status">
        Carregando projeto…
      </div>
    );
  if (
    query.isError &&
    query.error instanceof ProjectApiError &&
    [400, 404].includes(query.error.status)
  ) {
    return (
      <section className="project-not-found">
        <EmptyState
          icon={FolderX}
          title="Projeto não encontrado"
          description="O projeto não existe ou não está disponível para sua conta."
        >
          <Link className="text-link" to="/projetos">
            Voltar para projetos
          </Link>
        </EmptyState>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="project-not-found">
        <EmptyState
          icon={FolderX}
          title="Não foi possível carregar o projeto"
          description="Confira sua conexão e tente novamente."
        >
          <button className="text-action" type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </EmptyState>
      </section>
    );
  }

  const project = query.data;
  return (
    <>
      <Link className="back-link" to="/projetos">
        <ArrowLeft size={17} strokeWidth={1.7} aria-hidden="true" />
        Voltar para projetos
      </Link>
      <header className="project-detail-header">
        <div>
          <div className="project-title-line">
            <h1 tabIndex={-1}>{project.name}</h1>
            <span className="project-status" data-status={project.status}>
              {projectStatusLabels[project.status]}
            </span>
          </div>
          <p>
            {project.client.name}
            {project.client.archivedAt ? ' · cliente arquivado' : ''}
          </p>
        </div>
        <button
          className="secondary-button"
          type="button"
          data-project-action={project.archivedAt ? 'restore' : 'archive'}
          disabled={archiveMutation.isPending}
          onClick={() => void changeArchive(project)}
        >
          {project.archivedAt ? (
            <RotateCcw size={17} strokeWidth={1.7} aria-hidden="true" />
          ) : (
            <Archive size={17} strokeWidth={1.7} aria-hidden="true" />
          )}
          {archiveMutation.isPending
            ? 'Processando…'
            : project.archivedAt
              ? 'Restaurar projeto'
              : 'Arquivar projeto'}
        </button>
      </header>

      {project.archivedAt && (
        <p className="archive-notice">
          Este projeto está arquivado desde{' '}
          {formatProjectTimestamp(project.archivedAt, user?.timezone ?? 'UTC')}.
        </p>
      )}
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}

      <section className="project-overview" aria-label="Resumo do projeto">
        <div>
          <span>Progresso</span>
          <strong>{project.progress}%</strong>
          <span className="project-progress-track is-large" aria-hidden="true">
            <span style={{ width: `${String(project.progress)}%` }} />
          </span>
          <small>
            {project.progressMode === 'AUTO'
              ? 'Calculado pelas tarefas concluídas'
              : 'Atualização manual'}
          </small>
        </div>
        <dl>
          <div>
            <dt>Início</dt>
            <dd>{formatProjectDate(project.startDate)}</dd>
          </div>
          <div>
            <dt>Prazo</dt>
            <dd>{project.dueDate ? formatProjectDate(project.dueDate) : 'Sem prazo'}</dd>
          </div>
          <div>
            <dt>Orçamento</dt>
            <dd>{formatBudget(project.budget)}</dd>
          </div>
          <div>
            <dt>Atualização</dt>
            <dd>{formatProjectTimestamp(project.updatedAt, user?.timezone ?? 'UTC')}</dd>
          </div>
        </dl>
      </section>

      <ProjectKanban
        projectId={project.id}
        archived={Boolean(project.archivedAt)}
        onTasksChanged={() => void query.refetch()}
      />

      <ProjectTimeEntries project={project} />

      <ProjectPayments project={project} />

      <ProjectPortal key={`${project.id}:${project.archivedAt ?? 'active'}`} project={project} />
      <ProjectStages
        key={`stages:${project.id}:${project.archivedAt ?? 'active'}`}
        project={project}
      />

      <div className="project-detail-grid">
        <section className="detail-section" aria-labelledby="project-data-title">
          <div className="detail-section-heading">
            <div>
              <h2 id="project-data-title">Dados do projeto</h2>
              <p>Cliente, escopo, datas e forma de acompanhamento.</p>
            </div>
          </div>
          {clientsQuery.isError ? (
            <div className="project-form-unavailable" role="alert">
              Não foi possível carregar os clientes para edição.
              <button type="button" onClick={() => void clientsQuery.refetch()}>
                Tentar novamente
              </button>
            </div>
          ) : (
            <ProjectEditForm
              project={project}
              clients={clientsQuery.data?.data ?? []}
              onSaved={(updated) => {
                setNotice(`${updated.name} foi atualizado com sucesso.`);
              }}
            />
          )}
        </section>

        <aside className="danger-section" aria-labelledby="project-danger-title">
          <h2 id="project-danger-title">Exclusão permanente</h2>
          <p>Remova este projeto e seus dados definitivamente.</p>
          <button
            className="danger-link"
            type="button"
            data-project-action="delete"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 size={17} strokeWidth={1.7} aria-hidden="true" />
            Excluir projeto
          </button>
        </aside>
      </div>

      <DeleteProjectDialog
        open={deleteOpen}
        projectName={project.name}
        pending={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => void remove(project)}
      />
    </>
  );
}
