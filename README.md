# DevFlow

Plataforma full stack para freelancers gerenciarem clientes, projetos, tarefas,
horas e recebimentos. Desenvolvimento incremental para portfólio profissional.

## Estado atual: Etapa 2 — Base Visual

- Monorepo com npm workspaces: `frontend` e `backend`.
- React, TypeScript e Vite, com Tailwind CSS e layout autenticado responsivo.
- Express com TypeScript, health check e diagnóstico de conexão com PostgreSQL.
- Prisma configurado, ainda sem entidades de negócio ou migrations.
- ESLint com verificação de tipos, Prettier e scripts compartilhados.
- Rotas visuais para dashboard, projetos, clientes, tarefas, financeiro, horas e configurações.

Autenticação, dados reais, CRUD, Kanban, gráficos, portal do cliente, E2E e CI/CD
não fazem parte desta entrega. A modelagem de negócio será adicionada nas
respectivas etapas.

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

O Vite encaminha `/api` para a API local. Assim, o frontend usa URLs relativas,
sem precisar de CORS na fundação. `API_PORT` é lido pelo proxy; reinicie os processos
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

## Prisma e futuras migrations

```sh
npm run db:validate
npm run db:generate
```

O schema inicial define somente o provider PostgreSQL e o gerador do client. O
Prisma está fixado na versão estável 7.10.0, com o adaptador PostgreSQL da mesma
versão. O client gerado fica em `backend/src/generated/prisma/`, ignorado pelo Git,
e é incluído na compilação do backend.

Depois de adicionar modelos, em uma etapa futura e com o banco disponível:

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

Nenhuma migration é necessária nesta etapa. Não há `db push`, seed ou criação
antecipada de tabelas. Os scripts apenas preparam o fluxo para as próximas etapas.

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
│   │   ├── pages/        # Placeholders e página não encontrada
│   │   ├── routes/       # Definição das rotas e metadados da navegação
│   │   ├── styles/       # Tokens centralizados do design system
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts    # React, Tailwind e proxy local
│   └── tsconfig.json
├── backend/
│   ├── prisma/           # Schema; migrations somente em etapas futuras
│   ├── src/
│   │   ├── config/       # Ambiente e client Prisma
│   │   ├── controllers/  # Respostas HTTP do health check
│   │   ├── middlewares/  # Tratamento centralizado de erros
│   │   ├── routes/       # Rotas do health check
│   │   ├── scripts/      # Diagnóstico de conexão
│   │   ├── services/     # Consulta de diagnóstico
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
NodeNext, e o frontend usa a resolução do bundler Vite. Não há dependências de
autenticação, formulários, gráficos ou Kanban instaladas antecipadamente.

## Base visual

As rotas abaixo usam o mesmo layout e exibem conteúdo temporário:

- `/dashboard`
- `/projetos`
- `/clientes`
- `/tarefas`
- `/financeiro`
- `/horas`
- `/configuracoes`

A raiz redireciona para `/dashboard`. Endereços desconhecidos exibem uma página
de erro dentro do layout, com retorno para o dashboard.

Os tokens visuais ficam em `frontend/src/styles/tokens.css`: paleta, tipografia,
escala de espaçamento, raios, sombra, breakpoint, tamanho mínimo dos controles e
foco. A fonte variável Inter é servida pelo próprio frontend. O azul `#3B82F6`
identifica seleção, links e foco; ele não é usado como decoração de superfície.

Em telas a partir de 1024 px, a sidebar permanece visível. Abaixo desse tamanho,
um botão de 44 px abre a navegação em um diálogo modal nativo, que gerencia foco,
teclado e fechamento com Escape. O conteúdo usa gutters fluidos e não depende de
larguras fixas. As transições são desativadas quando o sistema solicita movimento
reduzido.

## Validação da Etapa 1

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

Docker e PostgreSQL não estavam instalados no ambiente. Portanto, não foi
executado `docker compose config`, não foi iniciado um container e não foi
confirmada uma conexão bem-sucedida com o banco. Os comandos de migration foram
verificados com `--help`, sem aplicar alterações. Para concluir a verificação
operacional do banco depois, execute `npm run db:up` e `npm run db:check`.

## Referências técnicas

- [Vite: instalação e runtime](https://vite.dev/guide/)
- [Tailwind CSS com Vite](https://tailwindcss.com/docs/installation/using-vite)
- [Prisma Client e adaptador PostgreSQL](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/introduction)
