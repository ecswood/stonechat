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
    "não há cadastro com esse documento",
    "o CPF informado não está vinculado ao seu cadastro", // regressão real 2026-08-25: Edison, CPF 68197756953 - IA afirmou isso e, na mesma resposta, a Ação real (Verificar Bloqueio) encontrou o cadastro normalmente
    "esse CNPJ não está vinculado a nenhum contrato",
    "não há vínculo com esse CPF em nosso sistema"
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
