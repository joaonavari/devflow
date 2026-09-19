# Etapa 11 — Refinamento

## Retomada e escopo

A Etapa 11 começou com a Etapa 10 versionada e o workspace limpo. Na retomada,
`git status` e o diff completo mostraram 44 arquivos rastreados alterados e sete
novos arquivos, ainda sem relatório desta etapa. Todo trabalho válido foi preservado.
Não houve commit, push, alteração de schema, nova migration ou avanço à Etapa 12.

Já estavam implementados: correção do runtime de produção no build, totais e
progresso do Dashboard, limpeza de cache por sessão, retorno ao deep link,
confirmações destrutivas, proteção contra submit concorrente, estados de erro,
Configurações somente leitura e headers da API. Os 15 testes de Dashboard e o
typecheck direcionado do frontend já haviam passado. Havia medições de bundle e
um teste de navegador interrompido por overflow de Clientes em 768 px.

Nesta retomada foram concluídos: diagnóstico e correção de responsividade,
restauração de foco sob StrictMode, reabertura após Escape, invalidação dos caches
de tarefas/horas ao arquivar/excluir projetos, testes de regressão, documentação
e validação consolidada. Docker estava parado; o container PostgreSQL existente
foi iniciado preservando seu volume. Os serviços de desenvolvimento foram retomados.

## Problemas concretos e correções

| Problema                                                                                    | Correção                                                                                                   |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `.env` da API com `NODE_ENV=development` selecionava React de desenvolvimento no build Vite | Script define produção antes de importar Vite e rejeita módulos React `.development.js` no bundle          |
| Horas do Dashboard somavam apenas os cinco projetos do ranking                              | Agregação própria do total, preservando ranking top 5 e ownership                                          |
| Dashboard ignorava progresso AUTO                                                           | Cálculo por total/concluídas, em consulta agrupada; MANUAL preservado; contagens internas removidas do DTO |
| Logout mantinha cache fresco da sessão anterior                                             | Limpeza de queries e mutations na troca de identidade, inclusive logout e sincronização entre abas         |
| Login perdia deep link de cliente/projeto                                                   | Retorno validado de pathname, busca e hash; sem redirects externos                                         |
| Sidebar perdia item ativo no detalhe                                                        | Correspondência de prefixo do NavLink                                                                      |
| Kanban refazia GET do projeto além da invalidação                                           | Removido callback de refetch redundante                                                                    |
| Filtros vazios geravam duas chaves para a mesma consulta de tarefas                         | Normalização de `projectId: ''`                                                                            |
| Arquivamento/exclusão deixava metadados antigos nos caches de tarefas/horas                 | Invalidação desses domínios junto aos projetos e pagamentos                                                |
| Dois submits antes da renderização podiam disparar duas mutations                           | Trava síncrona por formulário durante a operação assíncrona                                                |
| Troca de rota lazy podia retirar o shell e perder foco                                      | Suspense no Outlet e foco no h1 após carregamento; fallback no main                                        |
| Erro de chunk/renderização deixava tela quebrada                                            | Error boundary com mensagem genérica e recarregamento                                                      |
| Erro não JSON ou de contrato do portal podia aparecer como detalhe técnico                  | Mensagem segura; link gerado oculto se revalidação administrativa falhar                                   |
| Rotação/revogação/arquivamento podiam encerrar acesso sem confirmação                       | Dialog descreve o efeito e inicia foco em Cancelar                                                         |
| Clique na área interna vazia fechava dialog                                                 | Verificação das coordenadas do backdrop                                                                    |
| StrictMode perdia o elemento que abriu dialogs montados sob demanda                         | Opener preservado por elemento de dialog; restauração após desmontagem                                     |
| Escape/reabertura rápida disputavam evento nativo de fechamento nos cadastros               | Cancelamento controlado no estado React                                                                    |
| Erros de textarea/select sem relação acessível                                              | `aria-invalid`, `aria-describedby` e IDs nas mensagens                                                     |
| Labels absolutos das tabelas escapavam do scroll em tablet                                  | Contêineres posicionados, sem esconder overflow global                                                     |
| Filtros de tarefas excediam espaço com sidebar em 1024 px                                   | Linha única somente a partir de 80rem                                                                      |
| Nome longo expandia grid móvel de Clientes                                                  | Coluna `minmax(0, 1fr)`                                                                                    |
| Configurações exibia placeholder genérico                                                   | Dados já disponíveis: nome, email, fuso e BRL; edição explicitamente indisponível                          |
| Preflight não anunciava PATCH/DELETE                                                        | Lista alinhada aos métodos existentes                                                                      |
| Respostas antecipadas/rotas desconhecidas não tinham todos os headers                       | `no-store`, `nosniff`, `no-referrer` antes dos middlewares de API                                          |

## Bundle e performance

Medição inicial registrada em `/private/tmp/devflow-stage11/bundle-before.log`.
Os números abaixo são kB decimais informados pelo Vite; gzip não representa tempo
real de download. A comparação usa os mesmos fontes locais e dependências.

| Artefato              | Antes raw / gzip                  | Depois raw / gzip           |
| --------------------- | --------------------------------- | --------------------------- |
| Entry `index`         | 545,69 / 162,84                   | 384,43 / 118,77             |
| Runtime compartilhado | 70,10 / 24,87 (`jsx-dev-runtime`) | 8,77 / 3,33 (`jsx-runtime`) |
| Rota ProjectDetail    | 104,49 / 27,68                    | 85,98 / 25,90               |

Somando entry e runtime compartilhado carregado inicialmente: **615,79 → 393,20 kB**
(**−36,1%**); gzip **187,71 → 122,10 kB** (**−35,0%**). As fronteiras dos
chunks compartilhados mudaram; essa soma é mais comparável que o entry isolado.
CSS atual: 83,80 kB / 12,97 gzip. O build final não emite aviso de chunk >500 kB.
Logs finais: `/private/tmp/devflow-stage11-validation/frontend-build-recheck.log`.

A redução principal vem da seleção correta do React de produção, não de divisão
artificial para suprimir o aviso de 500 kB. As rotas já eram lazy; isso foi
preservado, incluindo portal separado e dependências de drag-and-drop no detalhe
do projeto. Configurações também usa lazy. Não foram acrescentadas dependências,
manualChunks, preloads globais ou abstrações de cache.

O Dashboard acrescenta consultas agregadas em número constante, não uma consulta
por projeto. Os componentes maiores preservam divisões locais coerentes; não foi
encontrada razão concreta para uma reorganização arquitetural.

## UX, acessibilidade e CSS

Direção visual preservada: React/Vite, Inter, superfícies escuras, azul de destaque,
hierarquia compacta de workspace e dados reais. Sem redesign, novas imagens ou
referências externas. Skill ui-design aplicada para manter consistência e validar
estados; nenhuma inspiração externa foi necessária.

Dialogs nativos mantêm conteúdo de fundo inerte, foco inicial, Escape e retorno ao
acionador; se o acionador for removido, foco volta ao título/main. Tab pode passar
pela interface do navegador, comportamento nativo, mas não por controles de fundo.
O Kanban mantém alternativa por controles de status e ordenação, além do drag.
Status continuam com texto, não apenas cor. Erros de recurso usam h1 acessível;
loading tem role=status; mensagens operacionais preservam alert/status.

Responsividade cobre 320, 360, 390, 430, 768, 1024, 1366 e 1440 px. Tabelas mantêm
scroll interno onde necessário; Kanban mantém rolagem interna no mobile. Nenhuma
correção usa `overflow-x: hidden` no documento para esconder defeitos.

## Segurança, API e produção

Ownership, validação Zod, selects explícitos, cookies HttpOnly/SameSite=Lax/Secure
em produção, origin guard e refresh rotation foram preservados. Respostas da API,
inclusive 401/403/404 antecipados, passam a receber no-store/nosniff/no-referrer.
O teste de Auth verifica esses headers e os métodos do preflight.

Portal continua independente da sessão administrativa: token bruto apenas na URL
e em memória transitória, SHA-256 persistido, hash ausente dos DTOs; revogação,
expiração, rotação e arquivamento bloqueiam o link. Tasks/Stages privados, budget,
Payments, TimeEntries e dados do proprietário ficam fora do DTO público. No-store,
no-referrer e noindex/nofollow preservados, inclusive dev/preview e erros do proxy.
Rate limits de Auth/Portal permanecem ativos; não foram relaxados para os testes.

Logs operacionais não serializam request, cookie, senha, tokens ou exceções do
banco. Logger Vite mantém sanitização de URLs do portal. Testes não imprimem
credenciais. A URL bearer pode permanecer no histórico e no clipboard por ação
do usuário; isso faz parte do modelo de compartilhamento e não foi ocultado.

`.env.example` e validação existente continuam adequados ao ambiente local;
produção exige `NODE_ENV=production`, APP_ORIGIN HTTPS exata, segredo aleatório
próprio, PostgreSQL e proxy `/api` na mesma origem. O novo build não modifica o
`.env` nem introduz secrets. Hospedagem real deve replicar headers e sanitização
de logs; Vite preview não é configuração de deploy.

## Validações

Uma rodada consolidada completa foi executada. O lint inicial identificou 14
callbacks com retorno `void` em forma abreviada; foram ajustados para blocos,
revalidados por lint e rebuild do frontend. Typecheck, testes e demais checks
passaram. Não foi repetida a bateria HTTP. Após fechar a documentação, formatação
e diff foram conferidos novamente. O navegador de refinamento oferece
`--interactions` para repetir apenas cenários de interação.

| Verificação                | Resultado                                                 |
| -------------------------- | --------------------------------------------------------- |
| `npm run lint`             | Aprovado na revalidação; zero warnings                    |
| `npm run typecheck`        | Frontend e backend aprovados                              |
| `npm run build`            | Ambos aprovados; frontend revalidado após ajustes de lint |
| `npm run format:check`     | Aprovado                                                  |
| `git diff --check`         | Aprovado                                                  |
| Prisma validate / generate | Aprovados                                                 |
| prisma migrate status      | Sete migrations aplicadas; schema sincronizado            |
| db:check                   | SELECT 1 aprovado                                         |
| test:auth                  | 18 testes aprovados                                       |
| test:clients               | 23 testes aprovados                                       |
| test:projects              | 28 testes aprovados                                       |
| test:tasks                 | 18 testes aprovados                                       |
| test:time-entries          | 21 testes aprovados                                       |
| test:payments              | 22 testes aprovados                                       |
| test:dashboard             | 15 testes aprovados                                       |
| test:portal                | 16 testes aprovados                                       |
| test:stages                | 7 testes aprovados                                        |
| Total HTTP                 | **168 testes aprovados; zero falhas**                     |
| test:portal:privacy        | Aprovado                                                  |
| test:auth:browser          | Aprovado; 125 s                                           |
| test:portal:browser        | Aprovado; 17 s                                            |
| test:refinement:browser    | Aprovado; 23 s                                            |
| npm audit                  | Zero vulnerabilidades reportadas                          |

Logs: `/private/tmp/devflow-stage11-validation`. `results.json` preserva a falha
original de lint; `lint-recheck.log` registra sua aprovação após correção e
`frontend-build-recheck.log` contém a medição final. Não há falha pendente.
Os testes locais confirmam isolamento entre proprietários, segurança do portal,
contratos públicos e regressão das etapas anteriores. Capturas de Configurações,
Dashboard e portal móvel também foram inspecionadas visualmente.

Scripts de navegador existentes foram preservados e ajustados às confirmações:

- `test:auth:browser`: fluxo administrativo completo, cadastro/login, filtros,
  CRUD, progresso AUTO/MANUAL, duas abas, refresh, logout e proteção de rotas.
- `test:portal:browser`: contexto sem sessão, visibilidade, DTO, ausência de
  cookies/Referer, rotação, expiração, revogação, arquivamento e responsividade.
- `test:refinement:browser`: dez rotas com deep links/reload, oito larguras,
  landmarks/ARIA, Configurações, cache após logout, foco/Escape, double submit,
  GET único após Kanban, confirmação/cancelamento, cache após arquivamento,
  404, erro HTML sanitizado, console e ausência de loops no intervalo observado.
- `test:portal:privacy`: headers de dev/preview e sanitização no erro real de proxy.

Capturas locais: `/private/tmp/devflow-stage11/browser`, além dos diretórios dos
scripts das etapas anteriores. Contas e contextos isolados são removidos ao final.

## Auditoria final

As respostas abaixo se referem ao código auditado e aos cenários locais executados;
não representam uma certificação de um deploy ainda inexistente.

| #   | Pergunta                                  | Resposta                                                                                                                                               |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Erros no console?                         | Nenhuma exceção JS ou console.error inesperado nos cenários testados. Erros HTTP induzidos receberam feedback seguro.                                  |
| 2   | Loops de requests?                        | Não observados; asserts de estabilização e refetch único do projeto passaram.                                                                          |
| 3   | Overflow horizontal global?               | Não nas oito larguras verificadas; scroll interno de tabelas/Kanban preservado.                                                                        |
| 4   | Rota quebra no reload/deep link?          | Não nas dez rotas e nos fluxos públicos/privados testados.                                                                                             |
| 5   | Dialog com foco incorreto?                | Problemas encontrados corrigidos; foco inicial, Escape e restauração aprovados.                                                                        |
| 6   | Form pode enviar duas vezes?              | Submits concorrentes bloqueados; dois requestSubmit simultâneos produziram um POST e um registro.                                                      |
| 7   | Ação destrutiva sem confirmação?          | Exclusões, revogação, rotação ativa e arquivamento que revoga portal têm confirmação. Arquivar cliente é reversível e não exclui dados.                |
| 8   | Vazamento de ownership?                   | Não identificado; suites com dois proprietários aprovadas.                                                                                             |
| 9   | Dado sensível em logs?                    | Não identificado nos logs da aplicação; erro do proxy com token é sanitizado em teste real.                                                            |
| 10  | Portal/token pode vazar?                  | Sem vazamento identificado por API, logs ou Referer; somente hash persistido. URL é uma credencial compartilhável e pode ficar no histórico/clipboard. |
| 11  | API retorna campo sensível/desnecessário? | Nenhum encontrado nos DTOs auditados; allowlist pública e ausência de tokenHash verificadas.                                                           |
| 12  | N+1 óbvio?                                | Não encontrado; Dashboard usa agregações agrupadas, inclusive progresso AUTO.                                                                          |
| 13  | Otimização simples de bundle faltando?    | Principal problema corrigido: runtime de desenvolvimento. Lazy routes preservadas; nenhuma divisão adicional com ganho claro identificada.             |
| 14  | Componente grande e problemático?         | Dashboard/Kanban continuam maiores, com responsabilidades locais identificáveis; nenhum bloqueio concreto que justifique nova divisão.                 |
| 15  | Inconsistência visual relevante?          | Não encontrada após correções e inspeção das capturas; identidade visual preservada.                                                                   |
| 16  | Mobile utilizável?                        | Sim nos viewports simulados de 320–430 px, com formulários/dialogs roláveis e acesso por teclado.                                                      |
| 17  | Estados vazios claros?                    | Sim; distinção entre ausência de registros e filtros sem resultado, com ações correspondentes.                                                         |
| 18  | Mensagens de erro compreensíveis?         | Sim; validação por campo, recurso indisponível e falha de rede/API sem stack interno.                                                                  |
| 19  | Teclado funciona?                         | Sim nos cenários de menu, formulários, dialogs e controles alternativos do Kanban.                                                                     |
| 20  | Alguma etapa anterior regrediu?           | Nenhuma regressão detectada nas 168 verificações HTTP e três fluxos de navegador.                                                                      |

## Limitações e recomendações para a Etapa 12

- Nenhum deploy, CI/CD, domínio novo ou integração externa foi implementado.
- Navegador automatizado: Chrome/CDP. Não houve teste físico em iOS/Android nem
  avaliação com leitor de tela real; teclado, semântica, foco e viewports foram verificados.
- Testes de rede comprovam ausência de loops durante os cenários observados,
  não um teste de carga ou de longa duração.
- Rate limiting em memória exige estratégia compartilhada para múltiplas instâncias.
- Portal bearer requer cuidado ao compartilhar; revogação não apaga conteúdo já visto.
- Configurações é somente leitura. Paginação e limites para grandes volumes continuam
  fora desta etapa; não há medição de Web Vitals em tráfego real.
- Para a próxima etapa, planejar deploy HTTPS, headers no host real, redaction do
  proxy/observabilidade, backups/migrations, CI e validação em outros navegadores.
  Estas são recomendações, não implementações.

## Inventário

`PlaceholderPage.tsx` foi removido
porque sua única rota passou a usar `SettingsPage.tsx`. Nenhuma implementação de
domínio foi recriada. Schema Prisma e as sete migrations anteriores permanecem intactos.

Arquivos criados:

- `docs/etapa-11-refinamento.md`
- `frontend/scripts/build.mjs`
- `frontend/src/components/RouteErrorBoundary.tsx`
- `frontend/src/components/ui/ConfirmDialog.tsx`
- `frontend/src/components/ui/dialog-focus.ts`
- `frontend/src/components/ui/useSubmitOnce.ts`
- `frontend/src/pages/SettingsPage.tsx`
- `scripts/refinement-browser-check.mjs`

Arquivos alterados (inclui a remoção do placeholder):

- `README.md`
- `backend/src/app.ts`
- `backend/src/middlewares/origin-guard.ts`
- `backend/src/services/dashboard.service.ts`
- `backend/src/tests/auth.test.ts`
- `backend/src/tests/dashboard.test.ts`
- `frontend/package.json`
- `frontend/src/App.tsx`
- `frontend/src/auth/AuthGuard.tsx`
- `frontend/src/auth/AuthProvider.tsx`
- `frontend/src/components/EmptyState.tsx`
- `frontend/src/components/clients/ClientCreateDialog.tsx`
- `frontend/src/components/clients/ClientEditForm.tsx`
- `frontend/src/components/clients/DeleteClientDialog.tsx`
- `frontend/src/components/navigation/Sidebar.tsx`
- `frontend/src/components/payments/DeletePaymentDialog.tsx`
- `frontend/src/components/payments/PaymentDialog.tsx`
- `frontend/src/components/portal/ProjectPortal.tsx`
- `frontend/src/components/portal/ProjectStages.tsx`
- `frontend/src/components/portal/StageDialog.tsx`
- `frontend/src/components/projects/DeleteProjectDialog.tsx`
- `frontend/src/components/projects/ProjectCreateDialog.tsx`
- `frontend/src/components/projects/ProjectEditForm.tsx`
- `frontend/src/components/tasks/DeleteTaskDialog.tsx`
- `frontend/src/components/tasks/ProjectKanban.tsx`
- `frontend/src/components/tasks/TaskDialog.tsx`
- `frontend/src/components/time-entries/DeleteTimeEntryDialog.tsx`
- `frontend/src/components/time-entries/TimeEntryDialog.tsx`
- `frontend/src/layouts/AppLayout.tsx`
- `frontend/src/pages/ClientDetailPage.tsx`
- `frontend/src/pages/FinancePage.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/PlaceholderPage.tsx`
- `frontend/src/pages/ProjectDetailPage.tsx`
- `frontend/src/pages/ProjectsPage.tsx`
- `frontend/src/pages/RegisterPage.tsx`
- `frontend/src/pages/TasksPage.tsx`
- `frontend/src/portal/portal-api.ts`
- `frontend/src/routes/AppRoutes.tsx`
- `frontend/src/routes/navigation.ts`
- `frontend/src/styles.css`
- `frontend/src/styles/clients.css`
- `frontend/src/styles/portal.css`
- `frontend/src/styles/tasks.css`
- `package.json`
- `scripts/auth-browser-check.mjs`
- `scripts/portal-browser-check.mjs`

ETAPA 11 — REFINAMENTO concluída.
NÃO houve avanço para a ETAPA 12.
