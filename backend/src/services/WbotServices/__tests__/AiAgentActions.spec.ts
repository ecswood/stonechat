jest.mock("../../../models/Tag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../../models/TicketTag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), findOne: jest.fn() }
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
import { registerAiAttendance, transferToQueueByName, handleBuscarBoletoAction, handleLiberarConfiancaAction, handleDesvincularCpfAction, dispatchAiAction, isAiHandledTicket } from "../AiAgentActions";

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
      ticketData: { queueId: 7, useIntegration: false, promptId: null },
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
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
  const ticket = { id: 22, companyId: 1, contact: { number: "554388515951" } } as any;
  const contact = { number: "554388515951" } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("envia o boleto e fecha o ticket quando encontrado", async () => {
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
    expect(
      sentTexts.some(t => t.includes("Protocolo:") && t.includes("#22"))
    ).toBe(true);
    expectClosingFarewell(sentTexts);
    expect(FindOrCreateAiUserService).toHaveBeenCalledWith(1);
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 22,
      companyId: 1,
      actionUserId: "999"
    });
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
});

describe("handleLiberarConfiancaAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
  const ticket = { id: 22, companyId: 1 } as any;
  const contact = { number: "554388515951" } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (FindOrCreateAiUserService as jest.Mock).mockResolvedValue({ id: 999 });
  });

  it("libera e fecha o ticket quando bem-sucedido", async () => {
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
    expectClosingFarewell(sentTexts);
    expect(FindOrCreateAiUserService).toHaveBeenCalledWith(1);
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 22,
      companyId: 1,
      actionUserId: "999"
    });
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
      ticketData: { queueId: 3, useIntegration: false, promptId: null },
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

  it("recusa e transfere pra Atendimento quando o telefone não bate com o CPF informado", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      contratoId: 1879,
      centralSenha: "09cz5dle",
      telefones: ["(11) 3333-4444"]
    });
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 1 });

    await handleLiberarConfiancaAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.liberarConfianca).not.toHaveBeenCalled();
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 1, useIntegration: false, promptId: null },
      ticketId: 22,
      companyId: 1
    });
  });
});

describe("handleDesvincularCpfAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
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
    expect(sentText).toContain("68197756953");
    expect(sentText.toLowerCase()).toContain("desvincul");
    expectClosingFarewell([sentText]);
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
});

describe("dispatchAiAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
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
});
