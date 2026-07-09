import resolveAckStatus from "../ResolveAckStatus";

describe("resolveAckStatus", () => {
  it("retorna o status quando é um número válido", () => {
    expect(resolveAckStatus(3)).toBe(3);
    expect(resolveAckStatus(0)).toBe(0);
  });

  it("retorna 0 quando o status é null (regressão real: mensagem recebida da Clau derrubou o salvamento com 'null value in column ack')", () => {
    expect(resolveAckStatus(null)).toBe(0);
  });

  it("retorna 0 quando o status é undefined", () => {
    expect(resolveAckStatus(undefined)).toBe(0);
  });
});
