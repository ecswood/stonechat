import { Op } from "sequelize";

jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));
jest.mock("../../../models/Whatsapp", () => ({
  __esModule: true,
  default: { findOne: jest.fn() }
}));
jest.mock("../ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../FindOrCreateATicketTrakingService", () => ({
  __esModule: true,
  default: jest.fn()
}));

// eslint-disable-next-line import/first
import Ticket from "../../../models/Ticket";
// eslint-disable-next-line import/first
import Whatsapp from "../../../models/Whatsapp";
// eslint-disable-next-line import/first
import ShowTicketService from "../ShowTicketService";
// eslint-disable-next-line import/first
import FindOrCreateTicketService from "../FindOrCreateTicketService";

describe("FindOrCreateTicketService", () => {
  const contact = { id: 24 } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (Whatsapp.findOne as jest.Mock).mockResolvedValue({ id: 5 });
  });

  it("busca principal não inclui tickets fechados (pedido do Edison: fechamento sempre inicia atendimento novo)", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    (Ticket.create as jest.Mock).mockResolvedValue({ id: 99 });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 99 });

    await FindOrCreateTicketService(contact, 5, 0, 1);

    const [firstCallArgs] = (Ticket.findOne as jest.Mock).mock.calls[0];
    expect(firstCallArgs.where.status).toEqual({ [Op.or]: ["open", "pending"] });
  });

  it("busca de repescagem de 2h também exclui tickets fechados (senão reabriria um ticket fechado há poucos minutos)", async () => {
    (Ticket.findOne as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (Ticket.create as jest.Mock).mockResolvedValue({ id: 99 });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 99 });

    await FindOrCreateTicketService(contact, 5, 0, 1);

    expect(Ticket.findOne).toHaveBeenCalledTimes(2);
    const [secondCallArgs] = (Ticket.findOne as jest.Mock).mock.calls[1];
    expect(secondCallArgs.where.status).toEqual({ [Op.or]: ["open", "pending"] });
  });

  it("reaproveita um ticket aberto/pendente existente, sem criar um novo", async () => {
    const ticketExistente = {
      id: 42,
      status: "pending",
      update: jest.fn().mockResolvedValue(undefined)
    };
    (Ticket.findOne as jest.Mock).mockResolvedValueOnce(ticketExistente);
    (ShowTicketService as jest.Mock).mockResolvedValue(ticketExistente);

    const result = await FindOrCreateTicketService(contact, 5, 0, 1);

    expect(Ticket.create).not.toHaveBeenCalled();
    expect(result).toBe(ticketExistente);
  });

  it("cria um ticket novo quando o contato não tem nenhum ticket aberto/pendente", async () => {
    (Ticket.findOne as jest.Mock).mockResolvedValue(null);
    (Ticket.create as jest.Mock).mockResolvedValue({ id: 100 });
    (ShowTicketService as jest.Mock).mockResolvedValue({ id: 100 });

    await FindOrCreateTicketService(contact, 5, 0, 1);

    expect(Ticket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        contactId: 24,
        status: "pending",
        companyId: 1,
        whatsappId: 5
      })
    );
  });
});
