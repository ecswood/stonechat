import shouldProcessMessage from "../MessageDedup";

describe("shouldProcessMessage", () => {
  it("retorna true na primeira vez que vê um id de mensagem", () => {
    const seen = new Set<string>();
    expect(shouldProcessMessage(seen, "ABC123")).toBe(true);
  });

  it("retorna false numa segunda chamada com o mesmo id (regressão real: Baileys reentregou a mesma mensagem 'Desvincular' e ela foi processada duas vezes, com dois envios de confirmação e cpfCnpj já null na segunda)", () => {
    const seen = new Set<string>();
    expect(shouldProcessMessage(seen, "ABC123")).toBe(true);
    expect(shouldProcessMessage(seen, "ABC123")).toBe(false);
  });

  it("marca o id como visto de forma síncrona, então duas chamadas 'concorrentes' (antes de qualquer await) não passam as duas", () => {
    const seen = new Set<string>();
    const results = ["ABC123", "ABC123"].map(id => shouldProcessMessage(seen, id));
    expect(results).toEqual([true, false]);
  });

  it("retorna false quando o id é null ou undefined (mensagem sem id não deve ser processada)", () => {
    const seen = new Set<string>();
    expect(shouldProcessMessage(seen, null)).toBe(false);
    expect(shouldProcessMessage(seen, undefined)).toBe(false);
  });

  it("trata ids diferentes de forma independente", () => {
    const seen = new Set<string>();
    expect(shouldProcessMessage(seen, "AAA")).toBe(true);
    expect(shouldProcessMessage(seen, "BBB")).toBe(true);
  });
});
