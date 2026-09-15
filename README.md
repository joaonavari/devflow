# DevFlow

Plataforma full stack para freelancers gerenciarem clientes, projetos, tarefas,
horas e recebimentos. Desenvolvimento incremental para portfólio profissional.

## Estado atual: Etapa 3 — Autenticação

- Monorepo com npm workspaces: `frontend` e `backend`.
- React, TypeScript e Vite, com Tailwind CSS e layout autenticado responsivo.
- Express com TypeScript, health check e diagnóstico de conexão com PostgreSQL.
- Prisma com `User`, `AuthSession` e migration aplicada ao PostgreSQL.
- ESLint com verificação de tipos, Prettier e scripts compartilhados.
- Cadastro, login, logout, restauração e rotação de sessão integrados à API real.
- Rotas visuais privadas para dashboard, projetos, clientes, tarefas, financeiro, horas e configurações.

CRUD de negócio, Kanban, gráficos, portal do cliente e CI/CD não fazem parte desta
entrega. As páginas internas continuam sendo os placeholders aprovados da Etapa 2.
Consulte o [relatório da Etapa 3](docs/etapa-3-autenticacao.md) para decisões,
arquivos, revisão de segurança e resultados de validação.

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

O schema define o provider PostgreSQL, `User` e `AuthSession`. A migration
`20260915024133_stage3_authentication` cria as tabelas, índices e relação. O
Prisma está fixado na versão 7.10.0, com o adaptador PostgreSQL da mesma
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

Esta etapa utiliza uma migration real. Não usa `db push`, seed nem tabelas
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
│   │   ├── components/   # Navegação e componentes usados pela base visual
│   │   ├── layouts/      # Estrutura autenticada responsiva
│   │   ├── auth/         # Estado de sessão, cliente HTTP e proteção de rotas
│   │   ├── pages/        # Login, cadastro, placeholders e página não encontrada
│   │   ├── routes/       # Definição das rotas e metadados da navegação
│   │   ├── styles/       # Tokens centralizados do design system
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts    # React, Tailwind e proxy local
│   └── tsconfig.json
├── backend/
│   ├── prisma/           # Schema e migration de autenticação
│   ├── src/
│   │   ├── config/       # Ambiente e client Prisma
│   │   ├── controllers/  # Respostas HTTP, autenticação e cookies
│   │   ├── middlewares/  # Autenticação, origem/CSRF e erros
│   │   ├── routes/       # Health check e autenticação
│   │   ├── scripts/      # Diagnóstico de conexão
│   │   ├── services/     # Diagnóstico, credenciais e sessões
│   │   ├── tests/        # Testes HTTP com PostgreSQL real
│   │   ├── validators/   # Schemas de entrada Zod
│   │   ├── app.ts        # Composição do Express
│   │   └── server.ts     # Porta HTTP e encerramento
│   ├── prisma.config.ts
│   ├── tsconfig.json
│   └── tsconfig.build.json
├── compose.yaml
├── .env.example
├── eslint.config.mjs
├── tsconfig.base.json
├── package.json
└── package-lock.json
```

Pastas e componentes são criados conforme necessidades reais. A configuração
compartilhada ativa TypeScript estrito; o backend usa módulos ESM com resolução
NodeNext, e o frontend usa a resolução do bundler Vite. Dependências de autenticação
e formulários foram adicionadas na Etapa 3; gráficos e Kanban continuam fora do escopo.

## Base visual

As rotas abaixo usam o mesmo layout e exibem conteúdo temporário:

- `/dashboard`
- `/projetos`
- `/clientes`
- `/tarefas`
- `/financeiro`
- `/horas`
- `/configuracoes`

A raiz redireciona para `/dashboard`. Visitantes são encaminhados para `/login`;
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
