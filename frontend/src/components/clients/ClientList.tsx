import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Client } from '../../clients/client-api';
import { clientInitials, formatClientDate } from '../../clients/client-format';

interface ClientListProps {
  clients: Client[];
  timeZone: string;
}

function ClientIdentity({ client }: { client: Client }) {
  return (
    <div className="client-identity">
      <span className="client-avatar" aria-hidden="true">
        {clientInitials(client.name)}
      </span>
      <div>
        <Link to={`/clientes/${client.id}`} data-client-link>
          {client.name}
        </Link>
        <span>{client.email}</span>
      </div>
    </div>
  );
}

export function ClientList({ clients, timeZone }: ClientListProps) {
  return (
    <>
      <div className="clients-table-wrap">
        <table className="clients-table">
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Empresa</th>
              <th scope="col">Telefone</th>
              <th scope="col">Status</th>
              <th scope="col">Atualização</th>
              <th scope="col">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => (
              <tr key={client.id}>
                <td>
                  <ClientIdentity client={client} />
                </td>
                <td>{client.company ?? <span className="muted-value">—</span>}</td>
                <td>{client.phone ?? <span className="muted-value">—</span>}</td>
                <td>
                  <span className={`status-badge ${client.archivedAt ? 'is-archived' : ''}`}>
                    {client.archivedAt ? 'Arquivado' : 'Ativo'}
                  </span>
                </td>
                <td>
                  <time dateTime={client.updatedAt}>
                    {formatClientDate(client.updatedAt, timeZone)}
                  </time>
                </td>
                <td>
                  <Link
                    className="row-action"
                    to={`/clientes/${client.id}`}
                    aria-label={`Ver detalhes de ${client.name}`}
                  >
                    <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="clients-mobile-list">
        {clients.map((client) => (
          <li key={client.id}>
            <Link to={`/clientes/${client.id}`} className="client-mobile-card" data-client-link>
              <div className="client-mobile-heading">
                <span className="client-avatar" aria-hidden="true">
                  {clientInitials(client.name)}
                </span>
                <div>
                  <strong>{client.name}</strong>
                  <span>{client.email}</span>
                </div>
                <ArrowUpRight size={17} strokeWidth={1.7} aria-hidden="true" />
              </div>
              <dl>
                <div>
                  <dt>Empresa</dt>
                  <dd>{client.company ?? '—'}</dd>
                </div>
                <div>
                  <dt>Telefone</dt>
                  <dd>{client.phone ?? '—'}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{client.archivedAt ? 'Arquivado' : 'Ativo'}</dd>
                </div>
                <div>
                  <dt>Atualização</dt>
                  <dd>{formatClientDate(client.updatedAt, timeZone)}</dd>
                </div>
              </dl>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
