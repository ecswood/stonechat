jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../ShowTicketService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../FindOrCreateATicketTrakingService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../libs/socket", () => ({
  __esModule: true,
  getIO: jest.fn()
}));

// eslint-disable-next-line import/first
import Ticket from "../../../models/Ticket";
// eslint-disable-next-line import/first
import ShowTicketService from "../ShowTicketService";
// eslint-disable-next-line import/first
import FindOrCreateATicketTrakingService from "../FindOrCreateATicketTrakingService";
// eslint-disable-next-line import/first
import { getIO } from "../../../libs/socket";
// eslint-disable-next-line import/first
import AppError from "../../../errors/AppError";
// eslint-disable-next-line import/first
import PullTicketService from "../PullTicketService";

describe("PullTicketService", () => {
  const chain: any = {};

  beforeEach(() => {
    jest.clearAllMocks();
    chain.to = jest.fn(() => chain);
    chain.emit = jest.fn();
    (getIO as jest.Mock).mockReturnValue(chain);
  });

  it("assume o ticket quando ninguém pegou antes", async () => {
    (Ticket.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 26,
      queueId: 1,
      companyId: 1,
      whatsappId: 3
    });
    const ticketTrakingUpdate = jest.fn();
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue({
      update: ticketTrakingUpdate
    });

    const result = await PullTicketService({ ticketId: 26, userId: 7, companyId: 1 });

    expect(Ticket.update).toHaveBeenCalledWith(
      { status: "open", userId: 7 },
      { where: { id: 26, companyId: 1, userId: null } }
    );
    expect(FindOrCreateATicketTrakingService).toHaveBeenCalledWith({
      ticketId: 26,
      companyId: 1,
      whatsappId: 3
    });
    expect(ticketTrakingUpdate).toHaveBeenCalledWith({
      startedAt: expect.any(Date),
      ratingAt: null,
      rated: false,
      whatsappId: 3,
      userId: 7
    });
    expect(result).toEqual({ id: 26, queueId: 1, companyId: 1, whatsappId: 3 });
    expect(chain.emit).toHaveBeenCalledWith("company-1-ticket", {
      action: "update",
      ticket: { id: 26, queueId: 1, companyId: 1, whatsappId: 3 }
    });
  });

  it("recusa quando outro agente já puxou (nenhuma linha afetada)", async () => {
    (Ticket.update as jest.Mock).mockResolvedValue([0]);

    await expect(
      PullTicketService({ ticketId: 26, userId: 7, companyId: 1 })
    ).rejects.toEqual(new AppError("ERR_TICKET_ALREADY_TAKEN", 409));

    expect(ShowTicketService).not.toHaveBeenCalled();
    expect(FindOrCreateATicketTrakingService).not.toHaveBeenCalled();
  });

  it("atualiza o TicketTraking (startedAt/userId) igual ao fluxo normal de Aceitar", async () => {
    (Ticket.update as jest.Mock).mockResolvedValue([1]);
    (ShowTicketService as jest.Mock).mockResolvedValue({
      id: 99,
      queueId: 2,
      companyId: 1,
      whatsappId: 5
    });
    const ticketTrakingUpdate = jest.fn();
    (FindOrCreateATicketTrakingService as jest.Mock).mockResolvedValue({
      update: ticketTrakingUpdate
    });

    await PullTicketService({ ticketId: 99, userId: 12, companyId: 1 });

    expect(FindOrCreateATicketTrakingService).toHaveBeenCalledWith({
      ticketId: 99,
      companyId: 1,
      whatsappId: 5
    });
    expect(ticketTrakingUpdate).toHaveBeenCalledWith({
      startedAt: expect.any(Date),
      ratingAt: null,
      rated: false,
      whatsappId: 5,
      userId: 12
    });
  });
});
