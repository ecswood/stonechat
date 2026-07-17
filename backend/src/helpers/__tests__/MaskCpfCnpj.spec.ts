import { maskCpfCnpj } from "../MaskCpfCnpj";

describe("maskCpfCnpj", () => {
  it("mascara CPF (11 dígitos) mostrando só os 3 primeiros e os 2 últimos: 681.XXX.XXX-53", () => {
    expect(maskCpfCnpj("68197756953")).toBe("681.XXX.XXX-53");
  });

  it("mascara CNPJ (14 dígitos) mostrando só os 2 primeiros e os 2 últimos: 12.XXX.XXX/XXXX-99", () => {
    expect(maskCpfCnpj("12345678000199")).toBe("12.XXX.XXX/XXXX-99");
  });

  it("mascara mesmo quando o valor já vem com pontuação", () => {
    expect(maskCpfCnpj("681.977.569-53")).toBe("681.XXX.XXX-53");
  });

  it("mantém sem alteração quando não tem 11 nem 14 dígitos", () => {
    expect(maskCpfCnpj("123")).toBe("123");
  });

  it("mantém string vazia sem alteração", () => {
    expect(maskCpfCnpj("")).toBe("");
  });
});
