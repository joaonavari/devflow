# Etapa 6 — Tasks & Kanban

Implementação integrada às Etapas 1–5, preservando autenticação, clientes e
projetos. Nenhum domínio de horas, financeiro, dashboard ou portal foi iniciado.

## Modelo, migration e contratos

`Task` possui UUID, `projectId`, título, descrição opcional, prioridade, status,
prazo opcional, posição, conclusão, visibilidade futura para cliente e timestamps.
A relação é `Project 1:N Task`; não existe `Task.userId` redundante.

A migration real `20260915181540_stage6_tasks_kanban` adiciona `ProgressMode`,
`TaskPriority`, `TaskStatus`, `Project.progressMode`, tabela, índices, foreign key
com cascade e constraints para posição não negativa e coerência entre `DONE` e
`completedAt`. Datas conceituais usam PostgreSQL `DATE` e a API `YYYY-MM-DD`.

## Ownership e projeto arquivado

O usuário vem exclusivamente da sessão. Todas as queries de tarefa atravessam a
relação com `Project.userId`; recurso ausente ou alheio recebe `404`. A criação
também valida `projectId + userId`. Projeto arquivado permite leitura de suas
tarefas, mas criação, edição, movimento e exclusão retornam `409` até a restauração.

## Ordenação e Kanban

Cada coluna usa posições inteiras iniciadas em zero. Criação insere ao final.
Movimento ou exclusão normaliza sequencialmente a coluna dentro de uma transação
serializável, com desempate por UUID. O endpoint de movimento recebe somente status
e posição; mudanças para `DONE` preenchem `completedAt` e reaberturas o limpam.

O Kanban contextual usa dnd-kit com sensores de ponteiro e teclado. A cache muda de
forma otimista e volta ao snapshot anterior se a API falhar. Cada cartão também
oferece seletor de status e botões de subir/descer, portanto o fluxo não depende de
drag-and-drop. No mobile, as colunas usam scroll horizontal com encaixe controlado.

## Progresso do projeto

`progressMode` usa `MANUAL` como default, inclusive para compatibilidade com todos
os projetos existentes. Projetos novos podem escolher os dois modos.

- `MANUAL`: mantém o inteiro persistido entre 0 e 100; tarefas não o alteram.
- `AUTO`: calcula dinamicamente `round(DONE / total × 100)`; zero tarefas resulta
  em 0%. O frontend desabilita a edição direta.
- `MANUAL → AUTO`: a próxima leitura usa imediatamente as tarefas atuais.
- `AUTO → MANUAL`: o backend persiste o percentual calculado naquele instante.

O valor AUTO não é duplicado no banco, evitando dessincronização depois de criar,
mover, reabrir ou excluir tarefas.

## API e frontend

O backend expõe listagem/criação aninhada por projeto, visão global, detalhe,
edição, movimento e exclusão. Busca cobre título e descrição; filtros cobrem
projeto, status, prioridade e vencimento.

`/projetos/:projectId` contém criação, edição, exclusão e Kanban. `/tarefas` contém
uma lista global responsiva, busca, filtros, projeto, status, prioridade e prazo.
React Hook Form + Zod validam formulários e TanStack Query organiza cache por
usuário, visão global, projeto e detalhe.

## Limites desta etapa

Não há paginação, pesos, story points, estimativas, dependências, subtarefas,
comentários, anexos, automações ou notificações. A visibilidade para cliente apenas
persiste o booleano; nenhum portal foi criado.
