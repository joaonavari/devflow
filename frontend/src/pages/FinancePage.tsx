import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CircleDollarSign,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  WalletCards,
} from 'lucide-react';
import { useDeferredValue, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { DeletePaymentDialog } from '../components/payments/DeletePaymentDialog';
import { PaymentDialog } from '../components/payments/PaymentDialog';
import {
  changePaymentStatus,
  deletePayment,
  listPayments,
  PaymentApiError,
  paymentKeys,
  type Payment,
  type PaymentFilters,
  type PaymentView,
} from '../payments/payment-api';
import { formatMoney, formatPaymentDate } from '../payments/payment-format';
import { listProjects, projectKeys } from '../projects/project-api';

const emptyFilters: PaymentFilters = {
  search: '',
  projectId: '',
  clientId: '',
  view: 'all',
  from: '',
  to: '',
};
const activeProjectFilters = {
  view: 'active' as const,
  search: '',
  status: '' as const,
  clientId: '',
};

export function FinancePage() {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState('');
  const [projectId, setProjectId] = useState(searchParams.get('projectId') ?? '');
  const [clientId, setClientId] = useState('');
  const [view, setView] = useState<PaymentView>('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search.trim());
  const filters: PaymentFilters = { search: deferredSearch, projectId, clientId, view, from, to };
  const query = useQuery({
    queryKey: paymentKeys.global(userId, filters),
    queryFn: () => listPayments(filters),
    enabled: Boolean(userId),
  });
  const allQuery = useQuery({
    queryKey: paymentKeys.global(userId, emptyFilters),
    queryFn: () => listPayments(emptyFilters),
    enabled: Boolean(userId),
  });
  const projectsQuery = useQuery({
    queryKey: projectKeys.list(userId, activeProjectFilters),
    queryFn: () => listProjects(activeProjectFilters),
    enabled: Boolean(userId),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pay' | 'reopen' }) =>
      changePaymentStatus(id, action),
  });
  const deleteMutation = useMutation({ mutationFn: deletePayment });
  const payments = useMemo(() => query.data?.data ?? [], [query.data]);
  const activeProjects = useMemo(() => projectsQuery.data?.data ?? [], [projectsQuery.data]);
  const filterProjects = useMemo(() => {
    const values = new Map<string, { id: string; name: string; archived: boolean }>();
    for (const project of activeProjects)
      values.set(project.id, { id: project.id, name: project.name, archived: false });
    for (const payment of allQuery.data?.data ?? [])
      values.set(payment.project.id, {
        id: payment.project.id,
        name: payment.project.name,
        archived: Boolean(payment.project.archivedAt),
      });
    return [...values.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }, [activeProjects, allQuery.data]);
  const clients = useMemo(() => {
    const values = new Map<string, { id: string; name: string }>();
    for (const payment of allQuery.data?.data ?? [])
      values.set(payment.project.client.id, payment.project.client);
    return [...values.values()].sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'));
  }, [allQuery.data]);
  const hasFilters = Boolean(
    deferredSearch || projectId || clientId || view !== 'all' || from || to,
  );

  async function changeStatus(payment: Payment) {
    setNotice(null);
    const action = payment.status === 'PAID' ? 'reopen' : 'pay';
    try {
      await statusMutation.mutateAsync({ id: payment.id, action });
      await queryClient.invalidateQueries({ queryKey: paymentKeys.all(userId) });
      setNotice(action === 'pay' ? 'Pagamento marcado como pago.' : 'Pagamento reaberto.');
    } catch (error) {
      setNotice(
        error instanceof PaymentApiError ? error.message : 'Não foi possível alterar o pagamento.',
      );
    }
  }

  async function remove() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await deleteMutation.mutateAsync(deleting.id);
      setDeleting(null);
      await queryClient.invalidateQueries({ queryKey: paymentKeys.all(userId) });
      setNotice('Cobrança excluída.');
    } catch (error) {
      setDeleteError(
        error instanceof PaymentApiError ? error.message : 'Não foi possível excluir a cobrança.',
      );
    }
  }

  function clearFilters() {
    setSearch('');
    setProjectId('');
    setClientId('');
    setView('all');
    setFrom('');
    setTo('');
  }

  const totals = query.data?.meta;
  return (
    <>
      <div className="finance-heading-row">
        <PageHeader
          title="Financeiro"
          description="Acompanhe cobranças e recebimentos dos projetos."
        />
        <button
          className="primary-button"
          type="button"
          data-payment-action="new"
          disabled={activeProjects.length === 0}
          onClick={() => {
            setCreating(true);
          }}
        >
          <Plus size={17} aria-hidden="true" /> Nova cobrança
        </button>
      </div>
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      {projectsQuery.isSuccess && activeProjects.length === 0 && (
        <p className="project-prerequisite">
          Crie ou restaure um projeto para registrar cobranças.{' '}
          <Link to="/projetos">Abrir projetos</Link>
        </p>
      )}

      <section className="finance-summary" aria-label="Resumo financeiro">
        {[
          ['Total previsto', totals?.totalExpected, 'expected'],
          ['Pago', totals?.totalPaid, 'paid'],
          ['Pendente', totals?.totalPending, 'pending'],
          ['Vencido', totals?.totalOverdue, 'overdue'],
        ].map(([label, value, key]) => (
          <div key={key} data-finance-total={key}>
            <span>{label}</span>
            <strong>{value ? formatMoney(value) : '—'}</strong>
            <small>{hasFilters ? 'Nos filtros atuais' : 'Todas as cobranças'}</small>
          </div>
        ))}
      </section>

      <section className="finance-panel" aria-labelledby="finance-list-title">
        <div className="finance-toolbar">
          <div>
            <h2 id="finance-list-title">Cobranças</h2>
            <p>Ordenadas pelo vencimento mais próximo.</p>
          </div>
        </div>
        <div className="finance-filters">
          <div className="finance-search">
            <Search size={18} aria-hidden="true" />
            <label className="sr-only" htmlFor="finance-search">
              Pesquisar cobranças
            </label>
            <input
              id="finance-search"
              type="search"
              value={search}
              maxLength={100}
              placeholder="Buscar pela descrição"
              onChange={(event) => {
                setSearch(event.target.value);
              }}
            />
          </div>
          <label>
            <span>Status</span>
            <select
              data-payment-filter="status"
              value={view}
              onChange={(event) => {
                setView(event.target.value as PaymentView);
              }}
            >
              <option value="all">Todos</option>
              <option value="PENDING">Pendentes</option>
              <option value="PAID">Pagos</option>
              <option value="OVERDUE">Vencidos</option>
            </select>
          </label>
          <label>
            <span>Projeto</span>
            <select
              data-payment-filter="project"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
              }}
            >
              <option value="">Todos os projetos</option>
              {filterProjects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.archived ? ' — arquivado' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Cliente</span>
            <select
              data-payment-filter="client"
              value={clientId}
              onChange={(event) => {
                setClientId(event.target.value);
              }}
            >
              <option value="">Todos os clientes</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>De</span>
            <input
              data-payment-filter="from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(event) => {
                setFrom(event.target.value);
              }}
            />
          </label>
          <label>
            <span>Até</span>
            <input
              data-payment-filter="to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(event) => {
                setTo(event.target.value);
              }}
            />
          </label>
        </div>

        {query.isPending && (
          <div className="finance-message" role="status">
            Carregando cobranças…
          </div>
        )}
        {query.isError && (
          <div className="finance-message" role="alert">
            <h3>Não foi possível carregar o financeiro</h3>
            <button className="secondary-button" type="button" onClick={() => void query.refetch()}>
              Tentar novamente
            </button>
          </div>
        )}
        {query.isSuccess && payments.length === 0 && (
          <EmptyState
            icon={hasFilters ? Search : WalletCards}
            title={hasFilters ? 'Nenhuma cobrança encontrada' : 'Nenhuma cobrança registrada'}
            description={
              hasFilters
                ? 'Ajuste os filtros selecionados.'
                : 'Registre o primeiro valor previsto de um projeto.'
            }
          >
            {hasFilters && (
              <button className="text-action" type="button" onClick={clearFilters}>
                Limpar filtros
              </button>
            )}
          </EmptyState>
        )}
        {query.isSuccess && payments.length > 0 && (
          <>
            <div className="finance-table-wrap">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>Descrição</th>
                    <th>Projeto</th>
                    <th>Cliente</th>
                    <th>Valor</th>
                    <th>Vencimento</th>
                    <th>Status</th>
                    <th>
                      <span className="sr-only">Ações</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} data-payment-id={payment.id}>
                      <td>{payment.description}</td>
                      <td>
                        <Link to={`/projetos/${payment.projectId}`}>{payment.project.name}</Link>
                        {payment.project.archivedAt && <small>Arquivado</small>}
                      </td>
                      <td>{payment.project.client.name}</td>
                      <td>
                        <strong>{formatMoney(payment.amount)}</strong>
                      </td>
                      <td>{formatPaymentDate(payment.dueDate)}</td>
                      <td>
                        <span
                          className="payment-status"
                          data-status={payment.isOverdue ? 'OVERDUE' : payment.status}
                        >
                          {payment.isOverdue
                            ? 'Vencido'
                            : payment.status === 'PAID'
                              ? 'Pago'
                              : 'Pendente'}
                        </span>
                      </td>
                      <td>
                        <div className="payment-row-actions">
                          <button
                            type="button"
                            disabled={
                              Boolean(payment.project.archivedAt) || statusMutation.isPending
                            }
                            aria-label={
                              payment.status === 'PAID'
                                ? `Reabrir ${payment.description}`
                                : `Marcar ${payment.description} como pago`
                            }
                            onClick={() => void changeStatus(payment)}
                          >
                            {payment.status === 'PAID' ? (
                              <RotateCcw size={16} />
                            ) : (
                              <CircleDollarSign size={16} />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(payment.project.archivedAt)}
                            aria-label={`Editar ${payment.description}`}
                            onClick={() => {
                              setEditing(payment);
                            }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            disabled={Boolean(payment.project.archivedAt)}
                            aria-label={`Excluir ${payment.description}`}
                            onClick={() => {
                              setDeleteError(null);
                              setDeleting(payment);
                            }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="finance-mobile-list">
              {payments.map((payment) => (
                <li key={payment.id} data-payment-id={payment.id}>
                  <div className="finance-mobile-heading">
                    <strong>{payment.description}</strong>
                    <b>{formatMoney(payment.amount)}</b>
                  </div>
                  <div className="finance-mobile-meta">
                    <Link to={`/projetos/${payment.projectId}`}>{payment.project.name}</Link>
                    <span>{payment.project.client.name}</span>
                    <time dateTime={payment.dueDate}>
                      Vence {formatPaymentDate(payment.dueDate)}
                    </time>
                    <span
                      className="payment-status"
                      data-status={payment.isOverdue ? 'OVERDUE' : payment.status}
                    >
                      {payment.isOverdue
                        ? 'Vencido'
                        : payment.status === 'PAID'
                          ? 'Pago'
                          : 'Pendente'}
                    </span>
                  </div>
                  {!payment.project.archivedAt && (
                    <div className="payment-row-actions">
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
                        onClick={() => void changeStatus(payment)}
                      >
                        {payment.status === 'PAID' ? (
                          <RotateCcw size={15} />
                        ) : (
                          <CircleDollarSign size={15} />
                        )}
                        {payment.status === 'PAID' ? 'Reabrir' : 'Marcar pago'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(payment);
                        }}
                      >
                        <Pencil size={15} /> Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleting(payment);
                        }}
                      >
                        <Trash2 size={15} /> Excluir
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {(creating || editing) && (
        <PaymentDialog
          key={editing?.id ?? 'new-payment'}
          projects={activeProjects}
          payment={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={setNotice}
        />
      )}
      <DeletePaymentDialog
        payment={deleting}
        pending={deleteMutation.isPending}
        error={deleteError}
        onClose={() => {
          if (!deleteMutation.isPending) setDeleting(null);
        }}
        onConfirm={() => void remove()}
      />
    </>
  );
}
