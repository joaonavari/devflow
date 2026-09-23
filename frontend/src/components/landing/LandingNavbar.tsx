import { Layers2, Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export function LandingBrand() {
  return (
    <Link to="/" className="brand" aria-label="DevFlow — início">
      <span className="brand-mark" aria-hidden="true">
        <Layers2 size={20} strokeWidth={1.8} />
      </span>
      <span>DevFlow</span>
    </Link>
  );
}

export function LandingNavbar() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 48rem)');
    const closeOnDesktop = () => {
      if (desktop.matches) setOpen(false);
    };
    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, []);

  return (
    <header
      className="landing-header"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="landing-container landing-nav-row">
        <LandingBrand />
        <button
          ref={toggle}
          className="icon-button landing-menu-toggle"
          type="button"
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          aria-controls="landing-navigation"
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
        </button>
        <nav
          id="landing-navigation"
          className="landing-navigation"
          data-open={open}
          aria-label="Navegação pública"
        >
          <div className="landing-nav-links">
            <a
              href="#recursos"
              onClick={() => {
                setOpen(false);
              }}
            >
              Recursos
            </a>
            <a
              href="#como-funciona"
              onClick={() => {
                setOpen(false);
              }}
            >
              Como funciona
            </a>
          </div>
          <div className="landing-nav-actions">
            <Link to="/login" className="landing-login">
              Entrar
            </Link>
            <Link to="/register" className="landing-button landing-button-primary">
              Começar grátis
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
