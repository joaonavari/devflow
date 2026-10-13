import { ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { isShowcase, REPOSITORY_URL } from '../../site';

interface AccountLinkProps {
  className?: string;
  children: ReactNode;
}

// Sign-up needs the API. The showcase build points visitors to the source code instead.
export function AccountLink({ className, children }: AccountLinkProps) {
  if (isShowcase) {
    return (
      <a href={REPOSITORY_URL} className={className} target="_blank" rel="noopener noreferrer">
        Ver código no GitHub <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    );
  }
  return (
    <Link to="/register" className={className}>
      {children}
    </Link>
  );
}
