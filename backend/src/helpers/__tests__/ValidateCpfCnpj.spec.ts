import { validaCpfCnpj } from "../ValidateCpfCnpj";

describe("validaCpfCnpj", () => {
  it("aceita um CPF real e válido (68197756953)", () => {
    expect(validaCpfCnpj("68197756953")).toBe(true);
  });

  it("aceita outro CPF real e válido (04354599961, confirmado ao vivo no SGP)", () => {
    expect(validaCpfCnpj("04354599961")).toBe(true);
  });

  it("aceita um CNPJ válido (11222333000181)", () => {
    expect(validaCpfCnpj("11222333000181")).toBe(true);
  });

  it("rejeita CPF com o último dígito verificador errado", () => {
    expect(validaCpfCnpj("68197756954")).toBe(false);
  });

  it("rejeita CPF com o primeiro dígito verificador errado", () => {
    expect(validaCpfCnpj("68197756903")).toBe(false);
  });

  it("rejeita CNPJ com dígito verificador errado", () => {
    expect(validaCpfCnpj("11222333000180")).toBe(false);
  });

  it("rejeita CPF com todos os dígitos iguais (regra de segurança clássica, ex: 111.111.111-11)", () => {
    expect(validaCpfCnpj("11111111111")).toBe(false);
  });

  it("rejeita CNPJ com todos os dígitos iguais", () => {
    expect(validaCpfCnpj("11111111111111")).toBe(false);
  });

  it("rejeita string que não tem 11 nem 14 dígitos", () => {
    expect(validaCpfCnpj("123456789")).toBe(false);
  });

  it("rejeita string vazia", () => {
    expect(validaCpfCnpj("")).toBe(false);
  });
});
