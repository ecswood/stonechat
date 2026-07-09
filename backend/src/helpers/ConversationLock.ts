// Mensagens do mesmo contato que chegam quase juntas (ex: "3" e "Desvincular"
// com menos de 1s de diferença) disparavam handleMessage em paralelo, cada
// uma com sua própria chamada à OpenAI - as respostas se cruzavam (uma
// mensagem via a ação errada, ou o texto de uma aparecia junto da ação da
// outra). Serializa por chave (o remoteJid do contato) mantendo uma fila
// FIFO, sem travar conversas de outros contatos.
const queues = new Map<string, Promise<unknown>>();

const withConversationLock = async <T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> => {
  const previous = queues.get(key) ?? Promise.resolve();
  const settledPrevious = previous.then(
    () => undefined,
    () => undefined
  );
  const current = settledPrevious.then(fn);
  queues.set(key, current.then(
    () => undefined,
    () => undefined
  ));
  return current;
};

export default withConversationLock;
