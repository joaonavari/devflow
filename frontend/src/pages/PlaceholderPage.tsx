import type { LucideIcon } from 'lucide-react';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';

interface PlaceholderPageProps {
  title: string;
  description: string;
  placeholder: string;
  icon: LucideIcon;
}

export function PlaceholderPage({ title, description, placeholder, icon }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <section className="content-placeholder" aria-label={`${title}: conteúdo em preparação`}>
        <div className="placeholder-heading">
          <span>Visão geral</span>
          <span className="placeholder-status">Em preparação</span>
        </div>
        <EmptyState icon={icon} title="Este espaço está em preparação" description={placeholder}>
          <span className="empty-state-note">
            Por enquanto, explore as áreas pelo menu de navegação.
          </span>
        </EmptyState>
      </section>
      <p className="page-note">Uma área para cada parte do seu trabalho.</p>
    </>
  );
}
