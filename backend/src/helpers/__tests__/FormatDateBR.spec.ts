import { formatDateBR } from "../FormatDateBR";

describe("formatDateBR", () => {
  it("converte data ISO simples (YYYY-MM-DD) para DD/MM/YYYY", () => {
    expect(formatDateBR("2026-07-10")).toBe("10/07/2026");
  });

  it("converte data ISO com horário/timezone (YYYY-MM-DDTHH:mm:ss.sssZ) para DD/MM/YYYY", () => {
    expect(formatDateBR("2026-07-16T00:00:00.000Z")).toBe("16/07/2026");
  });

  it("mantém string vazia sem alteração", () => {
    expect(formatDateBR("")).toBe("");
  });

  it("mantém string que já não está no formato ISO sem alteração", () => {
    expect(formatDateBR("10/07/2026")).toBe("10/07/2026");
  });
});
