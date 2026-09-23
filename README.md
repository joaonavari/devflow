# DevFlow

Plataforma full stack para freelancers gerenciarem clientes, projetos, tarefas,
horas e recebimentos. Desenvolvimento incremental para portfólio profissional.

## Estado atual: Landing pública

- Monorepo com npm workspaces: `frontend` e `backend`.
- React, TypeScript e Vite, com Tailwind CSS e layout autenticado responsivo.
- Express com TypeScript, health check e diagnóstico de conexão com PostgreSQL.
- Prisma com `User`, `AuthSession`, `Client`, `Project`, `Task`, `TimeEntry`, `Payment`, `PortalLink` e `ProjectStage`, com migrations versionadas para PostgreSQL.
- ESLint com verificação de tipos, Prettier e scripts compartilhados.
- Cadastro, login, logout, restauração e rotação de sessão integrados à API real.
- CRUD real de clientes com busca, arquivamento, restauração e isolamento por usuário.
- CRUD real de projetos com busca, filtros, progresso, orçamento e isolamento por usuário.
- Tasks reais, visão global, Kanban por projeto e progresso automático opcional.
- Registros de horas por projeto, com visão global, filtros e totais calculados.
- Cobranças por projeto, com pagamento, reabertura, vencimentos e totais financeiros.
- Dashboard integrado com projetos, tarefas, horas, financeiro e atividades recentes.
- Portal do cliente somente leitura, com link seguro, expiração, revogação e timeline de etapas visíveis.
- Rotas privadas para dashboard, projetos, clientes, tarefas, financeiro, horas e configurações.
- Landing pública em `/`, com screenshots reais do produto, recursos, fluxo de trabalho e acesso ao cadastro/login.

Configurações mostra dados da conta e fuso horário em modo somente leitura.
A Etapa 11 refina bundle, Dashboard, cache de sessão, UX, acessibilidade,
responsividade e privacidade HTTP. A Landing preserva esses refinamentos e a área
autenticada. CI/CD e deploy não fazem parte da entrega atual.

Consulte os relatórios de cada etapa para detalhes de escopo, decisões e validações:

| Etapa   | Relatório                                            |
| ------- | ---------------------------------------------------- |
| 3       | [Autenticação](docs/etapa-3-autenticacao.md)         |
| 4       | [Clientes](docs/etapa-4-clientes.md)                 |
| 5       | [Projetos](docs/etapa-5-projetos.md)                 |
| 6       | [Tasks & Kanban](docs/etapa-6-tasks-kanban.md)       |
| 7       | [Registros de horas](docs/etapa-7-horas.md)          |
| 8       | [Financeiro](docs/etapa-8-financeiro.md)             |
| 9       | [Dashboard](docs/etapa-9-dashboard.md)               |
| 10      | [Portal do Cliente](docs/etapa-10-portal-cliente.md) |
| 11      | [Refinamento](docs/etapa-11-refinamento.md)          |
| Landing | [Landing pública](docs/landing-publica.md)           |

## Pré-requisitos

- Node.js 24.13.0 ou versão 24.x mais recente, com npm 11.x.
- Docker com Compose v2, **somente para executar o PostgreSQL local**.
- Portas locais disponíveis: `5173` (frontend), `3001` (API), `5432` (banco).

Se usa nvm, execute `nvm install` e `nvm use` na raiz. A versão de referência está
em `.nvmrc`; `.npmrc` impede a instalação com versões incompatíveis do runtime.

O `package.json` contém overrides limitados às dependências transitivas
`deepmerge-ts` e `mysql2` do Prisma CLI 7.10.0, para corrigir os avisos identificados
pelo `npm audit`. O driver MySQL é uma dependência interna da ferramenta; a
aplicação continua usando exclusivamente PostgreSQL. Esses overrides devem ser
reavaliados quando o Prisma for atualizado.

O Prisma CLI é uma ferramenta de desenvolvimento declarada na raiz, assim como
ESLint e TypeScript. O client e o adaptador PostgreSQL ficam no backend.

## Instalação

Execute os comandos na raiz do repositório:

```sh
cp .env.example .env
npm ci
```

Edite `.env` e substitua a senha de exemplo em **`POSTGRES_PASSWORD` e
`DATABASE_URL`** pelo mesmo valor. Uma senha hexadecimal evita caracteres que
precisariam ser codificados na URL. Os exemplos são placeholders, não credenciais
de produção. O arquivo `.env` é ignorado pelo Git.

Gere uma chave de 32 bytes e copie a saída para `JWT_SECRET` no `.env`:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

`JWT_SECRET` exige exatamente 64 caracteres hexadecimais. Use uma chave aleatória
própria por ambiente. `APP_ORIGIN=http://127.0.0.1:5173` corresponde ao frontend local;
use esse endereço no navegador, sem alternar para `localhost`.

O arquivo de lock da raiz é compartilhado pelos workspaces. Não execute uma
instalação independente para cada aplicativo. `npm install` fica reservado a
alterações intencionais nas dependências; após clonar, prefira `npm ci`.

Gere o client do Prisma:

```sh
npm run db:generate
```

Esse comando e a validação do schema não precisam de um PostgreSQL ativo.

## PostgreSQL local

Quando Docker e Compose estiverem instalados e em execução:

```sh
npm run db:up
npm run db:status
npm run db:migrate:deploy
npm run db:check
```

`db:up` inicia PostgreSQL 17 e aguarda o health check do container. A porta é
publicada somente em `127.0.0.1`. Os dados ficam no volume nomeado
`devflow_postgres_data` e são preservados ao executar `npm run db:down`.

`db:check` executa `SELECT 1` pelo Prisma e encerra com código `0` no sucesso ou
`1` na falha. Não cria tabelas, não altera dados e não imprime credenciais.

```sh
npm run db:logs
npm run db:down
```

Se a porta `5432` já estiver ocupada, altere `POSTGRES_PORT` e a porta dentro de
`DATABASE_URL`. Se o volume já tiver sido inicializado, mudar a senha no `.env`
não muda a senha do usuário existente no PostgreSQL. Não remova o volume para
resolver esse problema sem antes cuidar dos dados que ele contém.

**Sem Docker/PostgreSQL:** é possível instalar, gerar e validar o Prisma, compilar
e executar os aplicativos. O diagnóstico do banco falhará e a rota de prontidão
retornará `503` até que o PostgreSQL esteja disponível. Não há banco substituto.

## Desenvolvimento

```sh
npm run dev
```

- Frontend: <http://127.0.0.1:5173>
- API: <http://127.0.0.1:3001/api/v1/health>
- Prontidão do banco: <http://127.0.0.1:3001/api/v1/health/ready>

O comando inicia os dois workspaces e encerra ambos quando um deles é encerrado.
Também é possível executar `npm run dev:frontend` e `npm run dev:backend`
separadamente. Use `Ctrl+C` para parar.

O Vite encaminha `/api` para a API local. O frontend usa URLs relativas e cookies
HttpOnly. A API permite credenciais somente para `APP_ORIGIN`; requisições de
escrita exigem essa origem e `X-DevFlow-Request: 1`. `API_PORT` é lido pelo proxy; reinicie os processos
após alterar o `.env`. Apenas variáveis prefixadas com `VITE_` são expostas ao
código do navegador: nunca use esse prefixo para senhas ou `DATABASE_URL`.

O backend e o Prisma CLI leem `.env` da raiz usando o carregador nativo do Node.js.
Variáveis já definidas no processo têm prioridade. Zod valida a configuração do
backend sem incluir os valores das variáveis nas mensagens de erro.

## Health checks

| Endpoint                   | Condição                         | Resposta                                         |
| -------------------------- | -------------------------------- | ------------------------------------------------ |
| `GET /api/v1/health`       | API ativa; não consulta o banco  | `200`, `{"status":"ok","service":"devflow-api"}` |
| `GET /api/v1/health/ready` | `SELECT 1` executado pelo Prisma | `200`, `{"status":"ok","database":"up"}`         |
| `GET /api/v1/health/ready` | Banco indisponível               | `503`, `{"status":"error","database":"down"}`    |

As respostas de health check não são armazenadas em cache. Erros e rotas
inexistentes retornam JSON; detalhes internos e credenciais não são enviados ao
cliente. O pool tem limites de conexão e de espera. A API fecha o servidor HTTP
e as conexões do Prisma ao receber `SIGINT` ou `SIGTERM`.

## Prisma e migrations

```sh
npm run db:validate
npm run db:generate
```

O schema define o provider PostgreSQL e os modelos `User`, `AuthSession`, `Client`,
`Project`, `Task`, `TimeEntry`, `Payment`, `PortalLink` e `ProjectStage`.
As migrations versionadas são:

- `20260915024133_stage3_authentication`
- `20260915032455_stage4_clients`
- `20260915174001_stage5_projects`
- `20260915181540_stage6_tasks_kanban`
- `20260915213228_stage7_time_entries`
- `20260916034805_stage8_payments`
- `20260917204529_stage10_client_portal`

Elas criam as tabelas, índices, constraints e relações. O dashboard da Etapa 9
consulta os dados existentes e não exige novas tabelas ou migrations.

O Prisma está fixado na versão 7.10.0, com o adaptador PostgreSQL da mesma
versão. O client gerado fica em `backend/src/generated/prisma/`, ignorado pelo Git,
e é incluído na compilação do backend.

Para criar uma nova migration após uma alteração de schema autorizada:

```sh
npm run db:migrate -- --name nome_da_alteracao
npm run db:generate
```

As migrations criadas em `backend/prisma/migrations/` devem ser versionadas.
`prisma migrate dev` pode precisar criar um banco temporário de validação; o usuário
do PostgreSQL criado pelo Compose local tem essa permissão.

Para aplicar migrations já versionadas em um ambiente de publicação futuro:

```sh
npm run db:migrate:deploy
```

O projeto utiliza migrations reais. Não usa `db push`, seed nem tabelas
antecipadas de funcionalidades de negócio.

## Verificações e build

```sh
npm run check
```

Executa validação e geração do Prisma, ESLint sem warnings, TypeScript,
checagem de formatação e build dos dois workspaces. Não exige banco ativo.

Comandos individuais:

```sh
npm run lint
npm run typecheck
npm run format:check
npm run format
npm run build
```

Os testes de integração são executados separadamente, com PostgreSQL disponível
e todas as migrations aplicadas:

```sh
npm run test:auth
npm run test:clients
npm run test:projects
npm run test:tasks
npm run test:time-entries
npm run test:payments
npm run test:dashboard
npm run test:portal
npm run test:stages
```

Após o build:

```sh
npm start
```

Esse comando executa **somente a API compilada**, em `backend/dist/server.js`.
Para visualizar o frontend compilado, use em outro terminal:

```sh
npm run preview --workspace @devflow/frontend
```

O preview serve os arquivos estáticos de `frontend/dist/` e não representa o
deploy final. Na publicação futura será necessário encaminhar `/api` ao backend
na mesma origem.

## Estrutura

```text
DevFlow/
├── frontend/
│   ├── public/           # Favicon local
│   ├── src/
│   │   ├── clients/      # API, schemas e formatação do domínio de clientes
│   │   ├── projects/     # API, schemas e formatação do domínio de projetos
│   │   ├── tasks/        # API, schemas e formatação de tarefas
│   │   ├── time-entries/ # API, schemas e formatação de registros de horas
│   │   ├── payments/     # API, schemas e formatação de cobranças
│   │   ├── dashboard/    # Cliente da API e contrato do dashboard
│   │   ├── portal/       # APIs separadas do portal público e da administração
│   │   ├── components/   # Navegação, autenticação e componentes de domínio
│   │   ├── layouts/      # Estrutura autenticada responsiva
│   │   ├── auth/         # Estado de sessão, cliente HTTP e proteção de rotas
│   │   ├── pages/        # Autenticação, domínios, dashboard, placeholder e 404
│   │   ├── routes/       # Definição das rotas e metadados da navegação
│   │   ├── styles/       # Tokens do design system e estilos por domínio
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts    # React, Tailwind e proxy local
│   └── tsconfig.json
├── backend/
│   ├── prisma/           # Schema e migrations da aplicação
│   ├── src/
│   │   ├── config/       # Ambiente e client Prisma
│   │   ├── controllers/  # Respostas HTTP dos domínios
│   │   ├── middlewares/  # Autenticação, origem/CSRF e erros
│   │   ├── routes/       # Health check, autenticação, domínios e dashboard
│   │   ├── scripts/      # Diagnóstico de conexão
│   │   ├── services/     # Diagnóstico, sessões e domínios de negócio
│   │   ├── tests/        # Testes HTTP com PostgreSQL real
│   │   ├── validators/   # Schemas de entrada Zod
│   │   ├── app.ts        # Composição do Express
│   │   └── server.ts     # Porta HTTP e encerramento
│   ├── prisma.config.ts
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── compose.yaml
├── docs/                # Relatórios das etapas 3 a 10
├── scripts/             # Verificação integrada no navegador
├── .env.example
├── eslint.config.mjs
├── tsconfig.base.json
├── package.json
└── package-lock.json
```

Pastas e componentes são criados conforme necessidades reais. A configuração
compartilhada ativa TypeScript estrito; o backend usa módulos ESM com resolução
NodeNext, e o frontend usa a resolução do bundler Vite. Dependências de autenticação
e formulários foram adicionadas na Etapa 3. TanStack Query gerencia o estado remoto
de clientes, projetos, tarefas, horas, cobranças e dashboard. O Kanban usa dnd-kit;
o dashboard apresenta barras de progresso e distribuição de horas sem biblioteca
externa de gráficos. As páginas principais usam `React.lazy` e `Suspense` para
carregamento sob demanda.

## Base visual

As rotas privadas compartilham o mesmo layout:

| Rota                                 | Conteúdo                                      |
| ------------------------------------ | --------------------------------------------- |
| `/dashboard`                         | Visão consolidada com filtros de período      |
| `/clientes` e `/clientes/:clientId`  | Gestão e detalhe de clientes                  |
| `/projetos` e `/projetos/:projectId` | Gestão de projetos, Kanban, horas e cobranças |
| `/tarefas`                           | Busca e filtros globais de tarefas            |
| `/financeiro`                        | Gestão de cobranças e totais financeiros      |
| `/horas`                             | Registros de horas e totais por período       |
| `/configuracoes`                     | Conteúdo temporário                           |

A rota pública `/portal/:token` usa layout próprio, sem sidebar ou sessão
administrativa. O acesso depende exclusivamente do token do link.

A raiz `/` exibe a Landing pública, sem consultar a sessão. Seus CTAs levam a
`/register` e `/login`. Visitantes das rotas privadas são encaminhados para `/login`;
o login retorna à rota privada solicitada. `/login` e `/register` redirecionam
usuários autenticados para `/dashboard`. Endereços desconhecidos exibem uma página
de erro dentro do layout privado, com retorno para o dashboard.

Os tokens visuais ficam em `frontend/src/styles/tokens.css`: paleta, tipografia,
escala de espaçamento, raios, sombra, breakpoint, tamanho mínimo dos controles e
foco. A fonte variável Inter é servida pelo próprio frontend. O azul `#3B82F6`
identifica seleção, links e foco; ele não é usado como decoração de superfície.

Em telas a partir de 1024 px, a sidebar permanece visível. Abaixo desse tamanho,
um botão de 44 px abre a navegação em um diálogo modal nativo, que gerencia foco,
teclado e fechamento com Escape. O conteúdo usa gutters fluidos e não depende de
larguras fixas. As transições são desativadas quando o sistema solicita movimento
reduzido.

## Clientes e testes da Etapa 4

| Endpoint                                  | Comportamento                                   |
| ----------------------------------------- | ----------------------------------------------- |
| `GET /api/v1/clients`                     | Lista ativos; aceita `status` e busca com `q`   |
| `POST /api/v1/clients`                    | Cadastra para o usuário autenticado             |
| `GET /api/v1/clients/:clientId`           | Retorna detalhe pertencente ao usuário          |
| `PATCH /api/v1/clients/:clientId`         | Atualiza os dados editáveis                     |
| `PATCH /api/v1/clients/:clientId/archive` | Define `archivedAt`                             |
| `PATCH /api/v1/clients/:clientId/restore` | Limpa `archivedAt`                              |
| `DELETE /api/v1/clients/:clientId`        | Exclui sem projetos; caso contrário retorna 409 |

Todas as operações exigem sessão e combinam `clientId` com o `userId` autenticado.
A API rejeita ownership enviado pelo frontend e responde `404` para acesso cruzado.
A busca case-insensitive cobre nome, email e empresa dentro do usuário e do estado
selecionado. A ordenação usa nome e ID.

O frontend usa TanStack Query para cache, mutations e invalidação. As chaves incluem
o usuário autenticado, impedindo reaproveitamento de dados entre contas. O CRUD
atualiza a interface sem reload manual.

```sh
npm run test:clients
```

A suíte cria dois usuários e comprova isolamento em listagem, busca, detalhe,
edição, arquivamento, restauração e exclusão. Os registros temporários são removidos
ao final. `npm run test:auth:browser` também percorre o CRUD completo no Chrome.

## Projetos e testes da Etapa 5

| Endpoint                                    | Comportamento                          |
| ------------------------------------------- | -------------------------------------- |
| `GET /api/v1/projects`                      | Lista ativos; aceita busca e filtros   |
| `POST /api/v1/projects`                     | Cadastra com cliente ativo do usuário  |
| `GET /api/v1/projects/:projectId`           | Retorna detalhe pertencente ao usuário |
| `PATCH /api/v1/projects/:projectId`         | Atualiza dados, status e progresso     |
| `PATCH /api/v1/projects/:projectId/archive` | Define `archivedAt`                    |
| `PATCH /api/v1/projects/:projectId/restore` | Limpa `archivedAt`                     |
| `DELETE /api/v1/projects/:projectId`        | Exclui permanentemente                 |

`GET /projects` usa `view=active|archived`, `status`, `clientId` e `q`. A busca
case-insensitive cobre projeto e nome do cliente. Todas as consultas combinam o
recurso com o usuário autenticado; cliente estrangeiro ou indisponível não pode ser
associado.

`budget` é persistido como `Decimal(12,2)` e trafega na API como string decimal.
`startDate` e `dueDate` usam o tipo PostgreSQL `DATE` e o contrato `YYYY-MM-DD`, sem
conversão para o fuso local. O progresso manual aceita inteiros de 0 a 100.

Clientes arquivados permanecem visíveis em projetos existentes. Eles não aparecem
na criação e não aceitam novas associações. Um cliente com qualquer projeto não
pode ser excluído permanentemente e recebe `409 Conflict`.

```sh
npm run test:projects
```

A suíte usa dois usuários, dois clientes e dois projetos para comprovar isolamento
em criação, associação, listagem, busca, filtros, detalhe, edição, archive, restore
e delete. O teste de navegador percorre o fluxo integrado de Clientes e Projetos.

## Tasks, Kanban e progresso da Etapa 6

| Endpoint                                 | Comportamento                        |
| ---------------------------------------- | ------------------------------------ |
| `GET /api/v1/projects/:projectId/tasks`  | Lista tarefas do projeto pertencente |
| `POST /api/v1/projects/:projectId/tasks` | Cria em projeto ativo pertencente    |
| `GET /api/v1/tasks`                      | Visão global com busca e filtros     |
| `GET /api/v1/tasks/:taskId`              | Retorna uma tarefa pertencente       |
| `PATCH /api/v1/tasks/:taskId`            | Atualiza os dados da tarefa          |
| `PATCH /api/v1/tasks/:taskId/move`       | Persiste status e posição sequencial |
| `DELETE /api/v1/tasks/:taskId`           | Exclui e normaliza a coluna          |

As tarefas usam os status `TODO`, `IN_PROGRESS` e `DONE`, prioridades de `LOW` a
`URGENT` e posições inteiras normalizadas por projeto e status. Ao entrar em
`DONE`, `completedAt` recebe um timestamp; ao reabrir, volta a `null`. Projeto
arquivado mantém a leitura e bloqueia todas as mutações de tarefas.

`Project.progressMode` usa `MANUAL` por padrão para preservar projetos existentes.
Em `AUTO`, a API calcula `DONE / total`, arredonda ao inteiro mais próximo e usa
zero quando não há tarefas. O valor derivado não é persistido. A troca para AUTO
recalcula imediatamente; a volta para MANUAL congela o percentual calculado.

O Kanban de `/projetos/:projectId` usa dnd-kit, atualização otimista com rollback e
controles de status e ordem acessíveis por teclado. `/tarefas` oferece busca e
filtros globais com identificação do projeto.

```sh
npm run test:tasks
```

A suíte cobre operações, posições, progresso e isolamento entre usuários por meio
da relação `Task → Project → User`.

## Registros de horas da Etapa 7

| Endpoint                                        | Comportamento                             |
| ----------------------------------------------- | ----------------------------------------- |
| `GET /api/v1/projects/:projectId/time-entries`  | Lista e soma as horas do projeto          |
| `POST /api/v1/projects/:projectId/time-entries` | Registra minutos em projeto ativo próprio |
| `GET /api/v1/time-entries`                      | Visão global com busca, período e filtros |
| `GET /api/v1/time-entries/:timeEntryId`         | Retorna um registro pertencente           |
| `PATCH /api/v1/time-entries/:timeEntryId`       | Edita data, duração e descrição           |
| `DELETE /api/v1/time-entries/:timeEntryId`      | Exclui permanentemente um registro        |

`TimeEntry` guarda somente `durationMinutes` inteiro e `workDate` como PostgreSQL
`DATE`. Totais são derivados com `SUM(durationMinutes)` e nunca persistidos no
projeto. Ownership segue `TimeEntry → Project → User`; projeto arquivado mantém a
leitura e bloqueia mutações até ser restaurado.

`/horas` oferece total geral, total filtrado, busca, filtros e criação para
projetos ativos. O detalhe do projeto mostra o total e os registros recentes. O
formulário recebe horas e minutos separados e converte para minutos antes da API.

```sh
npm run test:time-entries
```

A suíte usa PostgreSQL real e dois usuários para cobrir CRUD, datas, duração,
totais, filtros, isolamento e o comportamento de projetos arquivados.

## Financeiro da Etapa 8

| Endpoint                                    | Comportamento                            |
| ------------------------------------------- | ---------------------------------------- |
| `GET /api/v1/projects/:projectId/payments`  | Lista cobranças e totais do projeto      |
| `POST /api/v1/projects/:projectId/payments` | Cria cobrança em projeto ativo próprio   |
| `GET /api/v1/payments`                      | Visão global com busca, filtros e totais |
| `GET /api/v1/payments/:paymentId`           | Retorna uma cobrança pertencente         |
| `PATCH /api/v1/payments/:paymentId`         | Edita os dados da cobrança               |
| `PATCH /api/v1/payments/:paymentId/pay`     | Marca como paga e preenche `paidAt`      |
| `PATCH /api/v1/payments/:paymentId/reopen`  | Reabre como pendente e limpa `paidAt`    |
| `DELETE /api/v1/payments/:paymentId`        | Exclui permanentemente uma cobrança      |

`Payment` pertence a um projeto e usa `Decimal(12,2)` para valores, transmitidos
como strings decimais na API. A interface apresenta BRL. `dueDate` usa PostgreSQL
`DATE`; `paidAt` registra o instante do pagamento. Apenas `PENDING` e `PAID` são
persistidos: o atraso é derivado do vencimento e do dia atual no fuso do usuário.

`/financeiro` oferece busca e filtros por projeto, cliente, status, atraso e
intervalo de vencimento, além dos totais previsto, pago, pendente e vencido.
O detalhe do projeto também permite gerenciar cobranças. Projetos arquivados
mantêm a leitura e bloqueiam mutações até serem restaurados. O domínio registra
cobranças previstas; não integra gateway, emissão fiscal ou conciliação bancária.

```sh
npm run test:payments
```

A suíte cobre precisão decimal, validação, filtros, pagamento, reabertura,
totais, isolamento entre usuários e bloqueio de mutações em projetos arquivados.

## Dashboard da Etapa 9

`GET /api/v1/dashboard?period=TODAY|7D|30D` retorna o resumo de projetos, tarefas,
horas e financeiro do usuário autenticado, além de atividades recentes.
O período padrão é `30D`; os limites de datas seguem o fuso do usuário.

O período filtra horas registradas, tarefas concluídas e pagamentos recebidos.
Projetos ativos, tarefas abertas e valores pendentes ou vencidos representam o
estado atual. Projetos arquivados ficam fora da carga de trabalho de projetos e
tarefas; horas históricas e valores financeiros continuam considerados.

O dashboard é uma camada de leitura sobre os domínios existentes, sem persistir
métricas ou eventos. A atividade recente é derivada dos timestamps existentes
e não constitui um histórico de auditoria. As consultas aplicam isolamento por
usuário, agregações no banco e limites nas listas.

`/dashboard` usa uma query TanStack Query por usuário e período, sem polling,
com nova consulta ao retornar à página após alterações em outros domínios.

```sh
npm run test:dashboard
```

A suíte cobre autenticação, conta vazia, períodos, agregações de tarefas, horas e
financeiro, limites das listas e isolamento entre usuários.

## Portal do Cliente da Etapa 10

No detalhe do projeto, o proprietário gerencia etapas e gera um link público
somente leitura. A validade pode ser de 7, 30 (padrão) ou 90 dias. Existe um único
`PortalLink` por projeto; gerar novamente substitui o hash e invalida o link anterior.

O token usa 32 bytes criptograficamente aleatórios e codificação base64url. Somente
seu hash SHA-256 é persistido. O link completo aparece apenas após a geração e fica
em memória enquanto a página está aberta. O GET administrativo retorna apenas
estado e datas; se o link for perdido, é necessário gerar outro.

| Endpoint                                     | Acesso e comportamento                                 |
| -------------------------------------------- | ------------------------------------------------------ |
| `GET /api/v1/projects/:projectId/portal`     | Proprietário: estado e validade                        |
| `POST /api/v1/projects/:projectId/portal`    | Proprietário: gera ou rotaciona; aceita `validityDays` |
| `DELETE /api/v1/projects/:projectId/portal`  | Proprietário: revoga imediatamente                     |
| `GET /api/v1/projects/:projectId/stages`     | Proprietário: lista etapas ordenadas                   |
| `POST /api/v1/projects/:projectId/stages`    | Proprietário: cria etapa                               |
| `PATCH /api/v1/project-stages/:stageId`      | Proprietário: título, status e visibilidade            |
| `PATCH /api/v1/project-stages/:stageId/move` | Proprietário: reordena por `position`                  |
| `DELETE /api/v1/project-stages/:stageId`     | Proprietário: exclui e normaliza posições              |
| `GET /api/v1/portal/:token`                  | Público: autoriza exclusivamente pelo token            |

O portal retorna somente nome, descrição, status, progresso oficial e datas do
projeto, tarefas visíveis e etapas visíveis. Não retorna IDs internos, orçamento,
financeiro, horas, clientes ou dados do proprietário. Tarefas e etapas começam
privadas (`isClientVisible = false`). As etapas usam `PENDING`, `IN_PROGRESS` e
`COMPLETED` e podem ser ordenadas por botões acessíveis.

Tokens inválidos, expirados, revogados e projetos arquivados recebem o mesmo
`404`. Arquivar revoga o portal na mesma transação; restaurar não reativa o link.
As etapas de projetos arquivados ficam somente leitura.

A API pública aplica `Cache-Control: no-store`, `Pragma: no-cache`,
`Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex, nofollow` e limite de 60
requisições por minuto por IP. O frontend inclui metas de privacidade no HTML,
usa fontes do sistema no portal e consulta a API sem cookies. Falhas em novas
consultas removem o conteúdo público da tela.

Com API, frontend e Chrome CDP em execução, conforme as instruções de navegador
abaixo:

```sh
npm run test:portal:browser
```

Após o build, `npm run test:portal:privacy` verifica os headers/metas do HTML em
desenvolvimento e preview, o `no-store` em erros do proxy e a ausência do token
nos logs. O teste inicia servidores temporários em portas livres.

As capturas ficam em `/private/tmp/devflow-stage10` (ajustável por
`PORTAL_SCREENSHOT_DIR`) e não incluem o link completo. O teste usa contextos
administrativo e público separados e remove seus dados ao finalizar.

Para publicação futura, o servidor de arquivos estáticos deve reproduzir os
headers de privacidade de `/portal/*` e a política de referrer dos recursos;
logs de acesso devem omitir ou mascarar tokens tanto no frontend quanto na API.
O limiter em memória vale por processo e requer estratégia compartilhada em
múltiplas instâncias. Não há deploy nesta etapa. Consulte o
[relatório da Etapa 10](docs/etapa-10-portal-cliente.md) para revisão de segurança,
contrato público e validações.

## Autenticação e testes da Etapa 3

| Endpoint                     | Resultado                                               |
| ---------------------------- | ------------------------------------------------------- |
| `POST /api/v1/auth/register` | Cria usuário e sessão; retorna `201` e dados públicos   |
| `POST /api/v1/auth/login`    | Valida credenciais; retorna `200` e cria sessão         |
| `POST /api/v1/auth/refresh`  | Consome refresh atual, grava novo hash e renova cookies |
| `POST /api/v1/auth/logout`   | Revoga a sessão atual e remove cookies; `204`           |
| `GET /api/v1/auth/me`        | Retorna usuário autenticado ou `401`                    |

O JWT HS256 dura 15 minutos. A sessão tem duração absoluta de 7 dias, inclusive
após renovações. Senhas usam bcrypt com custo 12; o refresh usa 32 bytes aleatórios
e somente seu SHA-256 é persistido. Tokens ficam exclusivamente em cookies
HttpOnly, SameSite=Lax, Secure em produção. Nenhum token vai para Web Storage.
O middleware verifica assinatura, claims e a sessão no banco em cada acesso.

O frontend consulta `/auth/me` ao abrir a aplicação, ao receber foco e a cada
minuto enquanto visível. Um `401` tenta renovar uma única vez. Web Locks
serializa operações entre abas e uma Promise compartilha renovações simultâneas
na mesma aba. BroadcastChannel comunica login/logout sem transmitir tokens.

Com o PostgreSQL disponível e a migration aplicada:

```sh
npm run test:auth
```

A suíte usa HTTP real e Prisma, cria um usuário temporário com email exclusivo
e o remove junto com suas sessões ao terminar. Não substitui o banco por mocks.
O teste não é incluído no build da API.

Para a verificação de navegador, deixe `npm run dev` e um Chrome com a porta CDP
`9222` ativos. Exemplo no macOS, com perfil separado:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9222 --remote-debugging-address=127.0.0.1 \
  --user-data-dir=/private/tmp/devflow-auth-chrome about:blank
```

Em outro terminal:

```sh
npm run test:auth:browser
```

O script abre um contexto isolado, valida formulários, sete rotas privadas,
reload, rotação, concorrência em duas abas, logout, teclado e responsividade.
As capturas ficam em `/private/tmp/devflow-stage3` (ajustável com
`AUTH_SCREENSHOT_DIR`). O usuário e contexto de teste são removidos ao terminar.
Não execute testes contra banco de produção.

Publicação exige HTTPS, `NODE_ENV=production`, uma chave `JWT_SECRET` própria,
`APP_ORIGIN` exata e encaminhamento de `/api` na mesma origem do frontend.
O limitador de tentativas é em memória por processo; qualquer futura configuração
de proxy deve definir a confiança no proxy de forma restrita, conforme a topologia.

## Histórico: validação da Etapa 1

Verificações realizadas com Node.js 24.13.0 e npm 11.6.2:

| Verificação                          | Resultado                                                                                                  |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| Instalação reproduzível com `npm ci` | Aprovada                                                                                                   |
| `npm run check`                      | Prisma válido, lint sem warnings, tipos, formatação e builds aprovados                                     |
| `npm audit`                          | Zero vulnerabilidades reportadas após os ajustes das dependências                                          |
| `npm run dev` e proxy `/api`         | Inicialização e resposta HTTP `200` confirmadas                                                            |
| `npm start`                          | API compilada inicia e responde ao health check                                                            |
| Configuração inválida de porta       | Rejeitada antes de iniciar a API                                                                           |
| Rota inexistente                     | `404` com erro em JSON                                                                                     |
| Banco indisponível                   | Prontidão `503` e diagnóstico com código de saída `1`, sem credenciais                                     |
| Compose                              | Sintaxe YAML e estrutura básica verificadas estaticamente                                                  |
| Git                                  | `.env`, dependências, builds e client gerado ignorados; credencial local ausente dos arquivos versionáveis |

Na validação original da Etapa 1, Docker e PostgreSQL não estavam instalados no ambiente. Portanto, não foi
executado `docker compose config`, não foi iniciado um container e não foi
confirmada uma conexão bem-sucedida com o banco. Os comandos de migration foram
verificados com `--help`, sem aplicar alterações. Para concluir a verificação
operacional do banco depois, execute `npm run db:up` e `npm run db:check`.

## Referências técnicas

- [Vite: instalação e runtime](https://vite.dev/guide/)
- [Tailwind CSS com Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Prisma Client e adaptador PostgreSQL](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction)

## Verificações de refinamento

Com API, frontend e Chrome/CDP locais ativos, execute `npm run test:refinement:browser`.
O script verifica dez rotas, reload/deep links, oito larguras entre 320 e 1440 px,
foco, Escape, envio único e invalidação de caches. `-- --interactions` limita a
execução aos cenários de interação. Complemente com `test:auth:browser`,
`test:portal:browser` e `test:portal:privacy`.

O build do frontend seleciona explicitamente React de produção, mesmo quando o
`.env` compartilhado usa `NODE_ENV=development` para a API local. Ele também
rejeita a inclusão acidental do runtime de desenvolvimento do React. Consulte
o [relatório de refinamento](docs/etapa-11-refinamento.md) para medições e validações.

## Landing pública

Com Vite e Chrome/CDP na porta 9222, execute `node scripts/landing-browser-check.mjs`.
Para validar o preview, use `LANDING_ORIGIN=http://127.0.0.1:4173` com o mesmo comando.
O teste usa um contexto isolado e respostas de API simuladas, sem alterar o banco.
Valida oito larguras, CTAs, teclado, menu, reduced motion, isolamento dos chunks,
deep links protegidos e Portal separado. Execute também `npm run test:portal:privacy`.

A Landing usa capturas reais e fictícias apenas nos dados: Dashboard no Hero e
seções visuais de Kanban, Financeiro e Portal. Dimensões, pesos, bundle, dados demo
e privacidade estão no [relatório da Landing](docs/landing-publica.md). Não houve deploy.
