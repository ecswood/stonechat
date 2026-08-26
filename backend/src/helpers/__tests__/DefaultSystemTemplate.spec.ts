import Mustache from "mustache";
import { DEFAULT_SYSTEM_TEMPLATE } from "../DefaultSystemTemplate";

// AiAgentActions.ts lê essas frases literalmente pra decidir quando
// consultar o SGP de verdade (ver ACTION_MARKERS) - se alguém mexer no
// template padrão e uma dessas sumir, a IA passa a inventar respostas em
// vez de acionar o sistema real. Esse teste é o alarme pra isso.
const ACTION_MARKERS = [
  "Ação: Transferir para Atendimento",
  "Ação: Buscar Boleto",
  "Ação: Liberar Confiança",
  "Ação: Desvincular CPF",
  "Ação: Verificar Bloqueio",
  "Ação: Encerrar Atendimento"
];

const baseView = {
  saudacao: "Boa tarde",
  nome: "Edison",
  maxTokens: 300,
  cpfContexto: "O CPF/CNPJ deste cliente já é conhecido: 123.***.***-00.",
  protocolo: "260826120000",
  promptNegocio: "Regras extras de negócio da SNI Telecom."
};

describe("DEFAULT_SYSTEM_TEMPLATE", () => {
  it("contém todas as frases de Ação, tanto na primeira mensagem quanto nas seguintes", () => {
    const primeiraMensagem = Mustache.render(DEFAULT_SYSTEM_TEMPLATE, {
      ...baseView,
      primeiraMensagem: true
    });
    const mensagemSeguinte = Mustache.render(DEFAULT_SYSTEM_TEMPLATE, {
      ...baseView,
      primeiraMensagem: false
    });

    ACTION_MARKERS.forEach(marker => {
      expect(primeiraMensagem).toContain(marker);
      expect(mensagemSeguinte).toContain(marker);
    });
  });

  it("troca os placeholders pelos valores reais, sem escapar aspas/acentos (usa {{{ }}})", () => {
    const rendered = Mustache.render(DEFAULT_SYSTEM_TEMPLATE, {
      ...baseView,
      primeiraMensagem: true
    });

    expect(rendered).toContain('"Boa tarde"');
    expect(rendered).toContain("Edison");
    expect(rendered).toContain("300 tokens");
    expect(rendered).toContain(
      "O CPF/CNPJ deste cliente já é conhecido: 123.***.***-00."
    );
    expect(rendered).toContain("#260826120000");
    expect(rendered).toContain("Regras extras de negócio da SNI Telecom.");
    expect(rendered).not.toContain("&quot;");
    expect(rendered).not.toContain("&#39;");
  });

  it("mostra a regra de saudação inicial só na primeira mensagem", () => {
    const primeiraMensagem = Mustache.render(DEFAULT_SYSTEM_TEMPLATE, {
      ...baseView,
      primeiraMensagem: true
    });
    const mensagemSeguinte = Mustache.render(DEFAULT_SYSTEM_TEMPLATE, {
      ...baseView,
      primeiraMensagem: false
    });

    expect(primeiraMensagem).toContain("Regra da saudação inicial");
    expect(mensagemSeguinte).not.toContain("Regra da saudação inicial");
    expect(mensagemSeguinte).toContain("Você JÁ cumprimentou este cliente");
  });
});
