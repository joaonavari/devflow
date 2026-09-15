import { ArrowLeft, FileQuestion } from 'lucide-react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

export function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Página não encontrada"
        description="Este endereço não corresponde a uma área do DevFlow."
      />
      <section className="content-placeholder" aria-label="Endereço não encontrado">
        <EmptyState
          icon={FileQuestion}
          title="Não encontramos esta página"
          description="Confira o endereço ou retorne ao dashboard para continuar."
        >
          <Link className="text-link" to="/dashboard">
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar ao dashboard
          </Link>
        </EmptyState>
      </section>
    </>
  );
}
