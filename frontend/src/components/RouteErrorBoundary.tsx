import { Component, type ReactNode } from 'react';

export class RouteErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="session-status" role="alert">
          <h1>Não foi possível abrir esta página</h1>
          <p>Verifique sua conexão e recarregue para tentar novamente.</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => {
              window.location.reload();
            }}
          >
            Recarregar página
          </button>
        </main>
      );
    return this.props.children;
  }
}
