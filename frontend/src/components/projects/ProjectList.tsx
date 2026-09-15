import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Project } from '../../projects/project-api';
import {
  formatBudget,
  formatProjectDate,
  formatProjectTimestamp,
  projectStatusLabels,
} from '../../projects/project-format';

interface ProjectListProps {
  projects: Project[];
  timeZone: string;
}

function Progress({ value }: { value: number }) {
  return (
    <div className="project-progress" aria-label={`${String(value)}% concluído`}>
      <span className="project-progress-track" aria-hidden="true">
        <span style={{ width: `${String(value)}%` }} />
      </span>
      <span>{value}%</span>
    </div>
  );
}

export function ProjectList({ projects, timeZone }: ProjectListProps) {
  return (
    <>
      <div className="projects-table-wrap">
        <table className="projects-table">
          <thead>
            <tr>
              <th scope="col">Projeto</th>
              <th scope="col">Cliente</th>
              <th scope="col">Status</th>
              <th scope="col">Progresso</th>
              <th scope="col">Prazo</th>
              <th scope="col">Orçamento</th>
              <th scope="col">Atualização</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id}>
                <td>
                  <Link
                    className="project-name-link"
                    to={`/projetos/${project.id}`}
                    data-project-link
                  >
                    {project.name}
                  </Link>
                </td>
                <td>
                  <span className="project-client-name">{project.client.name}</span>
                  {project.client.archivedAt && (
                    <span className="client-archived-label">Arquivado</span>
                  )}
                </td>
                <td>
                  <span className="project-status" data-status={project.status}>
                    {projectStatusLabels[project.status]}
                  </span>
                </td>
                <td>
                  <Progress value={project.progress} />
                </td>
                <td>
                  {project.dueDate ? (
                    <time dateTime={project.dueDate}>{formatProjectDate(project.dueDate)}</time>
                  ) : (
                    <span className="muted-value">Sem prazo</span>
                  )}
                </td>
                <td>{formatBudget(project.budget)}</td>
                <td>
                  <time dateTime={project.updatedAt}>
                    {formatProjectTimestamp(project.updatedAt, timeZone)}
                  </time>
                </td>
                <td>
                  <Link
                    className="row-action"
                    to={`/projetos/${project.id}`}
                    aria-label={`Ver detalhes de ${project.name}`}
                  >
                    <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="projects-mobile-list">
        {projects.map((project) => (
          <li key={project.id}>
            <Link to={`/projetos/${project.id}`} className="project-mobile-card" data-project-link>
              <div className="project-mobile-heading">
                <div>
                  <strong>{project.name}</strong>
                  <span>{project.client.name}</span>
                </div>
                <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <div className="project-mobile-status-line">
                <span className="project-status" data-status={project.status}>
                  {projectStatusLabels[project.status]}
                </span>
                {project.archivedAt && (
                  <span className="client-archived-label">Projeto arquivado</span>
                )}
              </div>
              <Progress value={project.progress} />
              <dl>
                <div>
                  <dt>Prazo</dt>
                  <dd>{project.dueDate ? formatProjectDate(project.dueDate) : 'Sem prazo'}</dd>
                </div>
                <div>
                  <dt>Orçamento</dt>
                  <dd>{formatBudget(project.budget)}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
