import {
  CircleDollarSign,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  Settings2,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: 'workspace' | 'settings';
}

export const navigationItems: readonly NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    description: 'Uma visão geral do seu trabalho.',
    icon: LayoutDashboard,
    group: 'workspace',
  },
  {
    path: '/projetos',
    label: 'Projetos',
    description: 'Um espaço para acompanhar cada entrega.',
    icon: FolderKanban,
    group: 'workspace',
  },
  {
    path: '/clientes',
    label: 'Clientes',
    description: 'Seus contatos e relações de trabalho.',
    icon: UsersRound,
    group: 'workspace',
  },
  {
    path: '/tarefas',
    label: 'Tarefas',
    description: 'Clareza sobre o que precisa ser feito.',
    icon: ListTodo,
    group: 'workspace',
  },
  {
    path: '/financeiro',
    label: 'Financeiro',
    description: 'Um lugar para acompanhar seus recebimentos.',
    icon: CircleDollarSign,
    group: 'workspace',
  },
  {
    path: '/horas',
    label: 'Horas',
    description: 'O tempo dedicado a cada projeto.',
    icon: Clock3,
    group: 'workspace',
  },
  {
    path: '/configuracoes',
    label: 'Configurações',
    description: 'As preferências do seu espaço de trabalho.',
    icon: Settings2,
    group: 'settings',
  },
];
