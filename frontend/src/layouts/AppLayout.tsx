import { X } from 'lucide-react';
import { Suspense, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from '../components/navigation/Sidebar';
import { Topbar } from '../components/navigation/Topbar';
import { IconButton } from '../components/ui/IconButton';
import { navigationItems } from '../routes/navigation';

export function AppLayout() {
  const { pathname } = useLocation();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previousPath = useRef(pathname);
  const [menuOpen, setMenuOpen] = useState(false);
  const normalizedPath = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;
  const currentPage = navigationItems.find(
    (item) => item.path === normalizedPath || normalizedPath.startsWith(`${item.path}/`),
  );
  const pageTitle = currentPage?.label ?? 'Página não encontrada';

  function openMenu() {
    dialogRef.current?.showModal();
    dialogRef.current?.querySelector<HTMLButtonElement>('[data-menu-close]')?.focus();
    setMenuOpen(true);
  }

  function closeMenu() {
    dialogRef.current?.close();
    setMenuOpen(false);
  }

  useEffect(() => {
    document.title = `${pageTitle} · DevFlow`;
    dialogRef.current?.close();

    if (previousPath.current === pathname) return;
    previousPath.current = pathname;

    let observer: MutationObserver | undefined;
    const frame = requestAnimationFrame(() => {
      const focusHeading = () => {
        const heading = mainRef.current?.querySelector<HTMLElement>('h1');
        if (!heading || heading.getClientRects().length === 0) return false;
        heading.focus({ preventScroll: true });
        return true;
      };
      if (!focusHeading() && mainRef.current) {
        mainRef.current.focus({ preventScroll: true });
        observer = new MutationObserver(() => {
          if (focusHeading()) observer?.disconnect();
        });
        observer.observe(mainRef.current, { childList: true, subtree: true });
      }
      window.scrollTo({ top: 0, behavior: 'instant' });
    });

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [pageTitle, pathname]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 64rem)');
    const closeOnDesktop = () => {
      if (desktop.matches) closeMenu();
    };

    desktop.addEventListener('change', closeOnDesktop);
    return () => {
      desktop.removeEventListener('change', closeOnDesktop);
    };
  }, []);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>

      <aside className="desktop-sidebar" aria-label="Barra lateral">
        <Sidebar />
      </aside>

      <div className="app-body">
        <Topbar pageTitle={pageTitle} menuOpen={menuOpen} onOpenMenu={openMenu} />
        <main id="main-content" className="main-content" ref={mainRef} tabIndex={-1}>
          <div className="page-container">
            <Suspense
              fallback={
                <div className="route-loading" role="status">
                  Carregando página…
                </div>
              }
            >
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <dialog
        id="mobile-navigation"
        className="mobile-navigation"
        ref={dialogRef}
        aria-labelledby="mobile-navigation-title"
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClose={() => {
          setMenuOpen(false);
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          const clickedOutside =
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom;

          if (clickedOutside) closeMenu();
        }}
      >
        <h2 id="mobile-navigation-title" className="sr-only">
          Menu de navegação
        </h2>
        <Sidebar
          onNavigate={closeMenu}
          closeButton={
            <IconButton label="Fechar menu de navegação" onClick={closeMenu} data-menu-close>
              <X size={20} strokeWidth={1.7} aria-hidden="true" />
            </IconButton>
          }
        />
      </dialog>
    </div>
  );
}
