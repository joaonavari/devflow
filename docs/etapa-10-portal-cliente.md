# Etapa 10 — Portal do Cliente

## Estado inicial e escopo

`git status` executado antes de qualquer alteração: branch `main`, sincronizada com
`origin/main`, workspace limpo. Etapas 1 a 9 preservadas. O PostgreSQL local estava
parado e foi iniciado com `npm run db:up`; não houve reset do banco.

Entrega limitada a um portal público somente leitura e sua administração no
projeto. Não foram implementados conta/login de cliente, comentários, chat,
arquivos, aprovações, pagamentos públicos, notificações ou email. Nenhum commit,
push ou trabalho da Etapa 11 foi realizado.

## Histórico da retomada anterior

Na retomada, `main` continuava sincronizada com `origin/main`, com 14 arquivos
versionados modificados e 20 arquivos novos da Etapa 10, sem commit. Todo o diff,
incluindo os arquivos novos, foi inspecionado antes de editar. Já existiam schema,
migration, APIs, UI administrativa/pública, testes HTTP e de navegador e um
relatório parcial. A migration foi preservada integralmente e seu estado aplicado
foi confirmado novamente; não houve migration adicional.

O que faltava: concluir o teste do portal no navegador, resolver o overflow
administrativo a 320 px, revisar as proteções HTTP/logs e fechar a documentação e
uma bateria consolidada de validação.

Concluído na retomada:

- Contenção dos rótulos acessíveis absolutos dentro do Kanban, com uma regra
  `position: relative` no contêiner de rolagem. Isso elimina o overflow da página
  sem remover a rolagem horizontal interna do quadro.
- Espaçamento e seletor de validade da administração do portal, além da quebra da
  linha de controles das etapas em telas pequenas.
- Redação de credenciais nos logs do Vite: o proxy padrão inclui a URL em erros;
  um logger sanitiza o segmento do token antes da emissão.
- Correção do header final do HTML do Vite, que sobrescrevia o middleware com
  `no-cache`. Desenvolvimento e preview agora configuram `no-store` também no
  servidor; a API pública mantém a política própria em todas as respostas.
- Teste HTTP adicional do HTML em dev/preview e de falha real 502 do proxy, com
  verificação dos logs; dados e tokens de teste são sintéticos e não persistidos.
- Teste de acesso cruzado reforçado contra um portal alheio já ativo, confirmação
  de exclusão de etapa pela UI e remoção de instrumentação temporária de diagnóstico.

## Estado encontrado nesta retomada final

Antes de editar, foram executados `git status` e a inspeção integral dos diffs
versionados e dos arquivos novos: 15 arquivos versionados modificados e 21 novos,
sem alterações staged. Schema, migration, backend, frontend, testes e documentação
já estavam implementados, incluindo as correções descritas na retomada anterior.
Esse trabalho foi preservado, sem recriação ou duplicação.

A migration existente foi confirmada como aplicada com `prisma migrate status`:
7 migrations e banco atualizado. Nenhuma migration foi criada ou alterada agora.

Complementos desta execução:

- Headers de privacidade e máscara de token nos logs do Vite passaram a aceitar
  variações de maiúsculas/minúsculas, coerentemente com as rotas públicas.
- Teste real do proxy ampliado para essas variações de URL.
- Encerramento do teste de privacidade corrigido: sem varredura de dependências
  para o teste que só consulta HTML, timeout nos requests e fechamento pela API
  completa do Vite. O processo anterior ficou aguardando no cleanup; após a
  correção, apenas esse check foi repetido e passou.
- Testes HTTP adicionais contra mutações públicas, seleção de outro projeto por
  query/caminho e uso do token público como autorização administrativa.
- Alteração de visibilidade de tarefas/etapas pela API, com bloqueio ao outro
  proprietário e confirmação de remoção imediata do DTO público.
- Cenário de expiração no navegador, verificando que atualizar remove o conteúdo
  já exibido e que uma nova geração volta a permitir acesso.
- Fechamento da revisão de segurança e execução consolidada dos checks finais.

## Arquivos da entrega

Novos no workspace em relação ao HEAD (todos já existiam nesta retomada):

- Banco: `backend/prisma/migrations/20260917204529_stage10_client_portal/migration.sql`.
- Backend: `backend/src/controllers/portal.controller.ts`,
  `backend/src/routes/portal.routes.ts`, `backend/src/validators/portal.schemas.ts`,
  `backend/src/services/portal.service.ts`, `portal-error.ts`,
  `portal-project-lock.ts` e `project-stage.service.ts` no mesmo diretório.
- Testes: `backend/src/tests/portal-test-support.ts`, `portal.test.ts` e
  `project-stage.test.ts` no mesmo diretório; `scripts/portal-browser-check.mjs` e
  `scripts/portal-privacy-check.mjs`.
- Frontend: `frontend/src/components/portal/ProjectPortal.tsx`, `ProjectStages.tsx`
  e `StageDialog.tsx` no mesmo diretório; `frontend/src/pages/PortalPage.tsx`,
  `frontend/src/portal/portal-api.ts`, `public-portal-api.ts` no mesmo diretório e
  `frontend/src/styles/portal.css`.
- Documentação: `docs/etapa-10-portal-cliente.md`.

Arquivos versionados alterados pela Etapa 10:

- `README.md`, `package.json`, `backend/package.json`, `backend/prisma/schema.prisma`.
- `backend/src/app.ts`, `backend/src/middlewares/error-handler.ts`,
  `backend/src/routes/project.routes.ts`, `backend/src/services/project.service.ts`.
- `frontend/index.html`, `frontend/vite.config.ts`, `frontend/src/App.tsx`,
  `frontend/src/components/tasks/TaskDialog.tsx`,
  `frontend/src/pages/ProjectDetailPage.tsx`, `frontend/src/styles.css` e
  `frontend/src/styles/tasks.css`.

Nesta execução final foram editados somente `frontend/vite.config.ts`,
`backend/src/tests/portal.test.ts`, os dois scripts de portal e este relatório.

## Schema, migration e modelos

Migration real criada e aplicada: `20260917204529_stage10_client_portal`.

`PortalLink` possui `id` UUID, `projectId` UNIQUE, `tokenHash` UNIQUE CHAR(64),
`expiresAt`, `revokedAt`, `createdAt` e `updatedAt`. Datas usam TIMESTAMPTZ(3).
A relação escolhida é **Project 1:1 PortalLink opcional**: uma linha por projeto,
substituída na rotação. Não existe histórico de credenciais nem múltiplos links
ativos. A exclusão do projeto remove o link por cascade.

`ProjectStage` possui `id` UUID, `projectId`, `title` (160 caracteres), `status`,
`position`, `isClientVisible` (false por padrão), `createdAt` e `updatedAt`.
Status: `PENDING`, `IN_PROGRESS`, `COMPLETED`. Índice por projeto, posição e ID;
relação Project 1:N ProjectStage com cascade. Tarefas já possuíam
`isClientVisible`, portanto não foi preciso migrá-las.

## Geração, validade, revogação e rotação

- `crypto.randomBytes(32)`: 256 bits de entropia, codificação base64url de 43 caracteres.
- SHA-256 calculado no servidor; apenas o hash é persistido.
- O POST retorna a URL completa uma única vez, construída com `APP_ORIGIN`.
- O GET administrativo retorna apenas `active` e metadados de datas, sem hash,
  token, URL anterior ou IDs do registro.
- Validades aceitas: 7, 30 e 90 dias; padrão 30. Não há opção sem expiração.
- DELETE preenche `revokedAt`; novos requests públicos passam a responder 404.
- Novo POST substitui o hash por uma credencial independente e invalida o anterior.
- Operações administrativas de portal e etapas usam transações e lock da linha
  do projeto (`SELECT ... FOR UPDATE` parametrizado), serializando concorrência.

O link aparece apenas em estado local React enquanto o componente está montado.
Não é armazenado em cookies, Web Storage, query administrativa ou cache de
mutação. Ao recarregar ou sair da página, é preciso gerar outro link se ele não
foi copiado. A UI explica que o link é uma credencial e descreve os dados compartilhados.
A cópia para o clipboard ocorre somente por ação explícita do proprietário.

## API administrativa e ownership

Todos os endpoints abaixo exigem a sessão e as proteções de origem/CSRF existentes.
A identidade vem de `response.locals.user`; bodies Zod estritos rejeitam campos
extras de ownership e credenciais. Recurso de outro usuário retorna 404.

| Método e endpoint                            | Resultado                                           |
| -------------------------------------------- | --------------------------------------------------- |
| `GET /api/v1/projects/:projectId/portal`     | 200 com estado e metadados                          |
| `POST /api/v1/projects/:projectId/portal`    | 201 com estado e nova URL; `{ "validityDays": 30 }` |
| `DELETE /api/v1/projects/:projectId/portal`  | 204; revogação idempotente                          |
| `GET /api/v1/projects/:projectId/stages`     | 200 com etapas em ordem                             |
| `POST /api/v1/projects/:projectId/stages`    | 201 com nova etapa                                  |
| `PATCH /api/v1/project-stages/:stageId`      | 200; título, status e/ou visibilidade               |
| `PATCH /api/v1/project-stages/:stageId/move` | 200; `{ "position": 0 }`                            |
| `DELETE /api/v1/project-stages/:stageId`     | 204; exclusão e normalização da ordem               |

As etapas têm posições sequenciais a partir de zero. Mover além do comprimento
leva ao fim; excluir normaliza posições. PATCH parcial preserva os campos omitidos.
Todas as operações de etapas resolvem ownership pela relação com Project.
As proteções já existentes para alteração de visibilidade de Task foram preservadas.

## API pública e DTO mínimo

`GET /api/v1/portal/:token` não monta `authenticate`, não lê sessão e não emite
cookies. A autorização ocorre exclusivamente por formato/hash do token, validade,
revogação e projeto não arquivado. Um usuário logado recebe exatamente o mesmo
contrato público que um visitante.

Formato inválido, hash desconhecido, token adulterado, expirado, revogado ou projeto
arquivado retornam **404**, com o mesmo corpo:

```json
{
  "error": {
    "code": "PORTAL_UNAVAILABLE",
    "message": "Este link não está disponível ou expirou."
  }
}
```

O sucesso retorna `{ data: { project, tasks, stages } }`, com allowlist explícita:

| Objeto     | Campos públicos                                                        |
| ---------- | ---------------------------------------------------------------------- |
| `project`  | `name`, `description`, `status`, `progress`, `startDate`, `dueDate`    |
| `tasks[]`  | `title`, `description`, `status`, `priority`, `dueDate`, `completedAt` |
| `stages[]` | `title`, `status`                                                      |

Datas conceituais são serializadas como `YYYY-MM-DD`; `completedAt` é um instante
ISO. Nenhum DTO administrativo é reutilizado. O select Prisma busca apenas os
campos necessários; a montagem explícita da resposta exclui até o ID e contagens
usados internamente no cálculo. `budget`, Payments, TimeEntries, Client, User,
AuthSession, emails, hashes, posições e flags administrativas não são enviados.

Tasks e stages são filtrados no banco por `isClientVisible: true`, vinculados
exclusivamente ao projeto resolvido pelo link. Marcar uma tarefa como visível
compartilha também sua descrição, informação explícita no formulário.

O progresso MANUAL usa o valor do projeto. AUTO reutiliza a mesma função
`calculatedProgress` da administração, contando todas as tarefas do projeto,
inclusive internas. Só o percentual agregado é compartilhado; os detalhes das
tarefas internas continuam ausentes. Não há um cálculo exclusivo para o cliente.

## Arquivamento e restauração

Arquivar atualiza o projeto e revoga seu link na **mesma transação**. O update da
linha do projeto serializa com a geração de credenciais. Além disso, a leitura
pública exige `archivedAt: null`. Restaurar não remove `revokedAt` e não reativa
credenciais antigas: o proprietário precisa gerar novo link explicitamente.

Projetos arquivados permitem listar etapas e consultar estado administrativo,
mas criação/edição/reordenação/exclusão de etapas e geração de link retornam 409.
Revogação continua permitida, inclusive em projeto arquivado.

## HTTP, cache, robots, referrer e rate limiting

A API pública aplica os headers antes do limiter e da validação:

```http
Cache-Control: no-store
Pragma: no-cache
Referrer-Policy: no-referrer
X-Robots-Tag: noindex, nofollow
X-Content-Type-Options: nosniff
```

O HTML inicial inclui metas `referrer=no-referrer` e `robots=noindex, nofollow`,
antes do carregamento da aplicação; a página pública também declara esses metas.
O Vite aplica os headers de privacidade a `/portal/*` e `/api/v1/portal/*` em
desenvolvimento e preview. `Referrer-Policy: no-referrer` e `Cache-Control: no-store`
também são configurados no servidor para impedir que o middleware de HTML
sobrescreva a política. Isso abrange os recursos estáticos locais de dev/preview.

Na inspeção do Chrome, uma requisição de fonte local ainda carregava a URL do
portal no Referer. A página pública e seu fallback passaram a usar fontes do
sistema, eliminando esse carregamento. Não há fontes, analytics, imagens ou outros
recursos de terceiros no portal. O fetch público explicita `credentials: 'omit'`,
`cache: 'no-store'` e `referrerPolicy: 'no-referrer'`.

Folhas CSS externas possuem política de referrer própria, como documentado pela
[MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy).
A validação de navegador observa o header efetivamente transmitido, incluindo os
eventos de rede adicionais do Chrome, sem registrar a URL credencial.

O limiter público em memória aceita **60 requests por minuto por IP**, com headers
padronizados e resposta JSON 429/Retry-After. Ele não usa token como chave, evitando
armazenar a credencial no limiter. O limite é por processo; um deploy com múltiplas
instâncias exigirá armazenamento compartilhado. A configuração de confiança em
proxy não foi ampliada. O logger do Vite mascara tokens em mensagens de info,
warning e erro, incluindo falhas reais do proxy; nenhum logger de requests foi
adicionado ao Express.

## Frontend administrativo e público

No projeto, `ProjectPortal` exibe estado, validade, geração/rotação, revogação,
link recém-gerado e cópia, além dos avisos de compartilhamento. `ProjectStages`
mostra lista ordenada, status, visibilidade, edição, exclusão com confirmação e
botões de subir/descer. Formulário usa React Hook Form/Zod e diálogo nativo, com
Escape, foco inicial e retorno ao botão de origem.

`/portal/:token` é uma rota lazy fora de AuthProvider e AppLayout. Não há sidebar,
navegação administrativa, descoberta de sessão ou renovação de cookies.
Queries administrativas de estado e stages possuem chaves separadas por usuário e
projeto. A query pública é separada por token, sem persistência, com `gcTime: 0`,
sem retry automático, e atualização ao montar, recuperar foco e acionar Atualizar.
Uma falha em novo request oculta dados anteriormente carregados.

Direção visual aplicada com a skill `ui-design`:

1. Público: clientes acompanhando uma entrega, sem ferramentas administrativas.
2. Tom: sóbrio, direto e profissional.
3. Composição: resumo amplo, progresso lateral e seções com títulos alinhados.
4. Tipografia: sans do sistema no portal, com nome do projeto em destaque.
5. Cores: tokens dark existentes, azul para progresso e estados discretos.
6. Movimento: feedback funcional, respeitando a preferência de movimento reduzido existente.
7. Elemento distintivo: timeline vertical numerada com marcos e estado de conclusão.

Framework preservado: React + TypeScript + Vite. Sem novas dependências, Next.js,
biblioteca de gráficos, imagens geradas ou referências externas de componentes.

## Testes de segurança, vazamento e isolamento

A primeira rodada direcionada ocorreu antes da implementação das telas, logo após
a camada de token/ownership e a migration. Os testes usam HTTP e PostgreSQL reais,
com dois usuários, clientes e projetos independentes, removidos ao finalizar.

`test:portal` verifica geração própria, 401 sem sessão, 404 entre proprietários,
entropia/formato, hash persistido e ausência de token bruto, allowlist exata em
cada nível da resposta, isolamento com sessão alheia, validade, adulteração,
revogação, rotação, arquivamento/restauração, concorrência e limiter.

O cenário de vazamento inclui orçamento, cobrança, horas, tarefas privadas/públicas,
etapas privadas/públicas e dados de outro projeto. Os asserts verificam a resposta
**do backend**, inclusive ausência de campos e valores sensíveis, IDs, emails e
hashes. Testes de headers abrangem sucesso, 404 e cache no 429.

`test:stages` verifica criação privada por padrão, validação, todos os acessos
cruzados, PATCH parcial, status/visibilidade, ordenação, exclusão, criação
concorrente e bloqueio por arquivamento.

## Regressão e validações

| Verificação                     | Resultado                                   |
| ------------------------------- | ------------------------------------------- |
| Auth                            | 17 testes aprovados                         |
| Clients                         | 23 testes aprovados                         |
| Projects                        | 28 testes aprovados                         |
| Tasks                           | 18 testes aprovados                         |
| TimeEntries                     | 21 testes aprovados                         |
| Payments                        | 22 testes aprovados                         |
| Dashboard                       | 13 testes aprovados                         |
| Portal                          | 16 testes aprovados                         |
| Stages                          | 7 testes aprovados                          |
| Total HTTP                      | 165 testes aprovados, zero falhas           |
| Prisma validate / generate      | Aprovados                                   |
| Migration real / migrate status | Aplicada; 7 migrations, banco sincronizado  |
| db:check                        | SELECT 1 aprovado                           |
| npm audit                       | Zero vulnerabilidades                       |
| Navegador das etapas anteriores | Fluxo completo aprovado, sem exceções JS    |
| Navegador do portal             | Aprovado, incluindo expiração e 320–1440 px |
| Privacidade dev/preview         | Aprovada após correção do cleanup do teste  |
| npm run lint                    | Aprovado                                    |
| npm run typecheck               | Aprovado                                    |
| npm run build                   | Aprovado; aviso de bundle > 500 kB          |
| npm run format:check            | Aprovado                                    |
| git diff --check                | Aprovado                                    |

A rodada consolidada final confirmou os resultados HTTP acima. Lint, typecheck,
build, format:check, Prisma validate/generate e db:check passaram. O teste de
privacidade ficou preso no encerramento do servidor temporário; a correção foi
validada em repetição direcionada, sem repetir as suítes HTTP já aprovadas.
Os dois testes de navegador, migrate status e npm audit também passaram nesta
rodada. O script de privacidade corrigido passou novamente no lint direcionado;
após fechar o relatório, formatação e diff foram conferidos novamente. Não houve
falha funcional ou de segurança pendente. Logs da rodada estão em
`/private/tmp/devflow-stage10-validation`; a primeira execução de privacidade consta
como interrompida e seu resultado aprovado foi obtido na repetição isolada.

## Navegador da Etapa 10

Script: `npm run test:portal:browser`. Usa Chrome headless/CDP com dois contextos
isolados. Login, cliente, projeto, tarefas e etapas são criados pela UI; pagamentos
e horas privados são adicionados à fixture para validar ausência no portal.

Verifica geração/cópia, desaparecimento do link após reload, edição/ordenação,
foco, acesso sem sessão e com sessão administrativa, progresso MANUAL/AUTO,
visibilidade, ausência de dados sensíveis, ausência de auth requests/cookies e
Referer com token, metas de privacidade, reload, revogação, rotação, expiração e arquivamento
seguido de restauração. Viewports públicos: 320, 375, 768, 1024 e 1440 px. Administração também verificada
em 320, 375 e 1440 px, incluindo retorno do portal à sessão normal.

Capturas em `/private/tmp/devflow-stage10`, sem URL credencial. O clipboard de teste
é limpo após validar a cópia. Contas de teste e contextos são removidos ao final.

## Revisão final de segurança

| Pergunta                                | Resultado da revisão                                                                                                                                                                                 |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Token bruto persistido?              | Não. Apenas SHA-256 no banco; estado local em memória e URL de navegação.                                                                                                                            |
| 2. Token nos logs?                      | Sem logging de token na aplicação; Vite mascara credenciais, inclusive no erro real de proxy testado; script sanitiza mensagens de erro. Logs do futuro servidor/proxy precisam omitir a credencial. |
| 3. tokenHash retornado?                 | Não. Select administrativo e DTO público o excluem; asserts explícitos.                                                                                                                              |
| 4. Portal acessa outro projeto?         | Não. Relação resolvida pelo hash único; testes com dois proprietários.                                                                                                                               |
| 5. DTO possui campos administrativos?   | Não. Allowlist exata sem IDs, flags ou relações internas.                                                                                                                                            |
| 6. Tasks privadas vazam?                | Não. Filtro no banco e assert de ausência.                                                                                                                                                           |
| 7. Stages privados vazam?               | Não. Filtro no banco e assert de ausência.                                                                                                                                                           |
| 8. Budget vaza?                         | Não selecionado nem serializado.                                                                                                                                                                     |
| 9. Payments vazam?                      | Relação ausente do select/DTO.                                                                                                                                                                       |
| 10. TimeEntries vazam?                  | Relação ausente do select/DTO.                                                                                                                                                                       |
| 11. Proprietário vaza?                  | User, email, AuthSession e passwordHash ausentes.                                                                                                                                                    |
| 12. Revogado ainda autoriza?            | Não; 404 no próximo request.                                                                                                                                                                         |
| 13. Expirado ainda autoriza?            | Não; comparação de expiresAt no banco e 404.                                                                                                                                                         |
| 14. Link antigo funciona após rotação?  | Não; hash substituído, com testes concorrentes.                                                                                                                                                      |
| 15. Cache armazena resposta sensível?   | HTTP no-store e fetch no-store; sem persistência da query.                                                                                                                                           |
| 16. Referrer vaza token para terceiros? | Sem terceiros; API no-referrer, metas/headers e fontes do sistema. Verificação de rede no Chrome.                                                                                                    |
| 17. Motores podem indexar?              | noindex/nofollow em meta e header; não é autorização e não impede um agente malicioso com o link.                                                                                                    |

## Limitações e publicação futura

- A URL é uma credencial bearer: quem a receber consegue ler os campos permitidos.
  Ela pode permanecer no histórico do navegador e no clipboard após cópia explícita;
  não existe controle sobre redistribuição pelo destinatário.
- Revogar impede novos requests. Não apaga informações já vistas, copiadas ou
  capturadas. Sem polling: a tela revalida em reload, foco ou Atualizar.
- Nome/descrição do projeto e descrições de tarefas visíveis são publicados por
  decisão do proprietário; não existe uma descrição pública separada neste MVP.
- O agregado de progresso AUTO inclui tarefas internas sem revelar seu conteúdo.
- Sem paginação de tarefas/etapas no MVP, seguindo os domínios existentes.
- Limiter por IP/processo pode agrupar usuários atrás do mesmo NAT. Múltiplas
  instâncias precisarão compartilhar o limite.
- O build continua emitindo aviso de chunk inicial acima de 500 kB; o portal tem
  chunk próprio. Não foi realizada uma refatoração geral de bundles nesta etapa.
- O futuro host estático/CDN deve aplicar no-store e robots/referrer a `/portal/*`,
  manter HTTPS e mascarar/remover tokens de logs, tracing e analytics. Os headers
  do Vite não são configuração de um deploy de produção. Nenhum deploy foi feito.

ETAPA 10 — PORTAL DO CLIENTE concluída.
NÃO houve avanço para a ETAPA 11.
