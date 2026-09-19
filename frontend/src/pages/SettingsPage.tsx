import { useAuth } from '../auth/auth-context';
import { PageHeader } from '../components/PageHeader';

export function SettingsPage() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Informações da sua conta e referências do workspace."
      />
      <section className="detail-section settings-account" aria-labelledby="settings-account-title">
        <div className="detail-section-heading">
          <div>
            <h2 id="settings-account-title">Sua conta</h2>
            <p>Dados usados para identificar seu workspace.</p>
          </div>
          <span>Somente leitura</span>
        </div>
        <dl className="settings-details">
          <div>
            <dt>Nome</dt>
            <dd>{user?.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Fuso horário</dt>
            <dd>{user?.timezone}</dd>
          </div>
          <div>
            <dt>Moeda dos projetos</dt>
            <dd>Real brasileiro (BRL)</dd>
          </div>
        </dl>
        <p className="settings-note">
          O fuso horário da conta orienta os períodos do Dashboard e a exibição de horários. A
          edição dos dados da conta ainda não está disponível.
        </p>
      </section>
    </>
  );
}
