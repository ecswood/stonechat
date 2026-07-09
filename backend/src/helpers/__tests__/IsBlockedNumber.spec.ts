import IsBlockedNumber from "../IsBlockedNumber";

describe("IsBlockedNumber", () => {
  it("retorna false quando não há setting configurada", () => {
    expect(IsBlockedNumber("554388515951", undefined)).toBe(false);
    expect(IsBlockedNumber("554388515951", null)).toBe(false);
    expect(IsBlockedNumber("554388515951", "")).toBe(false);
  });

  it("retorna true quando o número está na lista", () => {
    expect(
      IsBlockedNumber("554388515951", "554388515951,5511999998888")
    ).toBe(true);
  });

  it("retorna false quando o número não está na lista", () => {
    expect(IsBlockedNumber("554399332300", "554388515951")).toBe(false);
  });

  it("ignora formatação (espaços, parênteses, traço) na lista configurada", () => {
    expect(
      IsBlockedNumber("554388515951", " (43) 8851-5951, 55 ")
    ).toBe(false);
    expect(
      IsBlockedNumber("5543988515951", "55 (43) 98851-5951")
    ).toBe(true);
  });
});
