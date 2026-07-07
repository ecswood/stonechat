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
  default: { buscarBoleto: jest.fn() }
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
import { registerAiAttendance, transferToQueueByName, handleBuscarBoletoAction } from "../AiAgentActions";

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

  it("avisa o cliente quando não há boleto em aberto, sem fechar o ticket", async () => {
    (SgpService.buscarBoleto as jest.Mock).mockResolvedValue(null);

    await handleBuscarBoletoAction("12345678900", ticket, contact, wbot, 1);

    expect(wbot.sendMessage).toHaveBeenCalled();
    expect(UpdateTicketService).not.toHaveBeenCalled();
  });
});
