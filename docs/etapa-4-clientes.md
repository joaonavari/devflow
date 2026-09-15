# Etapa 4 — Clientes

Etapa concluída em 15/09/2026 sobre a autenticação aprovada na Etapa 3 e a política
de senha mínima de 8 caracteres.

## Estado encontrado na retomada

Na retomada após a interrupção, o workspace já continha:

- modelo Prisma `Client` e migration `20260915032455_stage4_clients` aplicada;
- API do domínio com autenticação e ownership;
- páginas de listagem e detalhe conectadas à API real;
- criação, edição, busca, arquivamento, restauração e exclusão;
- TanStack Query integrado ao refresh da Etapa 3;
- suíte backend com dois usuários e 23 testes aprovados;
- teste de navegador ampliado para o CRUD, pendente de finalizar o trecho do menu
  móvel porque o seletor antigo não distinguia os novos dialogs.

Após a retomada, todos os diffs foram auditados. O foco inicial dos dialogs foi
tornado explícito, o detalhe passou a separar cliente inexistente de falha de rede,
o teste passou a rejeitar `userId` também no `PATCH`, o seletor do menu móvel foi
corrigido e as respostas de Clientes receberam `Cache-Control: no-store`.

## Arquivos criados

### Backend e Prisma

- `backend/prisma/migrations/20260915032455_stage4_clients/migration.sql`
- `backend/src/controllers/client.controller.ts`
- `backend/src/routes/client.routes.ts`
- `backend/src/services/client-error.ts`
- `backend/src/services/client.service.ts`
- `backend/src/tests/client.test.ts`
- `backend/src/validators/client.schemas.ts`

### Frontend e documentação

- `frontend/src/clients/client-api.ts`
- `frontend/src/clients/client-format.ts`
- `frontend/src/clients/client-schemas.ts`
- `frontend/src/components/clients/ClientCreateDialog.tsx`
- `frontend/src/components/clients/ClientEditForm.tsx`
- `frontend/src/components/clients/ClientFormFields.tsx`
- `frontend/src/components/clients/ClientList.tsx`
- `frontend/src/components/clients/DeleteClientDialog.tsx`
- `frontend/src/pages/ClientDetailPage.tsx`
- `frontend/src/pages/ClientsPage.tsx`
- `frontend/src/styles/clients.css`
- `docs/etapa-4-clientes.md`

## Arquivos alterados

- `README.md`: estado, estrutura, API e testes atuais.
- `package.json`: script `test:clients`.
- `package-lock.json`: dependência de estado remoto.
- `backend/package.json`: script de testes.
- `backend/prisma/schema.prisma`: modelo e relação de `Client`.
- `backend/src/app.ts`: registro de `/api/v1/clients`.
- `backend/src/middlewares/error-handler.ts`: erro público do domínio.
- `frontend/package.json`: TanStack Query.
- `frontend/src/App.tsx`: `QueryClientProvider` com configuração mínima.
- `frontend/src/auth/auth-api.ts`: fetch autenticado com refresh controlado.
- `frontend/src/layouts/AppLayout.tsx`: título em `/clientes/:clientId`.
- `frontend/src/routes/AppRoutes.tsx`: páginas funcionais de Clientes.
- `frontend/src/styles.css`: importação dos estilos do domínio.
- `scripts/auth-browser-check.mjs`: fluxo real completo de Clientes.

## Dependência

Foi adicionado `@tanstack/react-query` 5.102.8 ao frontend. Ele centraliza fetching,
mutations, cache e invalidação sem criar uma camada genérica de domínio. As chaves
de cache incluem o ID do usuário, separando dados entre contas.

## Schema e migration

`Client` possui `id` UUID, `userId` UUID, `name` (`VARCHAR(120)`), `email`
(`VARCHAR(254)`), `phone` opcional (`VARCHAR(40)`), `company` opcional
(`VARCHAR(120)`), `archivedAt` opcional e timestamps em `TIMESTAMPTZ(3)`.

`User 1:N Client` usa chave estrangeira com exclusão em cascata. O índice composto
`(userId, archivedAt, name, id)` atende filtro de proprietário/estado e ordenação
determinística. A migration real foi criada e aplicada com:

```sh
npm run db:migrate -- --name stage4_clients
```

Não foi usado `prisma db push`, SQLite, seed ou relação antecipada com Projetos.

## Endpoints, ownership e busca

| Método e endpoint                         | Sucesso |
| ----------------------------------------- | ------- |
| `GET /api/v1/clients`                     | `200`   |
| `POST /api/v1/clients`                    | `201`   |
| `GET /api/v1/clients/:clientId`           | `200`   |
| `PATCH /api/v1/clients/:clientId`         | `200`   |
| `PATCH /api/v1/clients/:clientId/archive` | `200`   |
| `PATCH /api/v1/clients/:clientId/restore` | `200`   |
| `DELETE /api/v1/clients/:clientId`        | `204`   |

O `userId` vem exclusivamente de `response.locals.user`, preenchido pelo middleware
de autenticação. Os schemas Zod estritos rejeitam `userId` no `POST` e no `PATCH`.
Consultas, updates, archive, restore e delete sempre combinam ID e proprietário.
Recursos alheios e inexistentes retornam o mesmo `404`. Respostas públicas não
incluem `userId` e usam `Cache-Control: no-store`.

`GET /clients` retorna `{ data, meta: { count } }`, envelope preparado para futura
paginação sem implementá-la agora. O padrão é `status=active`; `status=archived`
retorna apenas arquivados. `q` busca com `contains` case-insensitive em nome, email
ou empresa, sempre combinado com proprietário e estado. A ordenação é nome e ID.

## Arquivamento, restauração e exclusão

Arquivar define `archivedAt`, preserva os dados e remove o cliente da listagem
padrão. Restaurar limpa `archivedAt`. Ambas as operações são idempotentes para o
proprietário e não consultam nem alteram registros de outro usuário.

`DELETE` executa exclusão permanente condicionada por `id + userId`. Projetos ainda
não existem, então nenhuma relação ou regra falsa foi antecipada. O service mantém
um ponto explícito para a futura verificação de associações.

## Frontend e UI

React, Vite, React Hook Form e Zod foram preservados. O fetch autenticado reutiliza
`discoverSession`: diante de `401`, faz no máximo uma restauração/rotação coordenada
e repete a requisição uma vez quando existe sessão. Tokens continuam em cookies
HttpOnly.

A listagem usa tabela densa no desktop e lista própria no mobile. Busca, contagem,
ativos/arquivados, loading, vazio, nenhum resultado e erro têm estados explícitos.
O cadastro usa dialog acessível, foco no nome e invalidação de cache.

`/clientes/:clientId` mostra identidade, status e formulário editável.
Arquivamento/restauração exibem feedback. Exclusão exige confirmação em dialog com
foco em Cancelar. Cliente inexistente e falha de carregamento têm estados distintos.

A direção visual mantém Inter, superfícies escuras, bordas e espaçamentos existentes.
Azul aparece em seleção, foco e ação principal. Não há gradients, glow ou
glassmorphism. A linha com iniciais, nome e contato conecta lista e detalhe. Não
foram usadas referências externas de componentes.

## Testes e isolamento

`npm run test:clients` cria Proprietário A/Cliente A e Proprietário B/Cliente B em
PostgreSQL real. Foram aprovados 22 cenários, contabilizados como 23 testes pelo
runner incluindo o agrupador:

- criação autenticada e bloqueio sem autenticação;
- normalização e rejeição de dados inválidos;
- listagem restrita por usuário;
- busca por nome, email e empresa;
- busca sem vazamento entre usuários;
- detalhe, edição, arquivamento, restauração e exclusão;
- ativos separados dos arquivados;
- cliente inexistente com `404` em todas as operações;
- rejeição de `userId` no cadastro e edição.

O isolamento foi comprovado nos dois sentidos para GET, PATCH e DELETE. O usuário A
também recebeu `404` ao tentar ARCHIVE e RESTORE do Cliente B. Os registros ficaram
inalterados após as tentativas. Usuários temporários e clientes foram removidos.

O Chrome percorreu login, vazio, criação, atualização automática da lista, busca,
detalhe, edição, reload, arquivamento, arquivados, restauração, ativos, confirmação
e exclusão. Também validou 320–1440 px, layout mobile, teclado, foco dos dialogs,
Escape, console sem exceções e ausência de requests em loop.

## Validações finais

| Validação                   | Resultado                    |
| --------------------------- | ---------------------------- |
| Prisma validate             | Aprovado                     |
| Prisma generate             | Aprovado                     |
| Migration no PostgreSQL     | Aplicada; nenhuma pendente   |
| `npm run db:check`          | Aprovado                     |
| `npm run test:auth`         | Aprovado (17/17)             |
| `npm run test:clients`      | Aprovado                     |
| `npm run test:auth:browser` | Aprovado                     |
| `npm run lint`              | Aprovado                     |
| `npm run typecheck`         | Aprovado                     |
| `npm run build`             | Aprovado                     |
| `npm run format:check`      | Aprovado                     |
| `git diff --check`          | Aprovado                     |
| `npm audit`                 | Aprovado; 0 vulnerabilidades |

## Limitações

- O MVP não tem paginação; o envelope permite adicioná-la depois.
- A busca `contains` atende ao volume inicial. Índice textual pode ser avaliado com
  dados e métricas reais.
- A exclusão não verifica Projetos porque esse domínio não existe. A regra entra
  quando a relação real for criada.
- O teste visual foi feito em Chrome headless; Safari, Firefox e leitores de tela
  não foram testados.
- O aviso existente do bundle acima de 500 kB permanece; divisão de código pode ser
  avaliada separadamente.

**A ETAPA 4 foi concluída. Não houve avanço para a Etapa 5.**
