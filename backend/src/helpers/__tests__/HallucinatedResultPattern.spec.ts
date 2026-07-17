import { HALLUCINATED_RESULT_PATTERN } from "../HallucinatedResultPattern";

describe("HALLUCINATED_RESULT_PATTERN", () => {
  it.each([
    "não localizei o cadastro com o CPF informado",
    "não consegui localizar o cadastro com esse CPF", // regressão real 2026-07-17
    "não encontrei nenhuma fatura em aberto",
    "não consegui encontrar seu contrato",
    "esse CPF não está cadastrado em nosso sistema",
    "esse CPF não esta cadastrada aqui",
    "não consta nenhum registro pra esse CPF",
    "não há cadastro com esse documento"
  ])("detecta a frase de alucinação em: %s", texto => {
    expect(HALLUCINATED_RESULT_PATTERN.test(texto)).toBe(true);
  });

  it.each([
    "Vou verificar isso pra você, um momento",
    "Boa tarde! Em que posso te ajudar?",
    "Não se preocupe, já resolvo isso pra você",
    "Segue sua fatura, valor R$ 100,00"
  ])("não detecta em frases normais sem alucinação: %s", texto => {
    expect(HALLUCINATED_RESULT_PATTERN.test(texto)).toBe(false);
  });
});
