import { ArrowUpRight, Layers2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { navigationItems } from '../../routes/navigation';

interface SidebarProps {
  onNavigate?: () => void;
  closeButton?: ReactNode;
}

export function Sidebar({ onNavigate, closeButton }: SidebarProps) {
  return (
    <div className="sidebar-content">
      <div className="sidebar-brand-row">
        <Link
          to="/dashboard"
          className="brand"
          aria-label="DevFlow — ir para o dashboard"
          onClick={onNavigate}
        >
          <span className="brand-mark" aria-hidden="true">
            <Layers2 size={20} strokeWidth={1.8} />
          </span>
          <span>DevFlow</span>
        </Link>
        {closeButton}
      </div>

      <nav className="sidebar-navigation" aria-label="Navegação principal">
        <div>
          <p className="navigation-label">Workspace</p>
          <NavigationGroup group="workspace" onNavigate={onNavigate} />
        </div>
        <NavigationGroup group="settings" onNavigate={onNavigate} className="navigation-settings" />
      </nav>

      <div className="sidebar-footer">
        <span className="workspace-symbol" aria-hidden="true">
          W
        </span>
        <div>
          <p>Workspace pessoal</p>
          <span>Seu espaço de trabalho</span>
        </div>
        <ArrowUpRight className="workspace-arrow" size={15} aria-hidden="true" />
      </div>
    </div>
  );
}

interface NavigationGroupProps {
  group: 'workspace' | 'settings';
  onNavigate?: (() => void) | undefined;
  className?: string;
}

function NavigationGroup({ group, onNavigate, className = '' }: NavigationGroupProps) {
  return (
    <ul className={`navigation-list ${className}`.trim()}>
      {navigationItems
        .filter((item) => item.group === group)
        .map((item) => (
          <li key={item.path}>
            <NavLink
              to={item.path}
              end
              className={({ isActive }) => `navigation-link${isActive ? ' is-active' : ''}`}
              onClick={onNavigate}
            >
              <item.icon size={19} strokeWidth={1.7} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
    </ul>
  );
}
