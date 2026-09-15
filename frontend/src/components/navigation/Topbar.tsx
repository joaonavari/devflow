import { ChevronRight, Menu } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { IconButton } from '../ui/IconButton';

interface TopbarProps {
  pageTitle: string;
  menuOpen: boolean;
  onOpenMenu: () => void;
}

export function Topbar({ pageTitle, menuOpen, onOpenMenu }: TopbarProps) {
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
        <Badge>Prévia</Badge>
      </div>
    </header>
  );
}
