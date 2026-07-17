import { buildTicketProtocol } from "../TicketProtocol";

describe("buildTicketProtocol", () => {
  it("monta ano + dia + mês + id do ticket (ex: 2026, 15/07, ticket 55 -> 2026150755)", () => {
    const date = new Date("2026-07-15T14:00:00Z"); // meio da tarde em Brasília, sem risco de virada de dia
    expect(buildTicketProtocol(55, date)).toBe("2026150755");
  });

  it("usa o dia certo em Brasília perto da virada de meia-noite (não o dia UTC)", () => {
    const date = new Date("2026-07-16T00:09:00Z"); // 15/07 21:09 em Brasília, já 16/07 em UTC
    expect(buildTicketProtocol(52, date)).toBe("2026150752");
  });

  it("preenche dia e mês com zero à esquerda quando necessário (ticket não é preenchido)", () => {
    const date = new Date("2026-01-05T14:00:00Z");
    expect(buildTicketProtocol(3, date)).toBe("202605013");
  });
});
