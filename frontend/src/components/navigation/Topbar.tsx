import { ChevronRight, LogOut, Menu } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/auth-context';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';

interface TopbarProps {
  pageTitle: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
}

export function Topbar({ pageTitle, menuOpen, onOpenMenu }: TopbarProps) {
  const { signOut } = useAuth();
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function logout() {
    setLeaving(true);
    setError(null);
    try {
      await signOut();
    } catch {
      setError('Não foi possível sair. Tente novamente.');
    } finally {
      setLeaving(false);
    }
  }
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="topbar-leading">
          <IconButton
            className="mobile-menu-trigger"
            label="Abrir menu de navegação"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-haspopup="dialog"
            onClick={onOpenMenu}
          >
            <Menu size={20} strokeWidth={1.7} aria-hidden="true" />
          </IconButton>
          <nav className="breadcrumb" aria-label="Localização atual">
            <ol>
              <li className="breadcrumb-parent">
                <span>Workspace</span>
                <ChevronRight size={14} aria-hidden="true" />
              </li>
              <li aria-current="page">{pageTitle}</li>
            </ol>
          </nav>
        </div>
        <div className="topbar-actions">
          <Badge>Prévia</Badge>
          <IconButton
            label={leaving ? 'Saindo…' : 'Sair da conta'}
            disabled={leaving}
            onClick={() => {
              void logout();
            }}
          >
            <LogOut size={18} strokeWidth={1.7} aria-hidden="true" />
          </IconButton>
        </div>
      </div>
      {error && (
        <p className="logout-error" role="alert">
          {error}
        </p>
      )}
    </header>
  );
}
