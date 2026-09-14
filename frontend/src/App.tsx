export function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">DevFlow</h1>
      <p className="mt-4 max-w-xl text-base leading-relaxed text-secondary">
        Ambiente de desenvolvimento configurado. As telas serão construídas nas próximas etapas.
      </p>
      <a
        className="mt-8 w-fit text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
        href="/api/v1/health"
      >
        Verificar API
      </a>
    </main>
  );
}
