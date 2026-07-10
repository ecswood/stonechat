import { WAMessage } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import resolveAckStatus from "../../helpers/ResolveAckStatus";
import CreateMessageService from "../MessageServices/CreateMessageService";

import formatBody from "../../helpers/Mustache";

interface Request {
  body: string;
  ticket: Ticket;
  quotedMsg?: Message;
}

const SendWhatsAppMessage = async ({
  body,
  ticket,
  quotedMsg
}: Request): Promise<WAMessage> => {
  let options = {};
  const wbot = await GetTicketWbot(ticket);
  const number = `${ticket.contact.number}@${
    ticket.isGroup ? "g.us" : "s.whatsapp.net"
  }`;

  if (quotedMsg) {
      const chatMessages = await Message.findOne({
        where: {
          id: quotedMsg.id
        }
      });

      if (chatMessages) {
        const msgFound = JSON.parse(chatMessages.dataJson);

        options = {
          quoted: {
            key: msgFound.key,
            message: {
              extendedTextMessage: msgFound.message.extendedTextMessage
            }
          }
        };
      }
    
  }

  try {
    const formattedBody = formatBody(body, ticket.contact);
    const sentMessage = await wbot.sendMessage(number,{
        text: formattedBody
      },
      {
        ...options
      }
    );

    await ticket.update({ lastMessage: formattedBody });

    // O corpo pode conter o marcador invisível ‎ (usado pela pesquisa
    // de satisfação e mensagem de encerramento), que faz o listener de eco
    // em wbotMessageListener.ts ignorar o salvamento de propósito (assume
    // que já foi salvo em algum outro lugar). Como esta função não tinha
    // nenhum outro ponto de salvamento, essas mensagens nunca apareciam no
    // painel mesmo chegando no WhatsApp. Salva explicitamente aqui -
    // idempotente (upsert), não duplica quando o eco também salvar.
    await CreateMessageService({
      messageData: {
        id: sentMessage.key.id!,
        ticketId: ticket.id,
        body: formattedBody,
        fromMe: true,
        read: true,
        mediaType: "extendedTextMessage",
        ack: resolveAckStatus(sentMessage.status)
      },
      companyId: ticket.companyId
    });

    return sentMessage;
  } catch (err) {
    Sentry.captureException(err);
    console.log(err);
    throw new AppError("ERR_SENDING_WAPP_MSG");
  }
};

export default SendWhatsAppMessage;
