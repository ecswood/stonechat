import { getIO } from "../../libs/socket";
import AppError from "../../errors/AppError";
import Ticket from "../../models/Ticket";
import ShowTicketService from "./ShowTicketService";

interface Request {
  ticketId: string | number;
  userId: number;
  companyId: number;
}

const PullTicketService = async ({
  ticketId,
  userId,
  companyId
}: Request): Promise<Ticket> => {
  const [affectedRows] = await Ticket.update(
    { status: "open", userId },
    { where: { id: ticketId, companyId, userId: null } }
  );

  if (affectedRows === 0) {
    throw new AppError("ERR_TICKET_ALREADY_TAKEN", 409);
  }

  const ticket = await ShowTicketService(ticketId, companyId);

  const io = getIO();
  io.to(`company-${companyId}-pending`)
    .to(`company-${companyId}-open`)
    .to(`queue-${ticket.queueId}-pending`)
    .to(`queue-${ticket.queueId}-open`)
    .to(`company-${companyId}-pipeline`)
    .to(ticketId.toString())
    .to(`user-${userId}`)
    .emit(`company-${companyId}-ticket`, {
      action: "update",
      ticket
    });

  return ticket;
};

export default PullTicketService;
