import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleDollarSign, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context';
import {
  changePaymentStatus,
  deletePayment,
  listProjectPayments,
  PaymentApiError,
  paymentKeys,
  type Payment,
} from '../../payments/payment-api';
import { formatMoney, formatPaymentDate } from '../../payments/payment-format';
import type { Project } from '../../projects/project-api';
import { DeletePaymentDialog } from './DeletePaymentDialog';
import { PaymentDialog } from './PaymentDialog';

export function ProjectPayments({ project }: { project: Project }) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Payment | null>(null);
  const [deleting, setDeleting] = useState<Payment | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const query = useQuery({
    queryKey: paymentKeys.project(userId, project.id),
    queryFn: () => listProjectPayments(project.id),
    enabled: Boolean(userId),
  });
  const statusMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'pay' | 'reopen' }) =>
      changePaymentStatus(id, action),
  });
  const deleteMutation = useMutation({ mutationFn: deletePayment });
  const archived = Boolean(project.archivedAt);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: paymentKeys.all(userId) });
  }
  async function changeStatus(payment: Payment) {
    try {
      const action = payment.status === 'PAID' ? 'reopen' : 'pay';
      await statusMutation.mutateAsync({ id: payment.id, action });
      await refresh();
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
      await refresh();
      setNotice('Cobrança excluída.');
    } catch (error) {
      setDeleteError(
        error instanceof PaymentApiError ? error.message : 'Não foi possível excluir a cobrança.',
      );
    }
  }

  const payments = query.data?.data.slice(0, 5) ?? [];
  return (
    <section className="project-finance-section" aria-labelledby="project-finance-title">
      <div className="project-finance-heading">
        <div>
          <p className="navigation-label">Financeiro</p>
          <h2 id="project-finance-title">Cobranças do projeto</h2>
          <p>Valores previstos, recebidos e vencidos.</p>
        </div>
        {!archived && (
          <button
            className="primary-button"
            type="button"
            data-payment-action="new-project-payment"
            onClick={() => {
              setCreating(true);
            }}
          >
            <Plus size={17} aria-hidden="true" /> Nova cobrança
          </button>
        )}
      </div>
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      {archived && (
        <p className="finance-read-only">Restaure o projeto para alterar suas cobranças.</p>
      )}
      {query.isPending && (
        <div className="finance-message" role="status">
          Carregando financeiro…
        </div>
      )}
      {query.isError && (
        <div className="finance-message" role="alert">
          <span>Não foi possível carregar as cobranças.</span>
          <button type="button" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </div>
      )}
      {query.isSuccess && (
        <>
          <div className="project-finance-summary">
            <div>
              <span>Previsto</span>
              <strong data-project-payment-total="expected">
                {formatMoney(query.data.meta.totalExpected)}
              </strong>
            </div>
            <div>
              <span>Pago</span>
              <strong data-project-payment-total="paid">
                {formatMoney(query.data.meta.totalPaid)}
              </strong>
            </div>
            <div>
              <span>Pendente</span>
              <strong data-project-payment-total="pending">
                {formatMoney(query.data.meta.totalPending)}
              </strong>
            </div>
            <div>
              <span>Vencido</span>
              <strong data-project-payment-total="overdue">
                {formatMoney(query.data.meta.totalOverdue)}
              </strong>
            </div>
          </div>
          {payments.length === 0 ? (
            <div className="finance-message">
              <strong>Nenhuma cobrança registrada</strong>
              <span>Adicione o primeiro valor previsto deste projeto.</span>
            </div>
          ) : (
            <ul className="project-payment-list">
              {payments.map((payment) => (
                <li key={payment.id} data-payment-id={payment.id}>
                  <div>
                    <strong>{payment.description}</strong>
                    <time dateTime={payment.dueDate}>
                      Vence {formatPaymentDate(payment.dueDate)}
                    </time>
                  </div>
                  <b>{formatMoney(payment.amount)}</b>
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
                  {!archived && (
                    <div className="payment-row-actions">
                      <button
                        type="button"
                        disabled={statusMutation.isPending}
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
                        aria-label={`Editar ${payment.description}`}
                        onClick={() => {
                          setEditing(payment);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir ${payment.description}`}
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(payment);
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {query.data.meta.count > 5 && (
            <Link className="project-finance-all" to={`/financeiro?projectId=${project.id}`}>
              Ver todas as cobranças
            </Link>
          )}
        </>
      )}
      {(creating || editing) && (
        <PaymentDialog
          key={editing?.id ?? 'new-project-payment'}
          projects={[]}
          fixedProject={{ id: project.id, name: project.name }}
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
    </section>
  );
}
