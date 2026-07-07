import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

export const registerAiAttendance = async (
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name: "Atendimento IA", companyId },
    defaults: { name: "Atendimento IA", companyId, color: "#8B5CF6" }
  });

  await TicketTag.findOrCreate({
    where: { ticketId: ticket.id, tagId: tag.id }
  });
};

export const transferToQueueByName = async (
  queueName: string,
  ticket: Ticket,
  companyId: number
): Promise<boolean> => {
  const queue = await Queue.findOne({ where: { name: queueName, companyId } });
  if (!queue) return false;

  await UpdateTicketService({
    ticketData: { queueId: queue.id, useIntegration: false, promptId: null },
    ticketId: ticket.id,
    companyId
  });
  return true;
};
