jest.mock("../../../models/Tag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));
jest.mock("../../../models/TicketTag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
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
import { registerAiAttendance, transferToQueueByName, handleBuscarBoletoAction, handleLiberarConfiancaAction, dispatchAiAction } from "../AiAgentActions";

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

  beforeEach(() => jest.clearAllMocks());

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
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 22,
      companyId: 1
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

  it("recusa e transfere pra Atendimento quando o telefone não bate com o CPF informado", async () => {
    (SgpService.consultarCliente as jest.Mock).mockResolvedValue({
      telefones: ["(11) 3333-4444"]
    });
    (Queue.findOne as jest.Mock).mockResolvedValue({ id: 1 });

    await handleBuscarBoletoAction("68197756953", ticket, contact, wbot, 1);

    expect(SgpService.buscarBoleto).not.toHaveBeenCalled();
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { queueId: 1, useIntegration: false, promptId: null },
      ticketId: 22,
      companyId: 1
    });
  });
});

describe("handleLiberarConfiancaAction", () => {
  const wbot = { sendMessage: jest.fn().mockResolvedValue({}) } as any;
  const ticket = { id: 22, companyId: 1 } as any;
  const contact = { number: "554388515951" } as any;

  beforeEach(() => jest.clearAllMocks());

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
    expect(UpdateTicketService).toHaveBeenCalledWith({
      ticketData: { status: "closed" },
      ticketId: 22,
      companyId: 1
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
});
