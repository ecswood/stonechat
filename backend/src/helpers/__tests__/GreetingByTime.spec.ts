import { getGreetingForBrasiliaTime, getBrasiliaParts } from "../GreetingByTime";

describe("getBrasiliaParts", () => {
  it("converte 21:09 em Brasília (15/07, 00:09 UTC do dia 16) corretamente, sem virar o dia errado", () => {
    const date = new Date("2026-07-16T00:09:00Z");
    expect(getBrasiliaParts(date)).toEqual({
      year: 2026,
      month: 7,
      day: 15,
      hour: 21,
      minute: 9,
      second: 0
    });
  });

  it("converte meia-noite em Brasília (03:00 UTC) com hour=0, não 24", () => {
    const date = new Date("2026-07-16T03:00:00Z");
    expect(getBrasiliaParts(date).hour).toBe(0);
  });
});

describe("getGreetingForBrasiliaTime", () => {
  it("retorna 'Boa noite' para 23:46 UTC (20:46 em Brasília, caso real reportado)", () => {
    const date = new Date("2026-07-15T23:46:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Boa noite");
  });

  it("retorna 'Bom dia' às 09:00 em Brasília (12:00 UTC)", () => {
    const date = new Date("2026-07-15T12:00:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Bom dia");
  });

  it("retorna 'Boa tarde' às 14:00 em Brasília (17:00 UTC)", () => {
    const date = new Date("2026-07-15T17:00:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Boa tarde");
  });

  it("retorna 'Boa madrugada' às 03:00 em Brasília (06:00 UTC)", () => {
    const date = new Date("2026-07-15T06:00:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Boa madrugada");
  });

  it("vira 'Bom dia' exatamente às 06:00 em Brasília (09:00 UTC)", () => {
    const date = new Date("2026-07-15T09:00:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Bom dia");
  });

  it("vira 'Boa tarde' exatamente às 12:00 em Brasília (15:00 UTC)", () => {
    const date = new Date("2026-07-15T15:00:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Boa tarde");
  });

  it("vira 'Boa noite' exatamente às 18:00 em Brasília (21:00 UTC)", () => {
    const date = new Date("2026-07-15T21:00:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Boa noite");
  });

  it("vira 'Boa madrugada' exatamente às 00:00 em Brasília (03:00 UTC)", () => {
    const date = new Date("2026-07-16T03:00:00Z");
    expect(getGreetingForBrasiliaTime(date)).toBe("Boa madrugada");
  });
});
