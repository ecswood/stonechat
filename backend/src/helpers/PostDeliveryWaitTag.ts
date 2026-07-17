import Tag from "../models/Tag";
import TicketTag from "../models/TicketTag";

// Pedido do Edison: depois de entregar boleto/liberação, o atendimento não
// fecha na hora — a IA pergunta se pode ajudar em algo mais e aguarda. Essa
// tag marca esse "aguardando" no próprio ticket (mesmo mecanismo de
// "Atendimento IA"/"Pendente CPF: ..."), guardando o horário em que a espera
// começou (createdAt da própria TicketTag) pra um job periódico decidir
// quando os 10 minutos sem resposta se esgotaram.
export const POST_DELIVERY_WAIT_TAG_NAME = "Aguardando Confirmação de Encerramento";

export const markAwaitingConfirmation = async (
  ticketId: number,
  companyId: number
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name: POST_DELIVERY_WAIT_TAG_NAME, companyId },
    defaults: { name: POST_DELIVERY_WAIT_TAG_NAME, companyId, color: "#0EA5E9" }
  });
  await TicketTag.findOrCreate({ where: { ticketId, tagId: tag.id } });
};

export const getAwaitingConfirmationSince = async (
  ticketId: number,
  companyId: number
): Promise<Date | null> => {
  const tag = await Tag.findOne({ where: { name: POST_DELIVERY_WAIT_TAG_NAME, companyId } });
  if (!tag) return null;

  const ticketTag = await TicketTag.findOne({ where: { ticketId, tagId: tag.id } });
  return ticketTag ? ticketTag.createdAt : null;
};

export const clearAwaitingConfirmation = async (
  ticketId: number,
  companyId: number
): Promise<void> => {
  const tag = await Tag.findOne({ where: { name: POST_DELIVERY_WAIT_TAG_NAME, companyId } });
  if (!tag) return;

  await TicketTag.destroy({ where: { ticketId, tagId: tag.id } });
};
