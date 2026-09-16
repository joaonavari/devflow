# Etapa 7 — Horas

Implementação integrada às Etapas 1–6. Nenhuma funcionalidade de financeiro,
billing, dashboard, portal, timer ou relatório avançado foi iniciada.

## Modelo e datas

`TimeEntry` possui UUID, `projectId`, descrição opcional, `workDate`,
`durationMinutes` e timestamps. A relação é `Project 1:N TimeEntry`; o usuário é
derivado por `TimeEntry → Project → User`, sem `userId` redundante.

`workDate` usa PostgreSQL `DATE` e o contrato `YYYY-MM-DD`. A API converte no
limite de entrada e saída, sem interpretar a data como horário local. Duração é um
inteiro de 1 a 1440 minutos. Horas fracionárias ou strings como `1:30` não são
persistidas.

## Ownership e projeto arquivado

O usuário vem exclusivamente da sessão. Listagem, detalhe, edição e exclusão
filtram pela relação com `Project.userId`; recursos alheios recebem `404`.

Registros de projeto arquivado continuam visíveis. Criação, edição e exclusão
retornam `409` até o projeto ser restaurado, seguindo a mesma regra de Tasks.
`projectId` é imutável depois da criação.

## API e totais

- `GET /api/v1/projects/:projectId/time-entries`
- `POST /api/v1/projects/:projectId/time-entries`
- `GET /api/v1/time-entries`
- `GET /api/v1/time-entries/:timeEntryId`
- `PATCH /api/v1/time-entries/:timeEntryId`
- `DELETE /api/v1/time-entries/:timeEntryId`

A visão global filtra por projeto, cliente, intervalo de datas e descrição. A
ordenação é `workDate DESC`, `createdAt DESC` e `id ASC`. Cada listagem retorna
`meta.totalMinutes`, calculado por `SUM(durationMinutes)` sobre o filtro atual.
Nenhum total é persistido no projeto.

## Frontend

`/horas` exibe total geral, total filtrado, registros recentes e filtros. O
formulário recebe horas e minutos separados e envia a soma em minutos. Somente
projetos ativos aparecem na criação global.

`/projetos/:projectId` mostra o total e os cinco registros mais recentes, com
criação, edição e exclusão. Projetos arquivados exibem a seção em modo somente
leitura. TanStack Query mantém chaves por usuário, visão global, projeto e detalhe.

## Limites desta etapa

Não há timer em tempo real, preço por hora, faturamento, invoices, pagamentos,
gráficos, relatórios avançados ou exportação.
