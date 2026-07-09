jest.mock("../../../helpers/CheckContactOpenTickets", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../helpers/SetTicketMessagesAsRead", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../libs/socket", () => ({ __esModule: true, getIO: jest.fn() }));
jest.mock("../../../models/Setting", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../../../models/Queue", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));
jest.mock("../ShowTicketService", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../WhatsappService/ShowWhatsAppService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../WbotServices/SendWhatsAppMessage", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../FindOrCreateATicketTrakingService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../helpers/GetTicketWbot", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../WbotServices/wbotMessageListener", () => ({
  __esModule: true,
  verifyMessage: jest.fn()
}));
jest.mock("../../SettingServices/ListSettingsServiceOne", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../UserServices/ShowUserService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../helpers/ResolveTicketWhatsappId", () => ({
  __esModule: true,
  default: jest.fn(ticket => ticket.whatsappId)
}));
jest.mock("../../../models/Whatsapp", () => ({ __esModule: true, default: {} }));
jest.mock("../../../models/Company", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

// eslint-disable-next-line import/first
import Setting from "../../../models/Setting";
// eslint-disable-next-line import/first
import ShowTicketService from "../ShowTicketService";
// eslint-disable-next-line import/first
import ShowWhatsAppService from "../../WhatsappService/ShowWhatsAppService";
// eslint-disable-next-line import/first
import SendWhatsAppMessage from "../../WbotServices/SendWhatsAppMessage";
// eslint-disable-next-line import/first
import FindOrCreateATicketTrakingService from "../FindOrCreateATicketTrakingService";
// eslint-disable-next-line import/first
import ListSettingsServiceOne from "../../SettingServices/ListSettingsServiceOne";
// eslint-disable-next-line import/first
import { getIO } from "../../../libs/socket";
// eslint-disable-next-line import/first
import UpdateTicketService from "../UpdateTicketService";

describe("UpdateTicketService - fechamento com pesquisa de satisfação", () => {
  const chain: any = {};

  const buildTicket = (overrides = {}) => ({
    id: 25,
    companyId: 1,
    whatsappId: 4,
    status: "pending",
    queueId: null,
    isGroup: false,
    contact: { id: 24, number: "554399332300" },
    user: undefined,
    update: jest.fn().mockResolvedValue(undefined),
    reload: jest.fn().mockResolvedValue(undefined),
    ...overrides
  });

  const buildTicketTraking = (overrides = {}) => ({
    ticketId: 25,
    companyId: 1,
    userId: null,
    ratingAt: null,
    finishedAt: null,
    rated: false,
    whatsappId: 4,
    update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides
  });

  beforeEach(() => {
    jest.clearAllMocks();
    chain.to = jest.fn(() => chain);
    chain.emit = jest.fn();
    (getIO as jest.Mock).mockReturnValue(chain);
    (ListSettingsServiceOne as jest.Mock).mockResolvedValue({ value: "disabled" });
  });

  it("fecha o ticket de verdade (status=closed persistido) mesmo enviando a pesquisa de satisfação pela primeira vez", async () => {
    const ticket = buildTicket();
    const ticketTraking = buildTicketTraking();

    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue(ticketTraking);
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "enabled" });
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      complationMessage: "Obrigado pelo contato!",
      ratingMessage: ""
    });

    await UpdateTicketService({
      ticketData: { status: "closed" },
      ticketId: 25,
      companyId: 1
    });

    expect(SendWhatsAppMessage).toHaveBeenCalledTimes(1);
    expect(SendWhatsAppMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("Digite de 1 à 3")
      })
    );

    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "closed" })
    );
  });

  it("mantém finishedAt em null quando acabou de enviar a pesquisa, pra ainda aceitar a nota do cliente depois", async () => {
    const ticket = buildTicket();
    const ticketTraking = buildTicketTraking();

    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue(ticketTraking);
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "enabled" });
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      complationMessage: "",
      ratingMessage: ""
    });

    await UpdateTicketService({
      ticketData: { status: "closed" },
      ticketId: 25,
      companyId: 1
    });

    expect(ticketTraking.finishedAt).toBeNull();
  });

  it("não manda a mensagem de encerramento junto da pesquisa (evita duplicidade)", async () => {
    const ticket = buildTicket();
    const ticketTraking = buildTicketTraking();

    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue(ticketTraking);
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "enabled" });
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      complationMessage: "Obrigado pelo contato!",
      ratingMessage: ""
    });

    await UpdateTicketService({
      ticketData: { status: "closed" },
      ticketId: 25,
      companyId: 1
    });

    const sentBodies = (SendWhatsAppMessage as jest.Mock).mock.calls.map(
      call => call[0].body
    );
    expect(sentBodies.some(b => b.includes("Obrigado pelo contato"))).toBe(false);
  });

  it("fecha normalmente (sem pesquisa) e finaliza a rastreabilidade quando o rating está desabilitado", async () => {
    const ticket = buildTicket();
    const ticketTraking = buildTicketTraking();

    (ShowTicketService as jest.Mock).mockResolvedValue(ticket);
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue(ticketTraking);
    (Setting.findOne as jest.Mock).mockResolvedValue({ value: "disabled" });
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      complationMessage: "Obrigado pelo contato!",
      ratingMessage: ""
    });

    await UpdateTicketService({
      ticketData: { status: "closed" },
      ticketId: 25,
      companyId: 1
    });

    expect(ticketTraking.finishedAt).not.toBeNull();
    expect(ticket.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "closed" })
    );
    const sentBodies = (SendWhatsAppMessage as jest.Mock).mock.calls.map(
      call => call[0].body
    );
    expect(sentBodies.some(b => b.includes("Obrigado pelo contato"))).toBe(true);
  });
});
