import formatBody, { greeting } from "../Mustache";

describe("Mustache - saudação e horário respeitam o fuso de Brasília", () => {
  it("greeting() retorna 'Boa noite' às 21:09 em Brasília (00:09 UTC do dia seguinte)", () => {
    const date = new Date("2026-07-16T00:09:00Z");
    expect(greeting(date)).toBe("Boa noite");
  });

  it("formatBody preenche {{ms}} e {{hora}} com o horário de Brasília, não UTC", () => {
    const date = new Date("2026-07-16T00:09:05Z");
    const result = formatBody("{{ms}} - {{hora}}", undefined as any, date);
    expect(result).toBe("Boa noite - 21:09:05");
  });

  it("formatBody usa o DIA certo em Brasília perto da virada de meia-noite (não o dia UTC)", () => {
    const date = new Date("2026-07-16T00:09:00Z"); // 15/07 21:09 em Brasília, mas já 16/07 em UTC
    const result = formatBody("{{protocol}}", undefined as any, date);
    expect(result.startsWith("20260715")).toBe(true);
  });
});
