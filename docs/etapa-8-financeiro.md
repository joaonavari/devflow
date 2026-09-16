# Etapa 8 — Financeiro

## Escopo

O domínio financeiro registra cobranças previstas por projeto. Ele não representa faturamento fiscal, gateway, assinatura, recorrência ou conciliação bancária.

## Modelo e ownership

`Payment` pertence a `Project`; o proprietário é sempre resolvido por `Payment → Project → User`. A API nunca aceita `userId`, e consultas de recurso usam o identificador da cobrança junto de `project.userId`. Recursos de outra conta respondem `404`.

O valor usa `Decimal(12,2)`. A API recebe e devolve uma string decimal canônica (`1000.00`), evitando ponto flutuante. A interface aceita vírgula ou ponto com até duas casas e apresenta BRL como decisão de visualização do MVP; nenhuma moeda ou símbolo é persistido.

## Datas e status

`dueDate` é uma data conceitual em `YYYY-MM-DD`, persistida como PostgreSQL `DATE` e serializada sem conversão local. `paidAt` é um instante real em `TIMESTAMPTZ`.

Somente `PENDING` e `PAID` são persistidos. `isOverdue` é derivado pelo backend quando a cobrança está pendente e `dueDate` é anterior ao dia atual no fuso do usuário autenticado. Uma cobrança paga nunca está vencida. Pagar preenche `paidAt`; reabrir limpa o campo.

## Totais

Os totais são calculados a partir das cobranças retornadas, com `Prisma.Decimal`:

- previsto: todas as cobranças relevantes;
- pago: cobranças `PAID`;
- pendente: cobranças `PENDING`;
- vencido: cobranças `PENDING` com vencimento anterior a hoje.

Nenhum total ou status vencido é duplicado no banco.

## Projeto arquivado

Cobranças existentes continuam disponíveis para leitura. Criação, edição, pagamento, reabertura e exclusão retornam `409` até o projeto ser restaurado. A interface apresenta a seção em modo somente leitura.

## Endpoints

- `GET /api/v1/projects/:projectId/payments`
- `POST /api/v1/projects/:projectId/payments`
- `GET /api/v1/payments`
- `GET /api/v1/payments/:paymentId`
- `PATCH /api/v1/payments/:paymentId`
- `PATCH /api/v1/payments/:paymentId/pay`
- `PATCH /api/v1/payments/:paymentId/reopen`
- `DELETE /api/v1/payments/:paymentId`

As listas aceitam busca, projeto, cliente, status, atraso e intervalo de vencimento. A ordem é `dueDate ASC`, `createdAt DESC`, `id ASC`.
