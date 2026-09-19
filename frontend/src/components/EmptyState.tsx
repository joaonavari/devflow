import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children?: ReactNode;
  headingLevel?: 1 | 2;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  children,
  headingLevel = 2,
}: EmptyStateProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        <Icon size={25} strokeWidth={1.5} />
      </div>
      <Heading tabIndex={headingLevel === 1 ? -1 : undefined}>{title}</Heading>
      <p>{description}</p>
      {children}
    </div>
  );
}
