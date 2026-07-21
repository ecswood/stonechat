import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";

// Pedido do Edison: quando o cliente dá nota 1 (Insatisfeito) na pesquisa de
// satisfação, a IA pergunta o que poderíamos melhorar e aguarda a resposta
// pra registrar no UserRating.feedback. Essa tag marca esse "aguardando"
// (mesmo mecanismo de PostDeliveryWaitTag/"Pendente CPF: ..."), guardando o
// horário em que a espera começou (createdAt da própria TicketTag) pra
// AutoCloseAfterWaitQueue encerrar sozinho se não vier resposta em 10 min.
export const RATING_FEEDBACK_WAIT_TAG_NAME = "Aguardando Feedback de Avaliação";

export const markAwaitingFeedback = async (
  ticketId: number,
  companyId: number
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name: RATING_FEEDBACK_WAIT_TAG_NAME, companyId },
    defaults: { name: RATING_FEEDBACK_WAIT_TAG_NAME, companyId, color: "#F59E0B" }
  });
  await TicketTag.findOrCreate({ where: { ticketId, tagId: tag.id } });
};

export const getAwaitingFeedbackSince = async (
  ticketId: number,
  companyId: number
): Promise<Date | null> => {
  const tag = await Tag.findOne({ where: { name: RATING_FEEDBACK_WAIT_TAG_NAME, companyId } });
  if (!tag) return null;

  const ticketTag = await TicketTag.findOne({ where: { ticketId, tagId: tag.id } });
  return ticketTag ? ticketTag.createdAt : null;
};

export const clearAwaitingFeedback = async (
  ticketId: number,
  companyId: number
): Promise<void> => {
  const tag = await Tag.findOne({ where: { name: RATING_FEEDBACK_WAIT_TAG_NAME, companyId } });
  if (!tag) return;

  await TicketTag.destroy({ where: { ticketId, tagId: tag.id } });
};
