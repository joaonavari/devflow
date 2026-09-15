import { useQuery } from '@tanstack/react-query';
import { FolderKanban, Plus, Search } from 'lucide-react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { clientKeys, listClients } from '../clients/client-api';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { ProjectCreateDialog } from '../components/projects/ProjectCreateDialog';
import { ProjectList } from '../components/projects/ProjectList';
import {
  listProjects,
  projectKeys,
  type ProjectFilters,
  type ProjectView,
} from '../projects/project-api';
import { projectStatusLabels } from '../projects/project-format';
import { projectStatusSchema, type ProjectStatus } from '../projects/project-schemas';

export function ProjectsPage() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState: unknown = location.state;
  const initialNotice =
    typeof locationState === 'object' &&
    locationState !== null &&
    'notice' in locationState &&
    typeof locationState.notice === 'string'
      ? locationState.notice
      : null;
  const [notice, setNotice] = useState<string | null>(initialNotice);
  const [view, setView] = useState<ProjectView>('active');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const [clientId, setClientId] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const deferredSearch = useDeferredValue(search.trim());
  const userId = user?.id ?? '';
  const filters: ProjectFilters = { view, search: deferredSearch, status, clientId };
  const query = useQuery({
    queryKey: projectKeys.list(userId, filters),
    queryFn: () => listProjects(filters),
    enabled: Boolean(userId),
  });
  const clientsQuery = useQuery({
    queryKey: clientKeys.list(userId, 'active', ''),
    queryFn: () => listClients('active', ''),
    enabled: Boolean(userId),
  });
  const projects = useMemo(() => query.data?.data ?? [], [query.data]);
  const activeClients = useMemo(() => clientsQuery.data?.data ?? [], [clientsQuery.data]);
  const filterClients = useMemo(() => {
    const byId = new Map<string, { id: string; name: string; archivedAt: string | null }>(
      activeClients.map((client) => [
        client.id,
        { id: client.id, name: client.name, archivedAt: client.archivedAt },
      ]),
    );
    for (const project of projects) byId.set(project.client.id, project.client);
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [activeClients, projects]);
  const hasFilters = Boolean(deferredSearch || status || clientId);

  useEffect(() => {
    if (initialNotice) void navigate(location.pathname, { replace: true, state: null });
  }, [initialNotice, location.pathname, navigate]);

  return (
    <>
      <div className="projects-heading-row">
        <PageHeader
          title="Projetos"
          description="Prazos, orçamento e progresso das suas entregas."
        />
        <button
          className="primary-button"
          type="button"
          data-project-action="new"
          disabled={!clientsQuery.isSuccess || activeClients.length === 0}
          title={activeClients.length === 0 ? 'Cadastre um cliente ativo primeiro.' : undefined}
          onClick={() => {
            setNotice(null);
            setCreateOpen(true);
          }}
        >
          <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
          Novo projeto
        </button>
      </div>

      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      {clientsQuery.isSuccess && activeClients.length === 0 && (
        <p className="project-prerequisite" role="status">
          Para criar um projeto, <Link to="/clientes">cadastre ou restaure um cliente</Link>.
        </p>
      )}
      {clientsQuery.isError && (
        <p className="project-prerequisite" role="alert">
          Não foi possível carregar os clientes disponíveis.{' '}
          <button type="button" onClick={() => void clientsQuery.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}

      <section className="projects-panel" aria-labelledby="projects-list-title">
        <div className="projects-toolbar">
          <div>
            <h2 id="projects-list-title">Lista de projetos</h2>
            <p>
              {query.data
                ? `${String(query.data.meta.count)} ${query.data.meta.count === 1 ? 'projeto' : 'projetos'}`
                : 'Carregando registros'}
            </p>
          </div>
          <div className="status-switch" aria-label="Situação dos projetos">
            {(['active', 'archived'] as const).map((option) => (
              <button
                key={option}
                type="button"
                data-project-view={option}
                aria-pressed={view === option}
                onClick={() => {
                  setView(option);
                }}
              >
                {option === 'active' ? 'Ativos' : 'Arquivados'}
              </button>
            ))}
          </div>
        </div>

        <div className="projects-filters">
          <div className="projects-search">
            <Search size={18} strokeWidth={1.7} aria-hidden="true" />
            <label className="sr-only" htmlFor="project-search">
              Pesquisar projetos
            </label>
            <input
              id="project-search"
              type="search"
              value={search}
              maxLength={100}
              placeholder="Buscar por projeto ou cliente"
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>
          <label>
            <span className="sr-only">Filtrar por status</span>
            <select
              data-project-filter="status"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as ProjectStatus | '');
              }}
            >
              <option value="">Todos os status</option>
              {projectStatusSchema.options.map((option) => (
                <option key={option} value={option}>
                  {projectStatusLabels[option]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por cliente</span>
            <select
              data-project-filter="client"
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
              }}
            >
              <option value="">Todos os clientes</option>
              {filterClients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {query.isPending && <div className="projects-loading">Carregando projetos…</div>}
        {query.isError && (
          <div className="projects-message" role="alert">
            <h3>Não foi possível carregar os projetos</h3>
            <p>Confira sua conexão e tente novamente.</p>
            <button className="secondary-button" type="button" onClick={() => void query.refetch()}>
              Tentar novamente
            </button>
          </div>
        )}
        {query.isSuccess && projects.length === 0 && (
          <EmptyState
            icon={hasFilters ? Search : FolderKanban}
            title={
              hasFilters
                ? 'Nenhum projeto encontrado'
                : view === 'active'
                  ? 'Crie seu primeiro projeto'
                  : 'Nenhum projeto arquivado'
            }
            description={
              hasFilters
                ? 'Ajuste a busca ou os filtros para encontrar outra entrega.'
                : view === 'active'
                  ? 'Organize uma entrega com cliente, prazo, orçamento e progresso.'
                  : 'Os projetos arquivados aparecerão aqui.'
            }
          >
            {hasFilters ? (
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setSearch('');
                  setStatus('');
                  setClientId('');
                }}
              >
                Limpar filtros
              </button>
            ) : view === 'active' && activeClients.length > 0 ? (
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                Cadastrar projeto
              </button>
            ) : null}
          </EmptyState>
        )}
        {query.isSuccess && projects.length > 0 && user && (
          <ProjectList projects={projects} timeZone={user.timezone} />
        )}
      </section>

      <ProjectCreateDialog
        open={createOpen}
        clients={activeClients}
        onClose={() => {
          setCreateOpen(false);
        }}
        onCreated={(name) => {
          setNotice(`${name} foi cadastrado com sucesso.`);
        }}
      />
    </>
  );
}
