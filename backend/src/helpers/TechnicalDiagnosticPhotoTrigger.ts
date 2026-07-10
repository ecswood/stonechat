export interface TechnicalDiagnosticPhotoContext {
  isImageMessage: boolean;
  fromMe: boolean;
  hasTechnicalDiagnosticTag: boolean;
  ticketQueueIdIsNull: boolean;
}

// Depois de orientar o cliente a reiniciar os equipamentos, se o problema
// persistir a IA pede fotos dos equipamentos/fontes. A IA não tem visão,
// então detectar que "a foto chegou" e transferir pro suporte técnico é
// responsabilidade do código, não do modelo.
const shouldTransferToTechnicalSupport = (
  context: TechnicalDiagnosticPhotoContext
): boolean => {
  return (
    context.isImageMessage &&
    !context.fromMe &&
    context.hasTechnicalDiagnosticTag &&
    context.ticketQueueIdIsNull
  );
};

export default shouldTransferToTechnicalSupport;
