import { extractValidCpfCnpj } from "../ExtractValidCpfCnpj";

describe("extractValidCpfCnpj", () => {
  it("extrai um CPF válido mesmo com pontuação (681.977.569-53)", () => {
    expect(extractValidCpfCnpj("681.977.569-53")).toBe("68197756953");
  });

  it("extrai um CPF válido só com dígitos", () => {
    expect(extractValidCpfCnpj("68197756953")).toBe("68197756953");
  });

  it("extrai um CPF válido mesmo com texto ao redor (regressão real: cliente digita 'meu cpf é ...')", () => {
    expect(extractValidCpfCnpj("meu cpf é 681.977.569-53, obrigado")).toBe(
      "68197756953"
    );
  });

  it("extrai um CNPJ válido (14 dígitos)", () => {
    expect(extractValidCpfCnpj("11.222.333/0001-81")).toBe("11222333000181");
  });

  it("retorna null quando o texto tem 11 dígitos mas o checksum é inválido", () => {
    expect(extractValidCpfCnpj("11111111111")).toBeNull();
  });

  it("retorna null quando o texto tem 14 dígitos mas o checksum é inválido", () => {
    expect(extractValidCpfCnpj("11111111111111")).toBeNull();
  });

  it("retorna null quando não há nenhum dígito na mensagem", () => {
    expect(extractValidCpfCnpj("boa noite, tudo bem?")).toBeNull();
  });

  it("retorna null quando a mensagem tem outros números junto (ex: telefone), somando um total que não bate 11 nem 14 dígitos (limitação conhecida: não isola blocos de dígitos)", () => {
    expect(
      extractValidCpfCnpj("meu whatsapp é 43999332300 e meu cpf é 68197756953")
    ).toBeNull();
  });

  it("retorna null para string vazia", () => {
    expect(extractValidCpfCnpj("")).toBeNull();
  });
});
