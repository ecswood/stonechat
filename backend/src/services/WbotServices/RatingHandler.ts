import moment from "moment";
import { getIO } from "../../libs/socket";
import Ticket from "../../models/Ticket";
import TicketTraking from "../../models/TicketTraking";
import UserRating from "../../models/UserRating";
import ShowWhatsAppService from "../WhatsappService/ShowWhatsAppService";
import formatBody from "../../helpers/Mustache";
import SendWhatsAppMessage from "./SendWhatsAppMessage";
import { markAwaitingFeedback } from "../../helpers/RatingFeedbackWaitTag";

// Pedido do Edison: além da mensagem de conclusão genérica da empresa (que
// continua sendo enviada, não é substituída), a IA reage à nota específica
// que o cliente deu na pesquisa de satisfação.
const ratingReplyMessage = (finalRate: number): string => {
  if (finalRate <= 1) {
    return "Sinto muito que não tenha ficado satisfeito. O que poderíamos melhorar?";
  }
  if (finalRate === 2) {
    return "Obrigado pelo retorno! Estamos sempre melhorando para te atender ainda melhor.";
  }
  return "Obrigado pela sua avaliação!";
};

export const verifyRating = (
  ticketTraking: TicketTraking,
  isAiHandled: boolean = false
): boolean => {
  if (
    ticketTraking &&
    ticketTraking.finishedAt === null &&
    (ticketTraking.userId !== null || isAiHandled) &&
    ticketTraking.ratingAt !== null
  ) {
    return true;
  }
  return false;
};

export const parseValidRating = (bodyMessage: string): number | null => {
  const trimmed = bodyMessage.trim();
  if (!/^\d{1,2}$/.test(trimmed)) {
    return null;
  }
  return parseInt(trimmed, 10);
};

export const handleRating = async (
  rate: number,
  ticket: Ticket,
  ticketTraking: TicketTraking
): Promise<void> => {
  if (Number.isNaN(rate)) {
    return;
  }

  const io = getIO();

  const { complationMessage } = await ShowWhatsAppService(
    ticket.whatsappId,
    ticket.companyId
  );

  let finalRate = rate;

  if (rate < 1) {
    finalRate = 1;
  }
  if (rate > 5) {
    finalRate = 5;
  }

  await UserRating.create({
    ticketId: ticketTraking.ticketId,
    companyId: ticketTraking.companyId,
    userId: ticketTraking.userId,
    rate: finalRate
  });

  await SendWhatsAppMessage({
    body: `‎${ratingReplyMessage(finalRate)}`,
    ticket
  });

  if (finalRate <= 1) {
    await markAwaitingFeedback(ticket.id, ticket.companyId);
  }

  if (complationMessage) {
    const body = formatBody(`\u200e${complationMessage}`, ticket.contact);
    await SendWhatsAppMessage({ body, ticket });
  }

  await ticketTraking.update({
    finishedAt: moment().toDate(),
    rated: true
  });

  await ticket.update({
    queueId: null,
    chatbot: null,
    queueOptionId: null,
    userId: null,
    status: "closed"
  });

  io.to(`company-${ticket.companyId}-open`)
    .to(`queue-${ticket.queueId}-open`)
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "delete",
      ticket,
      ticketId: ticket.id
    });

  io.to(`company-${ticket.companyId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(ticket.id.toString())
    .emit(`company-${ticket.companyId}-ticket`, {
      action: "update",
      ticket,
      ticketId: ticket.id
    });
};
