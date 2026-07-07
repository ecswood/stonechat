import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";

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
