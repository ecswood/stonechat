import withConversationLock from "../ConversationLock";

const wait = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

describe("withConversationLock", () => {
  it("executa a função e retorna o resultado dela", async () => {
    const result = await withConversationLock("5543988515951", async () => 42);
    expect(result).toBe(42);
  });

  it("serializa chamadas concorrentes pra mesma chave, na ordem de chegada (regressão real: 'Desvincular' e uma mensagem seguinte da mesma cliente rodaram em paralelo e a IA cruzou as respostas)", async () => {
    const order: string[] = [];

    const slow = withConversationLock("contato-1", async () => {
      order.push("start-A");
      await wait(30);
      order.push("end-A");
    });
    const fast = withConversationLock("contato-1", async () => {
      order.push("start-B");
      await wait(1);
      order.push("end-B");
    });

    await Promise.all([slow, fast]);

    expect(order).toEqual(["start-A", "end-A", "start-B", "end-B"]);
  });

  it("não serializa chamadas de chaves diferentes (conversas diferentes podem rodar em paralelo)", async () => {
    const order: string[] = [];

    const contatoA = withConversationLock("contato-A", async () => {
      order.push("start-A");
      await wait(30);
      order.push("end-A");
    });
    const contatoB = withConversationLock("contato-B", async () => {
      order.push("start-B");
      await wait(1);
      order.push("end-B");
    });

    await Promise.all([contatoA, contatoB]);

    expect(order.indexOf("start-A")).toBeLessThan(order.indexOf("end-B"));
    expect(order.indexOf("start-B")).toBeLessThan(order.indexOf("end-A"));
  });

  it("continua liberando a fila mesmo quando uma chamada anterior lança erro", async () => {
    const order: string[] = [];

    const failing = withConversationLock("contato-2", async () => {
      order.push("fails");
      throw new Error("boom");
    });
    const next = withConversationLock("contato-2", async () => {
      order.push("runs-after");
    });

    await expect(failing).rejects.toThrow("boom");
    await next;

    expect(order).toEqual(["fails", "runs-after"]);
  });
});
