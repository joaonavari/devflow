import { useQuery } from '@tanstack/react-query';
import { Plus, Search, UsersRound } from 'lucide-react';
import { useDeferredValue, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { clientKeys, listClients, type ClientStatus } from '../clients/client-api';
import { ClientCreateDialog } from '../components/clients/ClientCreateDialog';
import { ClientList } from '../components/clients/ClientList';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export function ClientsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ClientStatus>('active');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
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
  const deferredSearch = useDeferredValue(search.trim());
  const userId = user?.id ?? '';
  const query = useQuery({
    queryKey: clientKeys.list(userId, status, deferredSearch),
    queryFn: () => listClients(status, deferredSearch),
    enabled: Boolean(userId),
  });
  const clients = query.data?.data ?? [];
  const hasFilter = deferredSearch.length > 0;

  useEffect(() => {
    if (initialNotice) void navigate(location.pathname, { replace: true, state: null });
  }, [initialNotice, location.pathname, navigate]);

  return (
    <>
      <div className="clients-heading-row">
        <PageHeader
          title="Clientes"
          description="Contatos e relações de trabalho em um só lugar."
        />
        <button
          className="primary-button"
          type="button"
          data-client-action="new"
          onClick={() => {
            setNotice(null);
            setCreateOpen(true);
          }}
        >
          <Plus size={18} strokeWidth={1.8} aria-hidden="true" />
          Novo cliente
        </button>
      </div>

      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}

      <section className="clients-panel" aria-labelledby="clients-list-title">
        <div className="clients-toolbar">
          <div>
            <h2 id="clients-list-title">Lista de clientes</h2>
            <p>
              {query.data
                ? `${String(query.data.meta.count)} ${query.data.meta.count === 1 ? 'cliente' : 'clientes'}`
                : 'Carregando registros'}
            </p>
          </div>
          <div className="status-switch" aria-label="Situação dos clientes">
            <button
              type="button"
              data-client-status="active"
              aria-pressed={status === 'active'}
              onClick={() => {
                setStatus('active');
              }}
            >
              Ativos
            </button>
            <button
              type="button"
              data-client-status="archived"
              aria-pressed={status === 'archived'}
              onClick={() => {
                setStatus('archived');
              }}
            >
              Arquivados
            </button>
          </div>
        </div>

        <div className="clients-search">
          <Search size={18} strokeWidth={1.7} aria-hidden="true" />
          <label className="sr-only" htmlFor="client-search">
            Pesquisar clientes
          </label>
          <input
            id="client-search"
            type="search"
            value={search}
            maxLength={100}
            placeholder="Buscar por nome, email ou empresa"
            onChange={(event) => {
              setSearch(event.target.value);
            }}
          />
        </div>

        {query.isPending && (
          <div className="clients-loading" role="status">
            <span>Carregando clientes…</span>
          </div>
        )}
        {query.isError && (
          <div className="clients-message" role="alert">
            <h3>Não foi possível carregar os clientes</h3>
            <p>Confira sua conexão e tente novamente.</p>
            <button className="secondary-button" type="button" onClick={() => void query.refetch()}>
              Tentar novamente
            </button>
          </div>
        )}
        {query.isSuccess && clients.length === 0 && (
          <EmptyState
            icon={hasFilter ? Search : UsersRound}
            title={
              hasFilter
                ? 'Nenhum cliente encontrado'
                : status === 'active'
                  ? 'Cadastre seu primeiro cliente'
                  : 'Nenhum cliente arquivado'
            }
            description={
              hasFilter
                ? 'Tente outro nome, email ou empresa.'
                : status === 'active'
                  ? 'Mantenha os contatos essenciais do seu trabalho organizados.'
                  : 'Os clientes arquivados aparecerão aqui.'
            }
          >
            {hasFilter ? (
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setSearch('');
                }}
              >
                Limpar busca
              </button>
            ) : status === 'active' ? (
              <button
                className="text-action"
                type="button"
                onClick={() => {
                  setCreateOpen(true);
                }}
              >
                Cadastrar cliente
              </button>
            ) : null}
          </EmptyState>
        )}
        {query.isSuccess && clients.length > 0 && user && (
          <ClientList clients={clients} timeZone={user.timezone} />
        )}
      </section>

      <ClientCreateDialog
        open={createOpen}
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
