# Etapa 9 — Dashboard

## Escopo

O Dashboard é uma camada de leitura. Ele não persiste métricas, eventos ou totais próprios e não cria um novo domínio de negócio.

## Contrato

`GET /api/v1/dashboard?period=TODAY|7D|30D` retorna:

- resumo principal de projetos ativos, tarefas abertas, minutos registrados e valores pendente/vencido;
- até cinco projetos em andamento;
- contagens de tarefas e até cinco tarefas com prazo que exigem atenção;
- total de horas e até cinco projetos com mais tempo;
- financeiro pago no período, pendente atual e vencido atual;
- até oito atividades recentes derivadas dos timestamps existentes.

O período padrão é `30D`. Ele afeta horas, tarefas concluídas e pagamentos recebidos. Projetos ativos, tarefas abertas, valores pendentes e vencidos são métricas do estado atual e são identificados assim na interface.

## Timezone e datas

O dia atual e o início do período usam o timezone do usuário autenticado. Datas conceituais (`workDate`, `dueDate`) continuam comparadas como PostgreSQL `DATE`. Timestamps de conclusão e pagamento usam o instante correspondente à meia-noite local do primeiro dia do período.

Uma tarefa está atrasada quando não está concluída e seu prazo é anterior ao dia atual. Um pagamento está vencido quando está pendente e seu vencimento é anterior ao dia atual. Nenhum desses estados derivados é persistido.

## Agregação e ownership

Todas as consultas partem do `userId` obtido da sessão. Tasks, TimeEntries e Payments aplicam ownership pela relação com `Project`.

As consultas usam `count`, `groupBy`, `aggregate`, listas com `take` e selects mínimos. Elas são executadas em paralelo. O ranking de horas faz uma consulta adicional única com `id IN (...)` para resolver nomes de projetos, evitando N+1.

Projetos arquivados não entram na carga de trabalho atual de projetos e tarefas. Horas históricas e posições financeiras continuam consideradas, pois permanecem dados válidos dos projetos.

## Atividade recente

Não existe EventLog. A lista reúne projetos, tarefas, registros de horas e cobranças pelos timestamps já persistidos, ordena em memória e limita a oito itens. Ela representa atividade derivada, sem pretensão de auditoria.

## Frontend

O Dashboard usa uma única query TanStack Query associada ao usuário e período, sem polling. A query refaz a leitura ao montar a página, garantindo atualização ao retornar após mutações em outros domínios.

As páginas de rota usam `React.lazy` e `Suspense`. `AuthGuard` e `AppLayout` permanecem no chunk inicial, preservando autenticação e navegação direta.

Gráficos externos não foram adicionados. Barras simples comunicam progresso e distribuição de horas com menos peso e complexidade.
