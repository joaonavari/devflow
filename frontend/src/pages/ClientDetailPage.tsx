import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowLeft, RotateCcw, Trash2, UserRoundX } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import {
  changeClientArchive,
  ClientApiError,
  clientKeys,
  deleteClient,
  getClient,
  type Client,
} from '../clients/client-api';
import { clientInitials, formatClientDate } from '../clients/client-format';
import { ClientEditForm } from '../components/clients/ClientEditForm';
import { DeleteClientDialog } from '../components/clients/DeleteClientDialog';
import { EmptyState } from '../components/EmptyState';

export function ClientDetailPage() {
  const { clientId = '' } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notice, setNotice] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const userId = user?.id ?? '';
  const query = useQuery({
    queryKey: clientKeys.detail(userId, clientId),
    queryFn: () => getClient(clientId),
    enabled: Boolean(userId && clientId),
    retry: false,
  });
  const archiveMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'archive' | 'restore' }) =>
      changeClientArchive(id, action),
  });
  const deleteMutation = useMutation({ mutationFn: deleteClient });

  async function changeArchive(client: Client) {
    setNotice(null);
    const action = client.archivedAt ? 'restore' : 'archive';
    try {
      const updated = await archiveMutation.mutateAsync({ id: client.id, action });
      queryClient.setQueryData(clientKeys.detail(userId, client.id), updated);
      await queryClient.invalidateQueries({ queryKey: clientKeys.all(userId) });
      setNotice(
        action === 'archive' ? 'Cliente arquivado com sucesso.' : 'Cliente restaurado com sucesso.',
      );
    } catch {
      setNotice(
        action === 'archive'
          ? 'Não foi possível arquivar o cliente.'
          : 'Não foi possível restaurar o cliente.',
      );
    }
  }

  async function remove(client: Client) {
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(client.id);
      await queryClient.invalidateQueries({ queryKey: clientKeys.all(userId) });
      queryClient.removeQueries({ queryKey: clientKeys.detail(userId, client.id) });
      await navigate('/clientes', {
        replace: true,
        state: { notice: `${client.name} foi excluído permanentemente.` },
      });
    } catch (error) {
      setDeleteError(
        error instanceof ClientApiError
          ? error.message
          : 'Não foi possível excluir o cliente. Tente novamente.',
      );
    }
  }

  if (query.isPending)
    return (
      <div className="detail-loading" role="status">
        Carregando cliente…
      </div>
    );
  if (
    query.isError &&
    query.error instanceof ClientApiError &&
    [400, 404].includes(query.error.status)
  ) {
    return (
      <section className="client-not-found">
        <EmptyState
          icon={UserRoundX}
          title="Cliente não encontrado"
          description="O cliente não existe ou não está disponível para sua conta."
        >
          <Link className="text-link" to="/clientes">
            Voltar para clientes
          </Link>
        </EmptyState>
      </section>
    );
  }
  if (query.isError) {
    return (
      <section className="client-not-found">
        <EmptyState
          icon={UserRoundX}
          title="Não foi possível carregar o cliente"
          description="Confira sua conexão e tente novamente."
        >
          <button className="text-action" type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </EmptyState>
      </section>
    );
  }

  const client = query.data;
  return (
    <>
      <Link className="back-link" to="/clientes">
        <ArrowLeft size={17} strokeWidth={1.7} aria-hidden="true" />
        Voltar para clientes
      </Link>
      <header className="client-detail-header">
        <div className="client-detail-identity">
          <span className="client-avatar is-large" aria-hidden="true">
            {clientInitials(client.name)}
          </span>
          <div>
            <div className="client-title-line">
              <h1 tabIndex={-1}>{client.name}</h1>
              <span className={`status-badge ${client.archivedAt ? 'is-archived' : ''}`}>
                {client.archivedAt ? 'Arquivado' : 'Ativo'}
              </span>
            </div>
            <p>{client.email}</p>
          </div>
        </div>
        <button
          className="secondary-button"
          type="button"
          data-client-action={client.archivedAt ? 'restore' : 'archive'}
          disabled={archiveMutation.isPending}
          onClick={() => void changeArchive(client)}
        >
          {client.archivedAt ? (
            <RotateCcw size={17} strokeWidth={1.7} aria-hidden="true" />
          ) : (
            <Archive size={17} strokeWidth={1.7} aria-hidden="true" />
          )}
          {archiveMutation.isPending
            ? 'Processando…'
            : client.archivedAt
              ? 'Restaurar cliente'
              : 'Arquivar cliente'}
        </button>
      </header>

      {client.archivedAt && (
        <p className="archive-notice">
          Este cliente está arquivado desde{' '}
          <time dateTime={client.archivedAt}>
            {formatClientDate(client.archivedAt, user?.timezone ?? 'UTC')}
          </time>
          .
        </p>
      )}
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}

      <div className="client-detail-grid">
        <section className="detail-section" aria-labelledby="client-data-title">
          <div className="detail-section-heading">
            <div>
              <h2 id="client-data-title">Dados do cliente</h2>
              <p>Informações de contato e empresa.</p>
            </div>
            <span>Atualizado em {formatClientDate(client.updatedAt, user?.timezone ?? 'UTC')}</span>
          </div>
          <ClientEditForm
            client={client}
            onSaved={(updated) => {
              setNotice(`${updated.name} foi atualizado com sucesso.`);
            }}
          />
        </section>

        <aside className="danger-section" aria-labelledby="danger-zone-title">
          <h2 id="danger-zone-title">Exclusão permanente</h2>
          <p>Remova este cliente e todos os seus dados definitivamente.</p>
          <button
            className="danger-link"
            type="button"
            data-client-action="delete"
            onClick={() => {
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 size={17} strokeWidth={1.7} aria-hidden="true" />
            Excluir cliente
          </button>
        </aside>
      </div>

      <DeleteClientDialog
        open={deleteOpen}
        clientName={client.name}
        pending={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          setDeleteOpen(false);
        }}
        onConfirm={() => void remove(client)}
      />
    </>
  );
}
