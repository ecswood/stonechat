// Pedido do Edison (2026-08-25): a IA respondia instantaneamente, o que
// parecia pouco natural (várias mensagens chegando em rajada, sem tempo de
// "digitando..."). Toda mensagem que a IA manda espera esse tempo antes de
// sair - inclusive entre mensagens da mesma resposta (narração, boleto,
// PIX, "posso ajudar em algo mais?" etc.), já que cada envio é aguardado em
// sequência, não em paralelo.
export const AI_RESPONSE_DELAY_MS = 2500;

export const delayAiResponse = (): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, AI_RESPONSE_DELAY_MS);
  });
