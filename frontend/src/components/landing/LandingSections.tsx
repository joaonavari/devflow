import {
  ArrowDown,
  ArrowRight,
  Clock3,
  FolderKanban,
  LayoutDashboard,
  ListTodo,
  LockKeyhole,
  Share2,
  UsersRound,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ProductPreview, ProductScreenshot } from './ProductPreview';

const features = [
  {
    icon: FolderKanban,
    title: 'Clientes e projetos',
    description: 'Mantenha clientes, prazos e projetos organizados em um único ambiente.',
  },
  {
    icon: ListTodo,
    title: 'Tasks e Kanban',
    description: 'Organize o trabalho em tarefas e acompanhe cada etapa visualmente.',
  },
  {
    icon: Clock3,
    title: 'Controle de horas',
    description: 'Registre o tempo dedicado a cada projeto e acompanhe o histórico.',
  },
  {
    icon: Wallet,
    title: 'Financeiro',
    description: 'Controle cobranças, valores pagos, pendentes e vencidos.',
  },
  {
    icon: LayoutDashboard,
    title: 'Dashboard',
    description: 'Veja rapidamente o que precisa da sua atenção.',
  },
  {
    icon: Share2,
    title: 'Portal do cliente',
    description: 'Compartilhe o andamento do projeto sem expor sua área administrativa.',
  },
];
const steps = [
  'Cadastre seu cliente',
  'Crie o projeto',
  'Organize tarefas e horas',
  'Acompanhe financeiro e progresso',
  'Compartilhe o portal com o cliente',
];

export function HeroSection() {
  return (
    <section className="landing-hero landing-container" aria-labelledby="landing-title">
      <p className="landing-eyebrow">
        <span /> Feito para a rotina de freelancers
      </p>
      <h1 id="landing-title">
        Organize seus clientes, projetos e financeiro <span>em um só lugar.</span>
      </h1>
      <p className="landing-hero-description">
        Centralize projetos, tarefas, horas, cobranças e o acompanhamento dos seus clientes com o
        DevFlow.
      </p>
      <div className="landing-actions">
        <Link to="/register" className="landing-button landing-button-primary">
          Começar grátis <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <a href="#como-funciona" className="landing-button landing-button-secondary">
          Ver como funciona <ArrowDown size={16} aria-hidden="true" />
        </a>
      </div>
      <p className="landing-hero-note">Do cliente à entrega, tudo conectado.</p>
      <ProductPreview />
    </section>
  );
}

export function ExecutionSection() {
  return (
    <section className="landing-section landing-story-band" aria-labelledby="execution-title">
      <div className="landing-container landing-story">
        <div className="landing-section-heading landing-story-copy">
          <p className="landing-eyebrow">Execução em perspectiva</p>
          <h2 id="execution-title">Veja seu trabalho avançar.</h2>
          <p>
            Organize tarefas por etapa, prioridade e status em um Kanban conectado ao progresso do
            projeto.
          </p>
        </div>
        <ProductScreenshot
          src="/images/devflow-kanban.webp"
          alt="Kanban do DevFlow com tarefas organizadas por etapa."
          context="Projeto / Kanban"
          label="Execução"
          icon={ListTodo}
        />
      </div>
    </section>
  );
}

export function FinanceSection() {
  return (
    <section
      className="landing-section landing-story-band landing-story-band-muted"
      aria-labelledby="finance-title"
    >
      <div className="landing-container landing-story landing-story-reverse">
        <div className="landing-section-heading landing-story-copy">
          <p className="landing-eyebrow">Controle financeiro</p>
          <h2 id="finance-title">Projetos e financeiro no mesmo lugar.</h2>
          <p>
            Acompanhe cobranças, valores pagos, pendentes e vencidos sem depender de planilhas
            separadas.
          </p>
        </div>
        <ProductScreenshot
          src="/images/devflow-financeiro.webp"
          alt="Painel financeiro do DevFlow com valores pagos, pendentes e vencidos."
          context="Financeiro"
          label="Controle"
          icon={Wallet}
        />
      </div>
    </section>
  );
}

export function FeaturesSection() {
  return (
    <section
      id="recursos"
      className="landing-section landing-container"
      aria-labelledby="features-title"
      tabIndex={-1}
    >
      <div className="landing-section-heading">
        <p className="landing-eyebrow">Tudo no seu contexto</p>
        <h2 id="features-title">
          Uma visão completa
          <br />
          do seu trabalho.
        </h2>
        <p>Da organização à entrega, cada parte da sua rotina tem seu lugar.</p>
      </div>
      <div className="landing-features">
        {features.map(({ icon: Icon, title, description }) => (
          <article className="landing-feature" key={title}>
            <Icon size={22} strokeWidth={1.6} aria-hidden="true" />
            <h3>{title}</h3>
            <p>{description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function WorkflowSection() {
  return (
    <section
      id="como-funciona"
      className="landing-section landing-workflow"
      aria-labelledby="workflow-title"
      tabIndex={-1}
    >
      <div className="landing-container">
        <div className="landing-section-heading">
          <p className="landing-eyebrow">Como funciona</p>
          <h2 id="workflow-title">
            Um fluxo simples.
            <br />
            Do início à entrega.
          </h2>
          <p>Comece com um cliente e conecte os próximos passos.</p>
        </div>
        <ol className="landing-steps">
          {steps.map((step, index) => (
            <li key={step}>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <h3>{step}</h3>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ClientPortalSection() {
  return (
    <section className="landing-section landing-story-band" aria-labelledby="client-portal-title">
      <div className="landing-container landing-story landing-portal">
        <div className="landing-section-heading landing-story-copy">
          <p className="landing-eyebrow">Portal do cliente</p>
          <h2 id="client-portal-title">
            Mantenha seu cliente
            <br />
            por dentro do projeto.
          </h2>
          <p>
            Compartilhe progresso, etapas e tarefas selecionadas por meio de um portal seguro, sem
            expor informações internas, horas ou dados financeiros.
          </p>
          <p className="landing-privacy-note">
            <LockKeyhole size={17} aria-hidden="true" />
            <span>Você escolhe o que fica visível para o cliente.</span>
          </p>
          <Link to="/register" className="landing-text-link">
            Conhecer o DevFlow <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <ProductScreenshot
          src="/images/devflow-portal.webp"
          alt="Portal do cliente do DevFlow com progresso, etapas e tarefas públicas."
          context="Portal do cliente"
          label="Somente leitura"
          icon={Share2}
        />
      </div>
    </section>
  );
}

export function ConnectedSection() {
  const modules = [
    { label: 'Cliente', icon: UsersRound },
    { label: 'Projeto', icon: FolderKanban },
    { label: 'Tasks', icon: ListTodo },
    { label: 'Horas', icon: Clock3 },
    { label: 'Financeiro', icon: Wallet },
    { label: 'Portal do cliente', icon: Share2 },
  ];
  return (
    <section className="landing-container landing-connected" aria-labelledby="connected-title">
      <p className="landing-eyebrow">Organização centralizada</p>
      <h2 id="connected-title">Tudo conectado. Nada perdido pelo caminho.</h2>
      <ol className="landing-module-flow">
        {modules.map(({ label, icon: Icon }) => (
          <li key={label}>
            <span>
              <Icon size={17} aria-hidden="true" />
              {label}
            </span>
            <ArrowRight className="landing-flow-arrow" size={16} aria-hidden="true" />
          </li>
        ))}
      </ol>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="landing-container landing-final" aria-labelledby="final-cta-title">
      <p className="landing-eyebrow">Seu próximo projeto começa aqui</p>
      <h2 id="final-cta-title">
        Menos planilhas.
        <br />
        <span>Mais controle sobre seus projetos.</span>
      </h2>
      <p>Reúna sua rotina de freelancer em um único workspace.</p>
      <Link to="/register" className="landing-button landing-button-primary">
        Criar minha conta <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </section>
  );
}
