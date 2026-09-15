import { Layers2 } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
}
export function AuthLayout({ title, description, children, footer }: AuthLayoutProps) {
  useEffect(() => {
    document.title = `${title} · DevFlow`;
  }, [title]);
  return (
    <div className="auth-page">
      <header className="auth-brand">
        <Link to="/login" className="brand" aria-label="DevFlow — entrar">
          <span className="brand-mark" aria-hidden="true">
            <Layers2 size={20} strokeWidth={1.8} />
          </span>
          <span>DevFlow</span>
        </Link>
      </header>
      <main className="auth-main">
        <div className="auth-heading">
          <p className="navigation-label">Seu workspace pessoal</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {children}
        <p className="auth-footer">{footer}</p>
      </main>
      <footer className="auth-caption">Mais clareza para o seu trabalho.</footer>
    </div>
  );
}
