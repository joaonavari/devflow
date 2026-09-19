import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import {
  deleteStage,
  listStages,
  moveStage,
  portalKeys,
  stageLabels,
  portalErrorMessage,
  type Stage,
} from '../../portal/portal-api';
import type { Project } from '../../projects/project-api';
import { IconButton } from '../ui/IconButton';
import { StageDialog } from './StageDialog';

export function ProjectStages({ project }: { project: Project }) {
  const { user } = useAuth();
  const client = useQueryClient();
  const key = portalKeys.stages(user?.id ?? '', project.id);
  const query = useQuery({ queryKey: key, queryFn: () => listStages(project.id) });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [editing, setEditing] = useState<Stage | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: key });
  };
  const mutation = useMutation({
    mutationFn: async ({ id, position }: { id: string; position?: number }) => {
      if (position === undefined) await deleteStage(id);
      else await moveStage(id, position);
      await refresh();
      setDeleting(null);
      setNotice(position === undefined ? 'Etapa excluída.' : 'Ordem atualizada.');
    },
  });
  const disabled = Boolean(project.archivedAt) || mutation.isPending;
  return (
    <section className="detail-section portal-stages-admin" aria-labelledby="stages-admin-title">
      <div className="detail-section-heading">
        <div>
          <h2 id="stages-admin-title">Etapas do projeto</h2>
          <p>Organize os marcos e escolha o que aparece na timeline do cliente.</p>
        </div>
        <button
          className="secondary-button"
          type="button"
          disabled={disabled}
          onClick={(event) => {
            triggerRef.current = event.currentTarget;
            setEditing(null);
          }}
        >
          <Plus size={17} aria-hidden="true" /> Adicionar etapa
        </button>
      </div>
      {project.archivedAt && (
        <p className="archive-notice">Restaure o projeto para alterar as etapas.</p>
      )}
      {query.isPending && <p role="status">Carregando etapas…</p>}
      {query.isError && (
        <p role="alert">
          Não foi possível carregar as etapas.{' '}
          <button className="text-action" onClick={() => void query.refetch()}>
            Tentar novamente
          </button>
        </p>
      )}
      {query.data?.length === 0 && (
        <p className="portal-empty">
          Nenhuma etapa criada. Comece pelos principais marcos do projeto.
        </p>
      )}
      <ol className="stage-admin-list">
        {query.data?.map((stage, index, all) => (
          <li key={stage.id} data-stage-row={stage.title}>
            <span className="stage-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div className="stage-admin-copy">
              <h3>{stage.title}</h3>
              <p>
                {stageLabels[stage.status]}{' '}
                <span>· {stage.isClientVisible ? 'Visível para o cliente' : 'Interna'}</span>
              </p>
            </div>
            <div className="stage-controls">
              <IconButton
                label={`Mover ${stage.title} para cima`}
                disabled={disabled || index === 0}
                onClick={() => {
                  mutation.mutate({ id: stage.id, position: index - 1 });
                }}
              >
                <ArrowUp size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                label={`Mover ${stage.title} para baixo`}
                disabled={disabled || index === all.length - 1}
                onClick={() => {
                  mutation.mutate({ id: stage.id, position: index + 1 });
                }}
              >
                <ArrowDown size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                label={`Editar ${stage.title}`}
                disabled={disabled}
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setEditing(stage);
                }}
              >
                <Pencil size={16} aria-hidden="true" />
              </IconButton>
              <IconButton
                label={`Excluir ${stage.title}`}
                disabled={disabled}
                onClick={() => {
                  setDeleting(stage.id);
                }}
              >
                <Trash2 size={16} aria-hidden="true" />
              </IconButton>
            </div>
            {deleting === stage.id && (
              <div
                className="stage-delete-confirm"
                role="group"
                aria-label={`Confirmar exclusão de ${stage.title}`}
              >
                <p>Excluir esta etapa permanentemente?</p>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={mutation.isPending}
                  onClick={() => {
                    setDeleting(null);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="danger-link"
                  disabled={disabled}
                  onClick={() => {
                    mutation.mutate({ id: stage.id });
                  }}
                >
                  Confirmar exclusão
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
      {notice && (
        <p role="status" className="operation-notice">
          {notice}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="form-error">
          {portalErrorMessage(mutation.error)}
        </p>
      )}
      {editing !== undefined && !project.archivedAt && (
        <StageDialog
          projectId={project.id}
          stage={editing}
          onClose={() => {
            setEditing(undefined);
            requestAnimationFrame(() => triggerRef.current?.focus());
          }}
          onSaved={async () => {
            await refresh();
            setNotice('Etapa salva.');
          }}
        />
      )}
    </section>
  );
}
