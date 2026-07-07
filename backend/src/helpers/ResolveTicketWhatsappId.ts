import AppError from "../errors/AppError";
import Ticket from "../models/Ticket";

const resolveTicketWhatsappId = (ticket: Ticket): string => {
  if (ticket.whatsappId === null || ticket.whatsappId === undefined) {
    throw new AppError("ERR_TICKET_WITHOUT_WHATSAPP");
  }
  return ticket.whatsappId.toString();
};

export default resolveTicketWhatsappId;
