jest.mock("../../../models/Ticket", () => ({
  __esModule: true,
  default: { update: jest.fn() }
}));
jest.mock("../ShowTicketService", () => ({
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
      companyId: 1
    });

    const result = await PullTicketService({ ticketId: 26, userId: 7, companyId: 1 });

    expect(Ticket.update).toHaveBeenCalledWith(
      { status: "open", userId: 7 },
      { where: { id: 26, companyId: 1, userId: null } }
    );
    expect(result).toEqual({ id: 26, queueId: 1, companyId: 1 });
    expect(chain.emit).toHaveBeenCalledWith("company-1-ticket", {
      action: "update",
      ticket: { id: 26, queueId: 1, companyId: 1 }
    });
  });

  it("recusa quando outro agente já puxou (nenhuma linha afetada)", async () => {
    (Ticket.update as jest.Mock).mockResolvedValue([0]);

    await expect(
      PullTicketService({ ticketId: 26, userId: 7, companyId: 1 })
    ).rejects.toEqual(new AppError("ERR_TICKET_ALREADY_TAKEN", 409));

    expect(ShowTicketService).not.toHaveBeenCalled();
  });
});
