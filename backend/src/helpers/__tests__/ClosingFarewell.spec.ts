import closingFarewell from "../ClosingFarewell";

describe("closingFarewell", () => {
  it("retorna 'Tenha uma boa madrugada!' de 0h a 5h59", () => {
    expect(closingFarewell(0)).toBe("Tenha uma boa madrugada!");
    expect(closingFarewell(5)).toBe("Tenha uma boa madrugada!");
  });

  it("retorna 'Tenha um bom dia!' de 6h a 11h59", () => {
    expect(closingFarewell(6)).toBe("Tenha um bom dia!");
    expect(closingFarewell(11)).toBe("Tenha um bom dia!");
  });

  it("retorna 'Tenha uma boa tarde!' de 12h a 17h59", () => {
    expect(closingFarewell(12)).toBe("Tenha uma boa tarde!");
    expect(closingFarewell(17)).toBe("Tenha uma boa tarde!");
  });

  it("retorna 'Tenha uma boa noite!' de 18h a 23h59", () => {
    expect(closingFarewell(18)).toBe("Tenha uma boa noite!");
    expect(closingFarewell(23)).toBe("Tenha uma boa noite!");
  });
});
