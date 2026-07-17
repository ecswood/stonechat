jest.mock("../../../models/Tag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/TicketTag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), findOne: jest.fn(), destroy: jest.fn() }
}));
jest.mock("../../../models/Queue", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../TicketServices/UpdateTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../SgpServices/SgpService", () => ({
  __esModule: true,
  default: {
    buscarBoleto: jest.fn(),
    consultarCliente: jest.fn(),
    liberarConfianca: jest.fn()
  }
}));
jest.mock("../../UserServices/FindOrCreateAiUserService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../MessageServices/CreateMessageService", () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(undefined)
}));

// eslint-disable-next-line import/first
import Tag from "../../../models/Tag";
// eslint-disable-next-line import/first
import TicketTag from "../../../models/TicketTag";
// eslint-disable-next-line import/first
import Queue from "../../../models/Queue";
// eslint-disable-next-line import/first
import UpdateTicketService from "../../TicketServices/UpdateTicketService";
// eslint-disable-next-line import/first
import SgpService from "../../SgpServices/SgpService";
// eslint-disable-next-line import/first
import FindOrCreateAiUserService from "../../UserServices/FindOrCreateAiUserService";
// eslint-disable-next-line import/first
import CreateMessageService from "../../MessageServices/CreateMessageService";
// eslint-disable-next-line import/first
import { registerAiAttendance, transferToQueueByName, handleBuscarBoletoAction, handleLiberarConfiancaAction, handleDesvincularCpfAction, handleVerificarBloqueioAction, handleEncerrarAtendimentoAction, dispatchAiAction, isAiHandledTicket, isTechnicalDiagnosticTicket, hasAnyActionMarker } from "../AiAgentActions";

const VALID_FAREWELLS = [
  "Tenha uma boa madrugada!",
  "Tenha um bom dia!",
  "Tenha uma boa tarde!",
  "Tenha uma boa noite!"
];

const expectClosingFarewell = (sentTexts: string[]): void => {
  expect(
    sentTexts.some(
      t =>
        t.includes("SNI Telecom agradece seu contato") &&
        VALID_FAREWELLS.some(f => t.includes(f))
    )
  ).toBe(true);
};

describe("registerAiAttendance", () => {
  it("cria a tag 'Atendimento IA' se não existir e aplica ao ticket", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 5 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await registerAiAttendance({ id: 22 } as any, 1);

    expect(Tag.findOrCreate).toHaveBeenCalledWith({
      where: { name: "Atendimento IA", companyId: 1 },
      defaults: { name: "Atendimento IA", companyId: 1, color: "#8B5CF6" }
    });
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 5 }
    });
  });
});

describe("isAiHandledTicket", () => {
  it("retorna true quando o ticket tem a tag Atendimento IA", async () => {
    (Tag.findOne as jest.Mock) = jest.fn().mockResolvedValue({ id: 5 });
    (TicketTag.findOne as jest.Mock) = jest.fn().mockResolvedValue({ id: 1 });

    const result = await isAiHandledTicket(22, 1);

    expect(result).toBe(true);
    expect(Tag.findOne).toHaveBeenCalledWith({
      where: { name: "Atendimento IA", companyId: 1 }
    });
  });

  it("retorna false quando a tag não existe pra essa empresa", async () => {
    (Tag.findOne as jest.Mock) = jest.fn().mockResolvedValue(null);

    const result = await isAiHandledTicket(22, 1);

    expect(result).toBe(false);
  });

  it("retorna false quando a tag existe mas não está aplicada nesse ticket", async () => {
    (Tag.findOne as jest.Mock) = jest.fn().mockResolvedValue({ id: 5 });
    (TicketTag.findOne as jest.Mock) = jest.fn().mockResolvedValue(null);

    const result = await isAiHandledTicket(22, 1);

    expect(result).toBe(false);
  });
});

describe("transferToQueueByName", () => {
  it("transfere o ticket para a fila quando ela existe", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 7 });

    const result = await transferToQueueByName(
      "Financeiro",
      { id: 22, companyId: 1 } as any,
      1
    );

    expect(result).toBe(true);
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 7, useIntegration: false, promptId: null, status: "pending" },
      ticketId: 22,
      companyId: 1
    });
  });

  it("retorna false quando a fila não existe", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue(null);

    const result = await transferToQueueByName(
      "Fila Inexistente",
      { id: 22, companyId: 1 } as any,
      1
    );

    expect(result).toBe(false);
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});

describe("handleBuscarBoletoAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
  const ticket = { id: 22, companyId: 1, contact: { number: "554388515951" } } as any;
  const contact = { number: "554388515951" } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("envia o boleto e pergunta se pode ajudar em algo mais, sem fechar o ticket (pedido do Edison: não encerra na hora, aguarda confirmação)", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 21 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: "00190...",
      pixCopiaCola: "00020126...",
      valor: "99.90",
      vencimento: "2026-07-15"
    });

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.includes("https://sgp/boleto/1"))).toBe(true);
    expect(sentTexts.some(t => t.includes("00020126"))).toBe(true);
    expect(sentTexts.some(t => t.includes("Posso te ajudar em algo mais"))).toBe(
      true
    );
    expect(sentTexts.some(t => t.includes("Protocolo"))).toBe(false);
    // marca a tag de aguardando confirmação em vez de fechar o ticket
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 21 }
    });
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("salva a mensagem 'posso ajudar em algo mais' no banco (mesmo mecanismo síncrono das outras mensagens finais)", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 21 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: null,
      pixCopiaCola: null,
      valor: "99.90",
      vencimento: "2026-07-15"
    });

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    expect(CreateMessageService).toHaveBeenCalledWith({
      messageData: expect.objectContaining({
        id: "test-msg-id",
        ticketId: 22,
        fromMe: true,
        body: expect.stringContaining("Posso te ajudar em algo mais")
      }),
      companyId: 1
    });
  });

  it("salva TODAS as mensagens do boleto no banco, na ordem real de envio (regressão real: 'Segue sua fatura' foi enviada mas nunca apareceu no painel, sumida por causa da falha no listener de eco durante instabilidade da sessão do WhatsApp)", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 21 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: null,
      pixCopiaCola: "00020126...",
      valor: "99.90",
      vencimento: "2026-07-15"
    });

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    const savedBodies = (CreateMessageService as jest.Mock).mock.calls.map(
      call => call[0].messageData.body
    );
    expect(savedBodies.some(b => b.includes("Segue sua fatura"))).toBe(true);
    expect(savedBodies.some(b => b.includes("PIX Copia e Cola"))).toBe(true);
    expect(savedBodies.some(b => b.includes("Posso te ajudar em algo mais"))).toBe(
      true
    );
    // salvas na mesma ordem real de envio
    const boletoIndex = savedBodies.findIndex(b => b.includes("Segue sua fatura"));
    const pixIndex = savedBodies.findIndex(b => b.includes("PIX Copia e Cola"));
    const perguntaIndex = savedBodies.findIndex(b =>
      b.includes("Posso te ajudar em algo mais")
    );
    expect(boletoIndex).toBeLessThan(pixIndex);
    expect(pixIndex).toBeLessThan(perguntaIndex);
  });

  it("não inclui 'Linha digitável' nem a string 'null' quando linhaDigitavel é null", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: null,
      pixCopiaCola: "00020126...",
      valor: "99.90",
      vencimento: "2026-07-15"
    });

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    const boletoText = sentTexts.find(t => t.includes("https://sgp/boleto/1"));
    expect(boletoText).toBeDefined();
    expect(boletoText).not.toContain("null");
    expect(boletoText).not.toContain("Linha digitável");
  });

  it("avisa o cliente quando não há boleto em aberto, sem fechar o ticket", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue(null);

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    expect(SgpService.buscarBoleto).toHaveBeenCalled();
    expect(wbot.sendMessage).toHaveBeenCalled();
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("envia o boleto mesmo quando o telefone não bate com nenhum dos cadastrados no CPF (baixo risco, decisão do Edison)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(11) 3333-4444"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: null,
      pixCopiaCola: null,
      valor: "50.00",
      vencimento: "2026-07-20"
    });

    await handleBuscarBoletoAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.buscarBoleto).toHaveBeenCalledWith("68197756953");
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.includes("https://sgp/boleto/1"))).toBe(true);
  });

  it("não busca boleto quando o cliente não é encontrado no SGP", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue(null);

    await handleBuscarBoletoAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.buscarBoleto).not.toHaveBeenCalled();
    expect(wbot.sendMessage).toHaveBeenCalled();
  });

  it("avisa que a consulta falhou (não que não há fatura) quando o SGP dá erro de verdade (regressão real 2026-07-17: cliente com 10 títulos em aberto ouviu 'não encontrei nenhuma fatura', mas a consulta só tinha falhado - agora propaga o erro)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockRejectedValue(new Error("timeout"));

    await handleBuscarBoletoAction("05914704979", ticket, contact, wbot, 1);

    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.toLowerCase().includes("não encontrei"))).toBe(
      false
    );
    expect(
      sentTexts.some(t => t.toLowerCase().includes("não consegui verificar"))
    ).toBe(true);
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("não pergunta 'posso ajudar em algo mais' nem fecha quando isLastAction=false (pedido do Edison: essa pergunta só faz sentido depois da ÚLTIMA tarefa pendente)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: null,
      pixCopiaCola: null,
      valor: "50.00",
      vencimento: "2026-07-20"
    });

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1, false);

    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.includes("https://sgp/boleto/1"))).toBe(true);
    expect(sentTexts.some(t => t.includes("Protocolo"))).toBe(false);
    expect(
      sentTexts.some(t => t.includes("Posso te ajudar em algo mais"))
    ).toBe(false);
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});

describe("handleLiberarConfiancaAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
  const ticket = { id: 22, companyId: 1 } as any;
  const contact = { number: "554388515951" } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("libera e pergunta se pode ajudar em algo mais, sem fechar o ticket (pedido do Edison: não encerra na hora, aguarda confirmação)", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 21 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoId: 1879,
      centralSenha: "09cz5dle",
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.liberarConfianca as jest.Mock).mockResolvedValue({
      sucesso: true,
      protocolo: "260707144900",
      dataPromessa: "2026-07-08"
    });

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.liberarConfianca).toHaveBeenCalledWith(
      "68197756953",
      "09cz5dle",
      1879
    );
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.includes("Liberei sua conexão"))).toBe(true);
    // o protocolo do SGP faz parte do resultado entregue, não da despedida
    expect(sentTexts.some(t => t.includes("260707144900"))).toBe(true);
    expect(sentTexts.some(t => t.includes("Posso te ajudar em algo mais"))).toBe(
      true
    );
    expect(
      sentTexts.some(t => t.includes("SNI Telecom agradece seu contato"))
    ).toBe(false);
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 21 }
    });
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("avisa o cliente e transfere para Financeiro quando já usou e não cumpriu (status 2 real)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoId: 1879,
      centralSenha: "09cz5dle",
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.liberarConfianca as jest.Mock).mockResolvedValue({
      sucesso: false,
      motivo: "ja_utilizado",
      mensagem: "O recurso de promessa de pagamento já atingiu quantidade permitida. Recurso não disponível"
    });
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 3 });

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 3, useIntegration: false, promptId: null, status: "pending" },
      ticketId: 22,
      companyId: 1
    });
  });

  it("não libera quando o cliente não é encontrado no SGP", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue(null);

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.liberarConfianca).not.toHaveBeenCalled();
    expect(wbot.sendMessage).toHaveBeenCalled();
  });

  it("avisa que a consulta falhou (não inventa 'não localizei') quando o SGP dá erro de verdade ao consultar o cliente", async () => {
    (SgpService.consultarCliente as jest.Mock).mockRejectedValue(new Error("timeout"));

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.toLowerCase().includes("não localizei"))).toBe(
      false
    );
    expect(
      sentTexts.some(t => t.toLowerCase().includes("não consegui verificar"))
    ).toBe(true);
  });

  it("libera mesmo quando o telefone não bate com nenhum dos cadastrados no CPF (decisão do Edison 2026-07-09: quem digitou o CPF pode liberar; se der problema na prática, revisamos)", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 21 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoId: 1879,
      centralSenha: "09cz5dle",
      telefones: ["(11) 3333-4444"]
    });
    (SgpService.liberarConfianca as jest.Mock).mockResolvedValue({
      sucesso: true,
      protocolo: "260707144900",
      dataPromessa: "2026-07-08"
    });

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.liberarConfianca).toHaveBeenCalledWith(
      "68197756953",
      "09cz5dle",
      1879
    );
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 21 }
    });
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("não encerra o atendimento nem manda protocolo/despedida quando isLastAction=false", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoId: 1879,
      centralSenha: "09cz5dle",
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.liberarConfianca as jest.Mock).mockResolvedValue({
      sucesso: true,
      protocolo: "260707144900",
      dataPromessa: "2026-07-08"
    });

    await handleLiberarConfiancaAction(
      "68197756953",
      ticket,
      contact,
      wbot,
      1,
      false
    );

    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.includes("Liberei sua conexão"))).toBe(true);
    expect(sentTexts.some(t => t.includes("260707144900"))).toBe(true);
    expect(
      sentTexts.some(t => t.includes("SNI Telecom agradece seu contato"))
    ).toBe(false);
    expect(
      sentTexts.some(t => t.includes("Posso te ajudar em algo mais"))
    ).toBe(false);
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});

describe("handleDesvincularCpfAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
  const ticket = { id: 38, companyId: 1 } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("limpa o cpfCnpj do contato e avisa o cliente", async () => {
    const contact = {
      number: "554388515951",
      cpfCnpj: "68197756953",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    await handleDesvincularCpfAction(contact, wbot, ticket, 1);

    expect(contact.update).toHaveBeenCalledWith({ cpfCnpj: null });
    expect(wbot.sendMessage).toHaveBeenCalled();
  });

  it("informa explicitamente ao cliente que o número foi desvinculado daquele CPF e agradece (pedido do Edison: cliente precisa saber que a desvinculação realmente aconteceu)", async () => {
    const contact = {
      number: "554388515951",
      cpfCnpj: "68197756953",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    await handleDesvincularCpfAction(contact, wbot, ticket, 1);

    const [{ text: sentText }] = wbot.sendMessage.mock.calls[0].slice(1);
    expect(sentText).toContain("681.XXX.XXX-53");
    expect(sentText).not.toContain("68197756953");
    expect(sentText.toLowerCase()).toContain("desvincul");
    expectClosingFarewell([sentText]);
  });

  it("avisa que não há CPF vinculado, sem dizer 'CPF/CNPJ null', quando o contato já está sem CPF (regressão real: duas execuções da mesma mensagem desvincularam duas vezes e a segunda mandou 'CPF/CNPJ null')", async () => {
    const contact = {
      number: "554388515951",
      cpfCnpj: null,
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    await handleDesvincularCpfAction(contact, wbot, ticket, 1);

    expect(contact.update).not.toHaveBeenCalled();
    const [{ text: sentText }] = wbot.sendMessage.mock.calls[0].slice(1);
    expect(sentText.toLowerCase()).not.toContain("null");
    expect(sentText.toLowerCase()).toContain("nenhum cpf");
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });

  it("encerra o atendimento após desvincular, pra que um novo contato peça o CPF do titular de novo (pedido do Edison)", async () => {
    const contact = {
      number: "554388515951",
      cpfCnpj: "68197756953",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    await handleDesvincularCpfAction(contact, wbot, ticket, 1);

    expect(FindOrCreateAiUserService).toHaveBeenCalledWith(1);
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 38,
      companyId: 1,
      actionUserId: "999"
    });
  });

  it("mascara CNPJ (14 dígitos) corretamente na mensagem de desvinculação", async () => {
    const contact = {
      number: "554388515951",
      cpfCnpj: "11222333000181",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    await handleDesvincularCpfAction(contact, wbot, ticket, 1);

    const [{ text: sentText }] = wbot.sendMessage.mock.calls[0].slice(1);
    expect(sentText).toContain("11.XXX.XXX/XXXX-81");
    expect(sentText).not.toContain("11222333000181");
  });

  it("não encerra o atendimento nem manda despedida quando isLastAction=false", async () => {
    const contact = {
      number: "554388515951",
      cpfCnpj: "68197756953",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    await handleDesvincularCpfAction(contact, wbot, ticket, 1, false);

    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.toLowerCase().includes("desvincul"))).toBe(
      true
    );
    expect(
      sentTexts.some(t => t.includes("SNI Telecom agradece seu contato"))
    ).toBe(false);
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});

describe("dispatchAiAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
  const ticket = { id: 22, companyId: 1 } as any;
  const contact = { number: "554388515951", cpfCnpj: "12345678900" } as any;

  beforeEach(() => jest.clearAllMocks());

  it("remove a frase-gatilho e transfere para Atendimento", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 1 });

    const result = await dispatchAiAction(
      "Já vou te transferir. Ação: Transferir para Atendimento",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Já vou te transferir.");
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Atendimento", companyId: 1 }
    });
  });

  it("remove a frase-gatilho e transfere para Técnico", async () => {
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 2 });

    const result = await dispatchAiAction(
      "Vou abrir um chamado técnico. Ação: Transferir para Técnico",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Vou abrir um chamado técnico.");
    expect(Queue.findOne).toHaveBeenCalledWith({
      where: { name: "Técnico", companyId: 1 }
    });
  });

  it("chama onCleaned com a fala da IA ANTES de enviar as mensagens do boleto", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: "00190...",
      pixCopiaCola: null,
      valor: "99.90",
      vencimento: "2026-07-15"
    });
    const onCleaned = jest.fn().mockResolvedValue(undefined);

    const result = await dispatchAiAction(
      "Um momento, vou buscar sua fatura. Ação: Buscar Boleto",
      ticket,
      contact,
      wbot,
      1,
      onCleaned
    );

    expect(onCleaned).toHaveBeenCalledWith("Um momento, vou buscar sua fatura.");
    expect(wbot.sendMessage).toHaveBeenCalled();
    expect(onCleaned.mock.invocationCallOrder[0]).toBeLessThan(
      (wbot.sendMessage as jest.Mock).mock.invocationCallOrder[0]
    );
    expect(result).toBe("");
  });

  it("sanitiza a narração quando ela afirma um resultado de consulta antes da Ação, mesmo com o marcador presente (regressão real 2026-07-17: 'não consegui localizar o cadastro' seguido do boleto real sendo entregue segundos depois)", async () => {
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
      linkBoleto: "https://sgp/boleto/1",
      linhaDigitavel: null,
      pixCopiaCola: null,
      valor: "102.30",
      vencimento: "2026-07-05"
    });
    const onCleaned = jest.fn().mockResolvedValue(undefined);

    await dispatchAiAction(
      "Edison, não consegui localizar o cadastro com esse CPF. Vou verificar se há alguma pendência. Ação: Buscar Boleto",
      ticket,
      contact,
      wbot,
      1,
      onCleaned
    );

    expect(onCleaned).not.toHaveBeenCalledWith(
      expect.stringContaining("não consegui localizar")
    );
    expect(SgpService.buscarBoleto).toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.includes("https://sgp/boleto/1"))).toBe(true);
  });

  it("aciona a busca de boleto e remove a frase-gatilho", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(43) 98851-5951"]
    });
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue(null);

    const result = await dispatchAiAction(
      "Já vou consultar. Ação: Buscar Boleto",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Já vou consultar.");
    expect(SgpService.buscarBoleto).toHaveBeenCalledWith("12345678900");
  });

  it("aciona a liberação de confiança e remove a frase-gatilho", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue(null);

    const result = await dispatchAiAction(
      "Vou verificar. Ação: Liberar Confiança",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Vou verificar.");
    expect(SgpService.consultarCliente).toHaveBeenCalledWith("12345678900");
  });

  it("retorna o texto original quando não há frase-gatilho", async () => {
    const result = await dispatchAiAction(
      "Como posso te ajudar hoje?",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Como posso te ajudar hoje?");
  });

  it("remove a frase-gatilho de Buscar Boleto mesmo sem CPF conhecido, sem chamar o SGP", async () => {
    const contactSemCpf = { number: "554388515951", cpfCnpj: undefined } as any;

    const result = await dispatchAiAction(
      "Antes preciso do seu CPF. Ação: Buscar Boleto",
      ticket,
      contactSemCpf,
      wbot,
      1
    );

    expect(result).toBe("Antes preciso do seu CPF.");
    expect(SgpService.buscarBoleto).not.toHaveBeenCalled();
  });

  it("remove a frase-gatilho de Liberar Confiança mesmo sem CPF conhecido, sem chamar o SGP", async () => {
    const contactSemCpf = { number: "554388515951", cpfCnpj: undefined } as any;

    const result = await dispatchAiAction(
      "Vou verificar sua condição. Ação: Liberar Confiança",
      ticket,
      contactSemCpf,
      wbot,
      1
    );

    expect(result).toBe("Vou verificar sua condição.");
    expect(SgpService.consultarCliente).not.toHaveBeenCalled();
  });

  it("pede o CPF/CNPJ explicitamente quando a fala da IA não pede e o CPF ainda não é conhecido (regressão real: Clara disse só 'vou agilizar sua solicitação' por áudio e parou, sem pedir o CPF)", async () => {
    const contactSemCpf = { number: "554388515951", cpfCnpj: undefined } as any;

    await dispatchAiAction(
      "Seja bem-vindo à SNI Telecom! Vou agilizar sua solicitação, um momento. Ação: Buscar Boleto",
      ticket,
      contactSemCpf,
      wbot,
      1
    );

    expect(SgpService.buscarBoleto).not.toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => /cpf\/cnpj/i.test(t))).toBe(true);
  });

  it("não duplica o pedido de CPF/CNPJ quando a fala da IA já pediu (Buscar Boleto)", async () => {
    const contactSemCpf = { number: "554388515951", cpfCnpj: undefined } as any;

    await dispatchAiAction(
      "Antes preciso do seu CPF. Ação: Buscar Boleto",
      ticket,
      contactSemCpf,
      wbot,
      1
    );

    expect(wbot.sendMessage).not.toHaveBeenCalled();
  });

  it("pede o CPF/CNPJ explicitamente quando a fala da IA não pede e o CPF ainda não é conhecido (Liberar Confiança)", async () => {
    const contactSemCpf = { number: "554388515951", cpfCnpj: undefined } as any;

    await dispatchAiAction(
      "Vou agilizar sua solicitação, um momento. Ação: Liberar Confiança",
      ticket,
      contactSemCpf,
      wbot,
      1
    );

    expect(SgpService.consultarCliente).not.toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => /cpf\/cnpj/i.test(t))).toBe(true);
  });

  it("remove a frase-gatilho e desvincula o CPF", async () => {
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
    const contactComCpf = {
      number: "554388515951",
      cpfCnpj: "68197756953",
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    const result = await dispatchAiAction(
      "Sem problemas, já vou desvincular. Ação: Desvincular CPF",
      ticket,
      contactComCpf,
      wbot,
      1
    );

    expect(result).toBe("Sem problemas, já vou desvincular.");
    expect(contactComCpf.update).toHaveBeenCalledWith({ cpfCnpj: null });
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: ticket.id,
      companyId: 1,
      actionUserId: "999"
    });
  });

  it("aciona a desvinculação mesmo sem CPF/CNPJ conhecido (a ação não depende de um CPF novo — ela usa o que já está vinculado, ou avisa que não há nada vinculado)", async () => {
    const contactSemCpf = {
      number: "554388515951",
      cpfCnpj: undefined,
      update: jest.fn().mockResolvedValue(undefined)
    } as any;

    await dispatchAiAction(
      "Verificando aqui. Ação: Desvincular CPF",
      ticket,
      contactSemCpf,
      wbot,
      1
    );

    expect(contactSemCpf.update).not.toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => t.toLowerCase().includes("nenhum cpf"))).toBe(
      true
    );
  });

  describe("múltiplos pedidos na mesma mensagem (pedido do Edison: boleto + religação de confiança juntos)", () => {
    const wbotMulti = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
    const ticketMulti = { id: 22, companyId: 1 } as any;

    beforeEach(() => {
      jest.clearAllMocks();
      (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
    });

    it("executa as duas ações em sequência quando o CPF já é conhecido, dando retorno de cada uma (ordem: boleto primeiro, depois liberação)", async () => {
      const contactComCpf = {
        number: "554388515951",
        cpfCnpj: "68197756953"
      } as any;
      (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
        contratoId: 1879,
        centralSenha: "09cz5dle",
        telefones: ["(43) 98851-5951"]
      });
      (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
        linkBoleto: "https://sgp/boleto/1",
        linhaDigitavel: null,
        pixCopiaCola: null,
        valor: "50.00",
        vencimento: "2026-07-20"
      });
      (SgpService.liberarConfianca as jest.Mock).mockResolvedValue({
        sucesso: true,
        protocolo: "260707144900",
        dataPromessa: "2026-07-08"
      });

      const cleanedCalls: string[] = [];
      await dispatchAiAction(
        "Vou buscar seu boleto. Ação: Buscar Boleto Também vou liberar sua conexão. Ação: Liberar Confiança",
        ticketMulti,
        contactComCpf,
        wbotMulti,
        1,
        async cleaned => {
          cleanedCalls.push(cleaned);
        }
      );

      expect(cleanedCalls).toEqual([
        "Vou buscar seu boleto.",
        "Também vou liberar sua conexão."
      ]);
      expect(SgpService.buscarBoleto).toHaveBeenCalledWith("68197756953");
      expect(SgpService.liberarConfianca).toHaveBeenCalledWith(
        "68197756953",
        "09cz5dle",
        1879
      );
      // boleto deve ter sido buscado ANTES da liberação (ordem da mensagem)
      const boletoCallOrder = (SgpService.buscarBoleto as jest.Mock).mock
        .invocationCallOrder[0];
      const liberacaoCallOrder = (SgpService.liberarConfianca as jest.Mock).mock
        .invocationCallOrder[0];
      expect(boletoCallOrder).toBeLessThan(liberacaoCallOrder);

      // regressão real (pedido do Edison): nenhuma das duas ações fecha o
      // ticket na hora — só a ÚLTIMA ação da sequência (liberação) pergunta
      // se pode ajudar em algo mais; a primeira (boleto) só entrega o
      // conteúdo, sem perguntar nada ainda.
      expect(UpdateTicketService).not.toHaveBeenCalled();
      const sentTexts = (wbotMulti.sendMessage as jest.Mock).mock.calls.map(
        call => call[1].text
      );
      const perguntaMsgs = sentTexts.filter(t =>
        t.includes("Posso te ajudar em algo mais")
      );
      expect(perguntaMsgs).toHaveLength(1);
      // a pergunta deve vir DEPOIS de "Liberei sua conexão" (2ª/última ação),
      // não logo após o boleto (1ª ação) — confirma que o boleto não perguntou nada
      const liberacaoIndex = sentTexts.findIndex(t =>
        t.includes("Liberei sua conexão")
      );
      const perguntaIndex = sentTexts.findIndex(t =>
        t.includes("Posso te ajudar em algo mais")
      );
      expect(liberacaoIndex).toBeLessThan(perguntaIndex);
    });

    it("pede o CPF/CNPJ apenas uma vez e não executa nenhuma ação quando o número não está vinculado (pedido do Edison: 'senão solicita cpf')", async () => {
      const contactSemCpf = {
        number: "554388515951",
        cpfCnpj: undefined
      } as any;

      await dispatchAiAction(
        "Vou verificar tudo pra você. Ação: Buscar Boleto Ação: Liberar Confiança",
        ticketMulti,
        contactSemCpf,
        wbotMulti,
        1
      );

      expect(SgpService.buscarBoleto).not.toHaveBeenCalled();
      expect(SgpService.liberarConfianca).not.toHaveBeenCalled();
      const sentTexts = (wbotMulti.sendMessage as jest.Mock).mock.calls.map(
        call => call[1].text
      );
      expect(sentTexts.filter(t => /cpf\/cnpj/i.test(t))).toHaveLength(1);
    });
  });

  describe("ação pendente forçada pelo sistema (pedido do Edison: tirar a decisão da IA, mas ela continua conversando)", () => {
    const wbotPend = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
    const ticketPend = { id: 70, companyId: 1 } as any;

    beforeEach(() => {
      jest.clearAllMocks();
      (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
    });

    it("marca a ação pendente quando pede o CPF (sem CPF conhecido)", async () => {
      (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 55 }, true]);
      (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
      const contactSemCpf = { number: "554388515951", cpfCnpj: undefined } as any;

      await dispatchAiAction(
        "Um momento. Ação: Buscar Boleto",
        ticketPend,
        contactSemCpf,
        wbotPend,
        1
      );

      expect(Tag.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.stringContaining("Buscar Boleto"),
            companyId: 1
          })
        })
      );
      expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
        where: { ticketId: 70, tagId: 55 }
      });
    });

    it("aciona a busca de boleto automaticamente quando o CPF chega, mesmo que a fala da IA não tenha NENHUMA frase de Ação (regressão real: a IA alucinou 'não está vinculado' sem acionar nada)", async () => {
      (Tag.findOne as jest.Mock).mockResolvedValue({ id: 55 });
      (TicketTag.findOne as jest.Mock).mockResolvedValue({ id: 1 });
      (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
        telefones: ["(43) 98851-5951"]
      });
      (SgpService.buscarBoleto as jest.Mock).mockResolvedValue({
        linkBoleto: "https://sgp/boleto/1",
        linhaDigitavel: null,
        pixCopiaCola: null,
        valor: "115.65",
        vencimento: "2026-07-10"
      });
      const contactComCpf = { number: "554388515951", cpfCnpj: "68197756953" } as any;

      await dispatchAiAction(
        "O CPF informado não está vinculado ao nosso sistema.",
        ticketPend,
        contactComCpf,
        wbotPend,
        1
      );

      expect(SgpService.buscarBoleto).toHaveBeenCalledWith("68197756953");
      const sentTexts = (wbotPend.sendMessage as jest.Mock).mock.calls.map(
        call => call[1].text
      );
      expect(sentTexts.some(t => t.includes("https://sgp/boleto/1"))).toBe(true);
    });

    it("limpa a marca de pendência depois que a ação forçada roda", async () => {
      (Tag.findOne as jest.Mock).mockResolvedValue({ id: 55 });
      (TicketTag.findOne as jest.Mock).mockResolvedValue({ id: 1 });
      (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
        telefones: ["(43) 98851-5951"]
      });
      (SgpService.buscarBoleto as jest.Mock).mockResolvedValue(null);
      const contactComCpf = { number: "554388515951", cpfCnpj: "68197756953" } as any;

      await dispatchAiAction(
        "Não achei nada.",
        ticketPend,
        contactComCpf,
        wbotPend,
        1
      );

      expect(TicketTag.destroy).toHaveBeenCalledWith({
        where: { ticketId: 70, tagId: 55 }
      });
    });

    it("não força nenhuma ação quando não há pendência marcada (conversa normal)", async () => {
      (Tag.findOne as jest.Mock).mockResolvedValue(null);
      const contactComCpf = { number: "554388515951", cpfCnpj: "68197756953" } as any;

      const result = await dispatchAiAction(
        "De nada! Precisa de mais alguma coisa?",
        ticketPend,
        contactComCpf,
        wbotPend,
        1
      );

      expect(result).toBe("De nada! Precisa de mais alguma coisa?");
      expect(SgpService.buscarBoleto).not.toHaveBeenCalled();
    });
  });
});

describe("handleVerificarBloqueioAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
  const contact = { number: "554388515951" } as any;
  const ticket = { id: 38, companyId: 1 } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 7 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
  });

  it("marca o ticket com a tag 'Diagnostico Tecnico' pra sinalizar que um diagnóstico está em andamento", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoStatus: "Ativo"
    });

    await handleVerificarBloqueioAction("68197756953", ticket, contact, wbot, 1);

    expect(Tag.findOrCreate).toHaveBeenCalledWith({
      where: { name: "Diagnostico Tecnico", companyId: 1 },
      defaults: { name: "Diagnostico Tecnico", companyId: 1, color: "#F59E0B" }
    });
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 38, tagId: 7 }
    });
  });

  it("não manda mensagem de bloqueio quando o contrato está Ativo", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoStatus: "Ativo"
    });

    await handleVerificarBloqueioAction("68197756953", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).not.toHaveBeenCalled();
  });

  it("avisa o cliente quando o contrato está com pendência (caso real: contratoStatus 'Suspenso')", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoStatus: "Suspenso"
    });

    await handleVerificarBloqueioAction("68197756953", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    const [{ text }] = wbot.sendMessage.mock.calls[0].slice(1);
    expect(text).toContain("Suspenso");
  });

  it("não manda mensagem nem quebra quando o cliente não é encontrado no SGP", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue(null);

    await handleVerificarBloqueioAction("00000000000", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).not.toHaveBeenCalled();
  });

  it("não quebra (nem trava o atendimento) quando o SGP dá erro de verdade ao consultar o cliente", async () => {
    (SgpService.consultarCliente as jest.Mock).mockRejectedValue(new Error("timeout"));

    await expect(
      handleVerificarBloqueioAction("00000000000", ticket, contact, wbot, 1)
    ).resolves.not.toThrow();
  });
});

describe("isTechnicalDiagnosticTicket", () => {
  beforeEach(() => jest.clearAllMocks());

  it("retorna true quando o ticket tem a tag Diagnostico Tecnico", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue({ id: 7 });
    (TicketTag.findOne as jest.Mock).mockResolvedValue({});

    const result = await isTechnicalDiagnosticTicket(38, 1);

    expect(result).toBe(true);
  });

  it("retorna false quando a tag não existe pra essa empresa", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue(null);

    const result = await isTechnicalDiagnosticTicket(38, 1);

    expect(result).toBe(false);
  });

  it("retorna false quando a tag existe mas não está aplicada nesse ticket", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue({ id: 7 });
    (TicketTag.findOne as jest.Mock).mockResolvedValue(null);

    const result = await isTechnicalDiagnosticTicket(38, 1);

    expect(result).toBe(false);
  });
});

describe("handleEncerrarAtendimentoAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
  const contact = { number: "554388515951" } as any;
  const ticket = { id: 38, companyId: 1 } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("agradece e fecha o ticket", async () => {
    await handleEncerrarAtendimentoAction(ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    const [{ text }] = wbot.sendMessage.mock.calls[0].slice(1);
    expect(text.toLowerCase()).toContain("agradece");
    expect(FindOrCreateAiUserService).toHaveBeenCalledWith(1);
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 38,
      companyId: 1,
      actionUserId: "999"
    });
  });

  it("limpa a marca de 'aguardando confirmação' ao encerrar de verdade (pedido do Edison: se o cliente confirmar que não precisa de mais nada, o atendimento fecha e não fica esperando o timeout de 10 minutos à toa)", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue({ id: 33 });

    await handleEncerrarAtendimentoAction(ticket, contact, wbot, 1);

    expect(TicketTag.destroy).toHaveBeenCalledWith({
      where: { ticketId: 38, tagId: 33 }
    });
  });
});

describe("dispatchAiAction - Verificar Bloqueio e Encerrar Atendimento", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({ key: { id: "test-msg-id" }, status: 1 }) } as any;
  const ticket = { id: 38, companyId: 1 } as any;
  const contact = { number: "554388515951", cpfCnpj: "68197756953" } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 7 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("remove a frase-gatilho e verifica bloqueio quando o CPF é conhecido", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoStatus: "Ativo"
    });

    const result = await dispatchAiAction(
      "Vai ser um prazer te ajudar! Sua internet está lenta ou não acessa nada? Ação: Verificar Bloqueio",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe(
      "Vai ser um prazer te ajudar! Sua internet está lenta ou não acessa nada?"
    );
    expect(SgpService.consultarCliente).toHaveBeenCalledWith("68197756953");
  });

  it("remove também um ponto final sobrando logo após a frase-gatilho (regressão real: ficava '...nada? .' na mensagem salva)", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoStatus: "Ativo"
    });

    const result = await dispatchAiAction(
      "Vai ser um prazer te ajudar! Sua internet está lenta ou não acessa nada? Ação: Verificar Bloqueio.",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe(
      "Vai ser um prazer te ajudar! Sua internet está lenta ou não acessa nada?"
    );
  });

  it("pede o CPF/CNPJ explicitamente quando a fala da IA não pede e o CPF ainda não é conhecido (Verificar Bloqueio)", async () => {
    const contactSemCpf = { number: "554388515951", cpfCnpj: undefined } as any;

    await dispatchAiAction(
      "Vou verificar sua conexão. Ação: Verificar Bloqueio",
      ticket,
      contactSemCpf,
      wbot,
      1
    );

    expect(SgpService.consultarCliente).not.toHaveBeenCalled();
    const sentTexts = (wbot.sendMessage as jest.Mock).mock.calls.map(
      call => call[1].text
    );
    expect(sentTexts.some(t => /cpf\/cnpj/i.test(t))).toBe(true);
  });

  it("remove a frase-gatilho e encerra o atendimento", async () => {
    const result = await dispatchAiAction(
      "Que bom que voltou ao normal! Ação: Encerrar Atendimento",
      ticket,
      contact,
      wbot,
      1
    );

    expect(result).toBe("Que bom que voltou ao normal!");
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 38,
      companyId: 1,
      actionUserId: "999"
    });
  });
});

describe("hasAnyActionMarker", () => {
  it("retorna true quando a resposta contém alguma frase de Ação", () => {
    expect(hasAnyActionMarker("Vou buscar. Ação: Buscar Boleto")).toBe(true);
    expect(hasAnyActionMarker("Ação: Liberar Confiança")).toBe(true);
    expect(hasAnyActionMarker("texto Ação: Encerrar Atendimento.")).toBe(true);
  });

  it("retorna false quando a resposta promete uma ação sem incluir a frase-gatilho (regressão real: 'Vou proceder com a solicitação para liberar a conexão por confiança.' sem a Ação, deixando o cliente sem resposta)", () => {
    expect(
      hasAnyActionMarker(
        "Vou proceder com a solicitação para liberar a conexão por confiança."
      )
    ).toBe(false);
  });

  it("retorna false pra uma resposta comum sem nenhuma ação", () => {
    expect(hasAnyActionMarker("Bom dia! Em que posso ajudar?")).toBe(false);
  });
});
