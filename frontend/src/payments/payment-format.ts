export function formatMoney(value: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    Number(value),
  );
}

export function formatPaymentDate(value: string): string {
  const [year = 0, month = 1, day = 1] = value.split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

export function amountForInput(value: string): string {
  return value.replace('.', ',');
}

export const paymentStatusLabels = {
  PENDING: 'Pendente',
  PAID: 'Pago',
} as const;
