import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LandingBrand, LandingNavbar } from '../components/landing/LandingNavbar';
import {
  ClientPortalSection,
  ConnectedSection,
  ExecutionSection,
  FeaturesSection,
  FinanceSection,
  FinalCta,
  HeroSection,
  WorkflowSection,
} from '../components/landing/LandingSections';
import '../styles/landing.css';

export function LandingPage() {
  useEffect(() => {
    document.title = 'DevFlow — Gestão de projetos para freelancers';
    const robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = robots?.content;
    if (robots) robots.content = 'index, follow';
    return () => {
      if (robots && previous !== undefined) robots.content = previous;
    };
  }, []);

  return (
    <div className="landing-page">
      <a className="skip-link" href="#landing-content">
        Pular para o conteúdo
      </a>
      <LandingNavbar />
      <main id="landing-content" tabIndex={-1}>
        <HeroSection />
        <FeaturesSection />
        <WorkflowSection />
        <ExecutionSection />
        <FinanceSection />
        <ClientPortalSection />
        <ConnectedSection />
        <FinalCta />
      </main>
      <footer className="landing-footer">
        <div className="landing-container landing-footer-row">
          <LandingBrand />
          <p>© 2026 DevFlow</p>
          <nav aria-label="Links do rodapé">
            <Link to="/login">Entrar</Link>
            <Link to="/register">Criar conta</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
