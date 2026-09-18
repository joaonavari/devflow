import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2, ShieldCheck } from 'lucide-react';
import { useId, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { generatePortal, getPortalState, portalKeys, revokePortal } from '../../portal/portal-api';
import { formatProjectTimestamp } from '../../projects/project-format';
import type { Project } from '../../projects/project-api';

export function ProjectPortal({ project }: { project: Project }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [generated, setGenerated] = useState<{ url: string; updatedAt: string } | null>(null);
  const [notice, setNotice] = useState('');
  const fieldId = useId();
  const key = portalKeys.state(user?.id ?? '', project.id);
  const query = useQuery({
    queryKey: key,
    queryFn: () => getPortalState(project.id),
    refetchOnMount: 'always',
    refetchOnWindowFocus: 'always',
  });
  const mutation = useMutation({
    // Return no credential to TanStack's mutation cache. Keep it only in local page state.
    mutationFn: async (action: 'generate' | 'revoke') => {
      setNotice('');
      setGenerated(null);
      if (action === 'generate') {
        const { url, ...state } = await generatePortal(project.id, days);
        queryClient.setQueryData(key, state);
        if (state.link) setGenerated({ url, updatedAt: state.link.updatedAt });
        setNotice('Link gerado. Copie e compartilhe apenas com seu cliente.');
      } else {
        await revokePortal(project.id);
        await queryClient.invalidateQueries({ queryKey: key });
        setNotice('Link revogado. O acesso foi encerrado.');
      }
    },
  });
  const url =
    query.data?.active && generated?.updatedAt === query.data.link?.updatedAt
      ? generated?.url
      : undefined;
  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Link copiado.');
    } catch {
      setNotice('Não foi possível copiar automaticamente. Selecione e copie o link abaixo.');
    }
  }
  return (
    <section className="detail-section portal-admin" aria-labelledby="portal-admin-title">
      <div className="detail-section-heading">
        <div>
          <h2 id="portal-admin-title">
            <Link2 size={19} aria-hidden="true" /> Portal do cliente
          </h2>
          <p>Compartilhe o acompanhamento do projeto em uma página somente leitura.</p>
        </div>
        {query.data && (
          <span className="portal-state" data-active={query.data.active}>
            {query.data.active ? 'Ativo' : 'Inativo'}
          </span>
        )}
      </div>
      <p className="portal-sharing-note">
        <ShieldCheck size={18} aria-hidden="true" /> O link é uma credencial: qualquer pessoa com
        ele pode ver nome, descrição, status, progresso e datas do projeto, além das tarefas e
        etapas marcadas como visíveis.
      </p>
      {project.archivedAt && (
        <p className="archive-notice">
          Projeto arquivado: acesso ao portal revogado. Após restaurar, gere um novo link.
        </p>
      )}
      {query.isPending && <p role="status">Carregando estado do portal…</p>}
      {query.isError && (
        <p role="alert">
          Não foi possível carregar o portal.{' '}
          <button className="text-action" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {query.data && (
        <>
          {query.data.link && (
            <p className="portal-expiry">
              {query.data.active ? 'Válido até' : 'Validade do último link'}:{' '}
              {formatProjectTimestamp(query.data.link.expiresAt, user?.timezone ?? 'UTC')}
            </p>
          )}
          <div className="portal-admin-actions">
            <div className="form-field">
              <label htmlFor={fieldId}>Validade do novo link</label>
              <select
                id={fieldId}
                value={days}
                disabled={Boolean(project.archivedAt) || mutation.isPending}
                onChange={(e) => {
                  setDays(Number(e.target.value));
                }}
              >
                <option value={7}>7 dias</option>
                <option value={30}>30 dias</option>
                <option value={90}>90 dias</option>
              </select>
            </div>
            <button
              type="button"
              className="primary-button"
              data-portal-action="generate"
              disabled={Boolean(project.archivedAt) || mutation.isPending}
              onClick={() => {
                mutation.mutate('generate');
              }}
            >
              {mutation.isPending
                ? 'Processando…'
                : query.data.link
                  ? 'Gerar novo link'
                  : 'Gerar link'}
            </button>
            {query.data.active && (
              <button
                type="button"
                className="secondary-button"
                disabled={mutation.isPending}
                data-portal-action="revoke"
                onClick={() => {
                  mutation.mutate('revoke');
                }}
              >
                Revogar link
              </button>
            )}
          </div>
          <p className="portal-help">
            Por segurança, este link completo não poderá ser exibido novamente. Gere um novo se
            precisar. Gerar um novo link invalida o anterior imediatamente.
          </p>
        </>
      )}
      {url && (
        <div className="portal-generated">
          <label htmlFor={`${fieldId}-url`}>Link para compartilhar</label>
          <div>
            <input
              id={`${fieldId}-url`}
              data-portal-url
              readOnly
              value={url}
              onFocus={(e) => {
                e.target.select();
              }}
            />
            <button type="button" className="secondary-button" onClick={() => void copy()}>
              <Copy size={16} aria-hidden="true" /> Copiar link
            </button>
          </div>
        </div>
      )}
      {notice && (
        <p className="operation-notice" role="status">
          {notice}
        </p>
      )}
      {mutation.isError && (
        <p className="form-error" role="alert">
          {mutation.error.message}
        </p>
      )}
    </section>
  );
}
