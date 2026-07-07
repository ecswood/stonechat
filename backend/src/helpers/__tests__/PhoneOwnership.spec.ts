import phoneOwnershipMatches from "../PhoneOwnership";

describe("phoneOwnershipMatches", () => {
  it("retorna true quando os últimos 8 dígitos batem, apesar de formatos diferentes", () => {
    const result = phoneOwnershipMatches("554388515951", [
      "(43) 98851-5951"
    ]);

    expect(result).toBe(true);
  });

  it("retorna true quando bate com QUALQUER um dos telefones cadastrados", () => {
    const result = phoneOwnershipMatches("554388515951", [
      "(11) 3333-4444",
      "(43) 98851-5951"
    ]);

    expect(result).toBe(true);
  });

  it("retorna false quando não bate com nenhum telefone cadastrado", () => {
    const result = phoneOwnershipMatches("554388515951", [
      "(11) 3333-4444"
    ]);

    expect(result).toBe(false);
  });

  it("retorna false quando não há telefones cadastrados", () => {
    const result = phoneOwnershipMatches("554388515951", []);

    expect(result).toBe(false);
  });

  it("retorna false quando o número de WhatsApp normaliza pra menos de 8 dígitos", () => {
    const result = phoneOwnershipMatches("123", ["(43) 98851-5951"]);

    expect(result).toBe(false);
  });

  it("retorna false mesmo se um telefone cadastrado também normalizar pra string vazia", () => {
    const result = phoneOwnershipMatches("", ["N/A", ""]);

    expect(result).toBe(false);
  });
});
