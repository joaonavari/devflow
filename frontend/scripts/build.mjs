// The API's root .env may contain NODE_ENV=development. A distributable frontend
// must select production React before Vite resolves that shared environment.
process.env.NODE_ENV = 'production';
const { build } = await import('vite');
await build({
  plugins: [
    {
      name: 'verify-production-runtime',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (
            output.type === 'chunk' &&
            Object.keys(output.modules).some((id) =>
              /react[^/]*\/cjs\/.*\.development\.js/.test(id),
            )
          ) {
            throw new Error(
              'O build de produção não pode incluir o runtime de desenvolvimento do React.',
            );
          }
        }
      },
    },
  ],
});
