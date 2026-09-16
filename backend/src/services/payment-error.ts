export class PaymentError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function paymentNotFound(): PaymentError {
  return new PaymentError(404, 'PAYMENT_NOT_FOUND', 'Cobrança não encontrada.');
}

export function paymentProjectNotFound(): PaymentError {
  return new PaymentError(404, 'PAYMENT_PROJECT_NOT_FOUND', 'Projeto não encontrado.');
}

export function archivedProjectReadOnly(): PaymentError {
  return new PaymentError(
    409,
    'PROJECT_ARCHIVED',
    'Restaure o projeto antes de alterar suas cobranças.',
  );
}
