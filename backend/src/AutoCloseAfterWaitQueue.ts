import { Op } from "sequelize";
import Tag from "./models/Tag";
import TicketTag from "./models/TicketTag";
import { logger } from "./utils/logger";
import * as Sentry from "@sentry/node";
import {
  POST_DELIVERY_WAIT_TAG_NAME,
  clearAwaitingConfirmation
} from "./helpers/PostDeliveryWaitTag";
import {
  RATING_FEEDBACK_WAIT_TAG_NAME,
  clearAwaitingFeedback
} from "./helpers/RatingFeedbackWaitTag";
import ShowTicketService from "./services/TicketServices/ShowTicketService";
import SendWhatsAppMessage from "./services/WbotServices/SendWhatsAppMessage";
import UpdateTicketService from "./services/TicketServices/UpdateTicketService";
import FindOrCreateAiUserService from "./services/UserServices/FindOrCreateAiUserService";
import closingFarewell from "./helpers/ClosingFarewell";
import { getBrasiliaHour } from "./helpers/GreetingByTime";
import { buildTicketProtocol } from "./helpers/TicketProtocol";

const WAIT_MINUTES = 10;

// Pedido do Edison: depois que o boleto/liberação é entregue, o atendimento
// pergunta se o cliente precisa de algo mais e aguarda (ver
// AiAgentActions.askAnythingElseAndWait). Se não houver nenhuma resposta em
// 10 minutos, este job (rodando a cada minuto, mesmo padrão do
// wbotTransferTicketQueue) encerra sozinho: manda a despedida com o
// protocolo e fecha o ticket, disparando a pesquisa de satisfação.
export const AutoCloseAfterWaitQueue = async (): Promise<void> => {
  const tags = await Tag.findAll({
    where: { name: POST_DELIVERY_WAIT_TAG_NAME }
  });
  if (tags.length === 0) return;

  const tagIds = tags.map(t => t.id);
  const ticketTags = await TicketTag.findAll({
    where: { tagId: { [Op.in]: tagIds } }
  });

  const tagById = new Map(tags.map(t => [t.id, t]));

  await Promise.all(
    ticketTags.map(async ticketTag => {
      const limite = new Date(ticketTag.createdAt);
      limite.setMinutes(limite.getMinutes() + WAIT_MINUTES);
      if (new Date() < limite) return;

      const tag = tagById.get(ticketTag.tagId);
      if (!tag) return;

      try {
        const ticket = await ShowTicketService(ticketTag.ticketId, tag.companyId);

        if (ticket.status !== "closed") {
          await SendWhatsAppMessage({
            body: `Estamos finalizando este atendimento. *Protocolo:* #${buildTicketProtocol(
              ticket.id
            )}\n\nSNI Telecom agradece seu contato. ${closingFarewell(
              getBrasiliaHour()
            )}`,
            ticket
          });

          const aiUser = await FindOrCreateAiUserService(tag.companyId);
          await UpdateTicketService({
            ticketData: { status: "closed" },
            ticketId: ticket.id,
            companyId: tag.companyId,
            actionUserId: String(aiUser.id)
          });
        }

        await clearAwaitingConfirmation(ticketTag.ticketId, tag.companyId);
      } catch (err) {
        Sentry.captureException(err);
        logger.error(
          `[AutoCloseAfterWaitQueue] ticketId=${ticketTag.ticketId}: ${err}`
        );
      }
    })
  );

  await closeAwaitingFeedback();
};

// Pedido do Edison: quando a nota da pesquisa é 1 (Insatisfeito), a IA
// pergunta o que poderíamos melhorar (ver RatingHandler.handleRating). Se o
// cliente não responder em 10 minutos, só limpa a tag - o ticket já está
// fechado desde a avaliação, não precisa de despedida nem reabrir nada.
const closeAwaitingFeedback = async (): Promise<void> => {
  const tags = await Tag.findAll({
    where: { name: RATING_FEEDBACK_WAIT_TAG_NAME }
  });
  if (tags.length === 0) return;

  const tagIds = tags.map(t => t.id);
  const ticketTags = await TicketTag.findAll({
    where: { tagId: { [Op.in]: tagIds } }
  });

  const tagById = new Map(tags.map(t => [t.id, t]));

  await Promise.all(
    ticketTags.map(async ticketTag => {
      const limite = new Date(ticketTag.createdAt);
      limite.setMinutes(limite.getMinutes() + WAIT_MINUTES);
      if (new Date() < limite) return;

      const tag = tagById.get(ticketTag.tagId);
      if (!tag) return;

      try {
        await clearAwaitingFeedback(ticketTag.ticketId, tag.companyId);
      } catch (err) {
        Sentry.captureException(err);
        logger.error(
          `[AutoCloseAfterWaitQueue] (feedback) ticketId=${ticketTag.ticketId}: ${err}`
        );
      }
    })
  );
};
