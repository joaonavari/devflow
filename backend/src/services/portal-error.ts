export class PortalError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
export const portalUnavailable = () =>
  new PortalError(404, 'PORTAL_UNAVAILABLE', 'Este link não está disponível ou expirou.');
export const portalProjectNotFound = () =>
  new PortalError(404, 'PROJECT_NOT_FOUND', 'Projeto não encontrado.');
export const stageNotFound = () => new PortalError(404, 'STAGE_NOT_FOUND', 'Etapa não encontrada.');
export const portalArchived = () =>
  new PortalError(409, 'PROJECT_ARCHIVED', 'Restaure o projeto antes de fazer esta alteração.');
