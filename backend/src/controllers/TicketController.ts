import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import Ticket from "../models/Ticket";
import AppError from "../errors/AppError";

import CreateTicketService from "../services/TicketServices/CreateTicketService";
import DeleteTicketService from "../services/TicketServices/DeleteTicketService";
import ListTicketsService from "../services/TicketServices/ListTicketsService";
import ShowTicketUUIDService from "../services/TicketServices/ShowTicketFromUUIDService";
import ShowTicketService from "../services/TicketServices/ShowTicketService";
import UpdateTicketService from "../services/TicketServices/UpdateTicketService";
import ListTicketsServiceKanban from "../services/TicketServices/ListTicketsServiceKanban";
import PullTicketService from "../services/TicketServices/PullTicketService";
import ListTicketsServicePipeline from "../services/TicketServices/ListTicketsServicePipeline";
import {
  registerAiAttendance,
  sendAndPersist
} from "../services/WbotServices/AiAgentActions";
import GetTicketWbot from "../helpers/GetTicketWbot";
import formatBody from "../helpers/Mustache";
import { formatDateBR } from "../helpers/FormatDateBR";
import CreateMessageService from "../services/MessageServices/CreateMessageService";
import { v4 as uuidv4 } from "uuid";
import { Configuration, OpenAIApi } from "openai";
import Message from "../models/Message";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";

type IndexQuery = {
  searchParam: string;
  pageNumber: string;
  status: string;
  date: string;
  updatedAt?: string;
  showAll: string;
  withUnreadMessages: string;
  queueIds: string;
  tags: string;
  users: string;
};

interface TicketData {
  contactId: number;
  status: string;
  queueId: number;
  userId: number;
  whatsappId: string;
  useIntegration: boolean;
  promptId: number;
  integrationId: number;
}

export const index = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;

  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsService({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    companyId,


  });
  return res.status(200).json({ tickets, count, hasMore });
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { contactId, status, userId, queueId, whatsappId }: TicketData = req.body;
  const { companyId } = req.user;

  const ticket = await CreateTicketService({
    contactId,
    status,
    userId,
    companyId,
    queueId,
    whatsappId
  });

  const io = getIO();
  io.to(ticket.status).emit(`company-${companyId}-ticket`, {
    action: "update",
    ticket
  });
  return res.status(200).json(ticket);
};

export const kanban = async (req: Request, res: Response): Promise<Response> => {
  const {
    pageNumber,
    status,
    date,
    updatedAt,
    searchParam,
    showAll,
    queueIds: queueIdsStringified,
    tags: tagIdsStringified,
    users: userIdsStringified,
    withUnreadMessages
  } = req.query as IndexQuery;


  const userId = req.user.id;
  const { companyId } = req.user;

  let queueIds: number[] = [];
  let tagsIds: number[] = [];
  let usersIds: number[] = [];

  if (queueIdsStringified) {
    queueIds = JSON.parse(queueIdsStringified);
  }

  if (tagIdsStringified) {
    tagsIds = JSON.parse(tagIdsStringified);
  }

  if (userIdsStringified) {
    usersIds = JSON.parse(userIdsStringified);
  }

  const { tickets, count, hasMore } = await ListTicketsServiceKanban({
    searchParam,
    tags: tagsIds,
    users: usersIds,
    pageNumber,
    status,
    date,
    updatedAt,
    showAll,
    userId,
    queueIds,
    withUnreadMessages,
    companyId

  });

  return res.status(200).json({ tickets, count, hasMore });
};

export const pipeline = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile } = req.user;
  const { queueIds: queueIdsStringified } = req.query as { queueIds?: string };

  let queueIds: number[] = [];
  if (queueIdsStringified) {
    try {
      queueIds = JSON.parse(queueIdsStringified);
    } catch {
      queueIds = [];
    }
  }

  const pipelineTickets = await ListTicketsServicePipeline({
    companyId,
    profile,
    queueIds
  });

  return res.status(200).json(pipelineTickets);
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  const contact = await ShowTicketService(ticketId, companyId);
  return res.status(200).json(contact);
};

export const showFromUUID = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { uuid } = req.params;

  const ticket: Ticket = await ShowTicketUUIDService(uuid);

  return res.status(200).json(ticket);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const ticketData: TicketData = req.body;
  const { companyId, id} = req.user;

  const result = await UpdateTicketService({
    ticketData,
    ticketId,
    companyId,
    actionUserId: id
  });

  if (!result) {
    throw new AppError("ERR_UPDATING_TICKET", 500);
  }

  const { ticket } = result;


  return res.status(200).json(ticket);
};

// Botão do atendente "Voltar atendimento para IA" - pedido do Edison
// (2026-08-25): a IA volta a responder o cliente SEM tirar o ticket do
// Kanban do atendente (fica em "Atendendo", com o mesmo userId/queueId,
// não volta pra "IA"). Só liga a flag `aiTakeover` (ver
// wbotMessageListener.ts) e reaplica a tag "Atendimento IA" como indicador
// visual - não usa UpdateTicketService de propósito, pra não mexer em
// status/fila/usuário. Pausa sozinho assim que o atendente mandar uma
// mensagem manual (ver MessageController.store/clearAiAttendance).
//
// Cria também um aviso na conversa com mediaType "system_note" - pedido do
// Edison: isso precisa aparecer pro atendente no chat, mas NUNCA pode ser
// enviado ao cliente de verdade. Por isso não passa pelo wbot (nenhum
// wbot.sendMessage aqui) - é só um registro local + broadcast via socket
// (CreateMessageService), e mediaType "system_note" fica de fora do
// histórico que a IA usa pra montar contexto (ver BuildConversationHistory,
// que só aceita conversation/extendedTextMessage/audio).
export const returnToAi = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);
  await ticket.update({ aiTakeover: true });
  await registerAiAttendance(ticket, companyId);

  await CreateMessageService({
    messageData: {
      id: uuidv4(),
      ticketId: ticket.id,
      body: "🤖 Atendimento devolvido para a IA (visível só para você, o cliente não vê isso)",
      fromMe: true,
      read: true,
      mediaType: "system_note"
    },
    companyId
  });

  return res.status(200).json(ticket);
};

// Botão "Enviar" no diálogo de boletos do atendente - manda a mesma
// mensagem que a IA manda (handleBuscarBoletoAction), só que pro boleto
// específico escolhido, não pro de vencimento mais próximo. Recebe os
// dados do boleto do próprio front (ele já tem a lista carregada), não
// consulta o SGP de novo aqui.
export const sendBoleto = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;
  const { valor, vencimento, linkBoleto, linhaDigitavel, pixCopiaCola } =
    req.body as {
      valor?: string;
      vencimento?: string;
      linkBoleto?: string;
      linhaDigitavel?: string | null;
      pixCopiaCola?: string | null;
    };

  if (!valor || !vencimento || !linkBoleto) {
    throw new AppError("ERR_INVALID_BOLETO_DATA", 400);
  }

  const ticket = await ShowTicketService(ticketId, companyId);
  const wbot = await GetTicketWbot(ticket);

  const linhaDigitavelTexto = linhaDigitavel
    ? `\n*Linha digitável:* ${linhaDigitavel}`
    : "";

  await sendAndPersist(
    wbot,
    ticket.contact,
    ticket,
    companyId,
    formatBody(
      `Segue sua fatura:\n\n*Valor:* R$ ${valor}\n*Vencimento:* ${formatDateBR(
        vencimento
      )}\n*Link do boleto:* ${linkBoleto}${linhaDigitavelTexto}`,
      ticket.contact
    ),
    false
  );

  if (pixCopiaCola) {
    await sendAndPersist(
      wbot,
      ticket.contact,
      ticket,
      companyId,
      formatBody(`*PIX Copia e Cola:*\n${pixCopiaCola}`, ticket.contact),
      false
    );
  }

  return res.status(200).json({ enviado: true });
};

// Botão "Resumir atendimento" do painel do ticket - pedido do Edison: um
// resumo gerado pela IA de tudo que foi conversado nesta sessão de
// atendimento, pro atendente ler rápido sem rolar o histórico inteiro.
// Reaproveita a mesma configuração de IA (apiKey/model) da conexão
// WhatsApp do ticket - não manda nada pro cliente, só devolve o texto pro
// painel.
export const resumirConversa = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  const ticket = await ShowTicketService(ticketId, companyId);
  const { prompt } = await ShowWhatsAppService(ticket.whatsappId, companyId);

  if (!prompt) {
    throw new AppError("ERR_NO_PROMPT_CONFIGURED", 400);
  }

  const messages = await Message.findAll({
    where: { ticketId: ticket.id },
    order: [["createdAt", "ASC"]],
    limit: 300
  });

  const historico = messages
    .filter(m =>
      ["conversation", "extendedTextMessage", "audio"].includes(m.mediaType)
    )
    .map(m => `${m.fromMe ? "Atendente/IA" : "Cliente"}: ${m.body}`)
    .join("\n");

  if (!historico.trim()) {
    return res.status(200).json({
      resumo: "Ainda não há mensagens de texto nesta conversa pra resumir."
    });
  }

  const configuration = new Configuration({ apiKey: prompt.apiKey });
  const openai = new OpenAIApi(configuration);

  const chat = await openai.createChatCompletion({
    model: prompt.model,
    messages: [
      {
        role: "system",
        content:
          "Você resume atendimentos de suporte ao cliente de um provedor de internet, em português do Brasil, pro atendente humano ler rápido. Responda em bullets curtos e objetivos cobrindo: motivo do contato, o que já foi verificado/feito (incluindo ações automáticas como consulta de boleto, liberação, diagnóstico), e o status atual/próximo passo. Nunca invente nada que não esteja na conversa."
      },
      { role: "user", content: historico }
    ],
    max_tokens: 500,
    temperature: 0.3
  });

  const resumo = chat.data.choices[0].message?.content ?? "";

  return res.status(200).json({ resumo });
};

export const pull = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId, id } = req.user;

  const ticket = await PullTicketService({
    ticketId,
    userId: Number(id),
    companyId
  });

  return res.status(200).json(ticket);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;
  const { companyId } = req.user;

  await ShowTicketService(ticketId, companyId);

  const ticket = await DeleteTicketService(ticketId);

  const io = getIO();
  io.to(ticketId)
    .to(`company-${companyId}-${ticket.status}`)
    .to(`company-${companyId}-notification`)
    .to(`queue-${ticket.queueId}-${ticket.status}`)
    .to(`queue-${ticket.queueId}-notification`)
    .emit(`company-${companyId}-ticket`, {
      action: "delete",
      ticketId: +ticketId
    });

  return res.status(200).json({ message: "ticket deleted" });
};
