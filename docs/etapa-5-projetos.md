# Etapa 5 — Projetos

Implementação concluída sobre as Etapas 1–4 aprovadas, sem alterar o contrato de
autenticação e sem antecipar Tasks, Kanban, Horas, Financeiro ou Dashboard.

## Estado inicial

O workspace iniciou limpo. A arquitetura já possuía controllers finos, validação
Zod, services Prisma com ownership, PostgreSQL real, TanStack Query por usuário,
React Hook Form e páginas responsivas de Clientes. Esses padrões foram reutilizados.

## Modelo e migration

`Project` possui UUID, `userId`, `clientId`, nome, descrição opcional, status,
datas, orçamento, progresso, arquivamento e timestamps. As relações são
`User 1:N Project` e `Client 1:N Project`.

O enum `ProjectStatus` usa `PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED` e
`CANCELLED`. Os defaults são `PLANNING`, orçamento zero e progresso zero.

A migration real `20260915174001_stage5_projects` cria tabela, enum, índices e
chaves estrangeiras. Também cria constraints PostgreSQL para:

- `budget >= 0`;
- `progress BETWEEN 0 AND 100`;
- `dueDate` ausente ou igual/posterior a `startDate`.

O vínculo com usuário usa cascade. O vínculo com cliente usa restrict, reforçando a
regra do service contra exclusão de cliente associado. Não foi usado `db push`.

## Contratos de valores e datas

O Prisma usa `Decimal(12,2)`. A API aceita e devolve orçamento como string decimal
com duas casas, evitando transformar o valor persistido em ponto flutuante. A UI
converte apenas para apresentação localizada e não grava símbolo ou moeda fixa.

Datas conceituais usam PostgreSQL `DATE` e strings `YYYY-MM-DD`. O backend cria a
representação Prisma em meia-noite UTC e devolve somente a parte da data. O frontend
formata com timezone UTC, por isso uma data escolhida não muda de dia conforme o
fuso do navegador. `createdAt`, `updatedAt` e `archivedAt` continuam timestamps e
são exibidos no fuso do usuário.

## API, ownership e proteção do cliente

| Método e endpoint                           | Sucesso |
| ------------------------------------------- | ------- |
| `GET /api/v1/projects`                      | `200`   |
| `POST /api/v1/projects`                     | `201`   |
| `GET /api/v1/projects/:projectId`           | `200`   |
| `PATCH /api/v1/projects/:projectId`         | `200`   |
| `PATCH /api/v1/projects/:projectId/archive` | `200`   |
| `PATCH /api/v1/projects/:projectId/restore` | `200`   |
| `DELETE /api/v1/projects/:projectId`        | `204`   |

O `userId` vem somente de `response.locals.user`. Schemas estritos rejeitam
`userId` no corpo. Leitura, update, archive, restore e delete sempre usam
`projectId + userId`; recurso inexistente ou alheio retorna o mesmo `404`.

Criação exige cliente ativo com `clientId + userId`. Troca de cliente também exige
cliente ativo do mesmo usuário. Cliente inexistente, alheio ou arquivado recebe o
mesmo comportamento seguro. O projeto pode manter seu vínculo atual quando esse
cliente for arquivado depois, inclusive durante outras edições.

## Clientes arquivados e exclusão

Clientes arquivados não aparecem no seletor de criação e não aceitam novas
associações. Projetos existentes continuam acessíveis e exibem o cliente arquivado.

`DELETE /api/v1/clients/:clientId` agora conta projetos dentro do mesmo usuário. Se
existir associação, retorna `409 CLIENT_HAS_PROJECTS` com mensagem utilizável. O
arquivamento do cliente continua permitido. A foreign key `RESTRICT` protege a
mesma regra contra uma corrida entre verificação e exclusão.

## Listagem, busca e filtros

`GET /projects` retorna `{ data, meta: { count } }`. O padrão é `view=active` e
`view=archived` mostra arquivados. `status` filtra pelo enum, `clientId` pelo cliente
e `q` procura nome do projeto ou nome do cliente de forma case-insensitive. Todos os
predicados incluem o usuário autenticado. A ordenação usa atualização decrescente e
ID crescente como desempate.

## Frontend e TanStack Query

`/projetos` tem tabela estruturada no desktop e cards próprios no mobile. Inclui
busca, filtros, ativos/arquivados, criação e estados de loading, vazio, nenhum
resultado e erro.

`/projetos/:projectId` mostra cliente, status, progresso manual, datas, orçamento e
atualização. Permite editar, arquivar, restaurar e excluir com confirmação. O
progresso usa barra discreta e texto numérico. Não há Tasks, Kanban, horas ou
financeiro.

Os formulários usam React Hook Form e Zod. As query keys incluem o ID do usuário e
separam listas, filtros e detalhes. Create, update, archive, restore e delete
invalidam somente o domínio necessário. O fetch autenticado da Etapa 3 foi
reutilizado sem criar outro fluxo de sessão.

## Testes

`npm run test:projects` executa 28 testes em PostgreSQL real. A suíte cria dois
usuários, clientes e projetos independentes. O usuário A recebe `404` em GET,
PATCH, ARCHIVE, RESTORE e DELETE do Projeto B. Também não consegue criar projeto
com Cliente B nem trocar Projeto A para Cliente B.

Foram cobertos criação, autenticação, busca por projeto/cliente, status, cliente,
validação de datas, budget, progresso, arquivamento, restauração, exclusão, cliente
arquivado e bloqueio da exclusão do cliente associado.

O Chrome percorre cadastro/login, criação de cliente, criação de projeto, busca,
filtros, detalhe, edição, mudança de status/progresso, reload, bloqueio `409`,
arquivamento, arquivados, restauração e exclusão. Também valida foco, Escape,
responsividade entre 320–1440 px, ausência de overflow, exceções e loops.

## Validações finais

| Validação                   | Resultado                    |
| --------------------------- | ---------------------------- |
| Prisma validate             | Aprovado                     |
| Prisma generate             | Aprovado                     |
| Migration no PostgreSQL     | Aplicada; nenhuma pendente   |
| `npm run db:check`          | Aprovado                     |
| `npm run test:auth`         | Aprovado (17/17)             |
| `npm run test:clients`      | Aprovado (23/23)             |
| `npm run test:projects`     | Aprovado (28/28)             |
| `npm run test:auth:browser` | Aprovado                     |
| `npm run lint`              | Aprovado                     |
| `npm run typecheck`         | Aprovado                     |
| `npm run build`             | Aprovado                     |
| `npm run format:check`      | Aprovado                     |
| `git diff --check`          | Aprovado                     |
| `npm audit`                 | Aprovado; 0 vulnerabilidades |

## Limitações

- A listagem ainda não pagina; o envelope permite adicionar paginação depois.
- A busca usa `contains`; indexação textual deve ser guiada por volume e métricas.
- O modelo não possui moeda porque múltiplas moedas estão fora do MVP. O valor
  permanece decimal e sem símbolo no contrato.
- A validação visual automatizada usa Chrome headless; outros navegadores e leitores
  de tela não foram executados.
- O build mantém um aviso não bloqueante para o chunk principal de 728,69 kB; code
  splitting pode ser tratado em uma melhoria específica.

**ETAPA 5 — PROJETOS concluída. NÃO houve avanço para a ETAPA 6.**
