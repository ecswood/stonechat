// Baileys pode reentregar o mesmo messages.upsert pra uma mensagem que já
// tinha sido recebida antes (retentativa de sessão/decrypt). O guard antigo
// checava duplicidade com um SELECT no banco, mas handleMessage só grava a
// mensagem no banco DEPOIS de rodar toda a IA (chamada de rede à OpenAI) -
// então duas entregas quase simultâneas da mesma mensagem passavam as duas
// pelo SELECT antes de qualquer uma delas terminar de gravar, e a mensagem
// era processada (e a ação de IA disparada) duas vezes. Marcar o id como
// visto tem que ser síncrono, antes de qualquer await, pra fechar essa
// janela de corrida.
const shouldProcessMessage = (
  seenMessageIds: Set<string>,
  messageId: string | null | undefined
): boolean => {
  if (!messageId) return false;
  if (seenMessageIds.has(messageId)) return false;
  seenMessageIds.add(messageId);
  return true;
};

export default shouldProcessMessage;
