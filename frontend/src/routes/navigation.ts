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
  placeholder: string;
  icon: LucideIcon;
  group: 'workspace' | 'settings';
}

export const navigationItems: readonly NavigationItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    description: 'Uma visão geral do seu trabalho.',
    placeholder: 'O conteúdo do dashboard será implementado em uma etapa futura.',
    icon: LayoutDashboard,
    group: 'workspace',
  },
  {
    path: '/projetos',
    label: 'Projetos',
    description: 'Um espaço para acompanhar cada entrega.',
    placeholder: 'O gerenciamento de projetos será implementado em uma etapa futura.',
    icon: FolderKanban,
    group: 'workspace',
  },
  {
    path: '/clientes',
    label: 'Clientes',
    description: 'Seus contatos e relações de trabalho.',
    placeholder: 'O gerenciamento de clientes será implementado em uma etapa futura.',
    icon: UsersRound,
    group: 'workspace',
  },
  {
    path: '/tarefas',
    label: 'Tarefas',
    description: 'Clareza sobre o que precisa ser feito.',
    placeholder: 'O gerenciamento de tarefas será implementado em uma etapa futura.',
    icon: ListTodo,
    group: 'workspace',
  },
  {
    path: '/financeiro',
    label: 'Financeiro',
    description: 'Um lugar para acompanhar seus recebimentos.',
    placeholder: 'O controle financeiro será implementado em uma etapa futura.',
    icon: CircleDollarSign,
    group: 'workspace',
  },
  {
    path: '/horas',
    label: 'Horas',
    description: 'O tempo dedicado a cada projeto.',
    placeholder: 'O registro de horas será implementado em uma etapa futura.',
    icon: Clock3,
    group: 'workspace',
  },
  {
    path: '/configuracoes',
    label: 'Configurações',
    description: 'As preferências do seu espaço de trabalho.',
    placeholder: 'As configurações da conta serão implementadas em uma etapa futura.',
    icon: Settings2,
    group: 'settings',
  },
];
