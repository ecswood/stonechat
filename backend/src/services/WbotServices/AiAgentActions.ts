import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import Contact from "../../models/Contact";
import SgpService from "../SgpServices/SgpService";
import { WASocket } from "@whiskeysockets/baileys";
import formatBody from "../../helpers/Mustache";
import phoneOwnershipMatches from "../../helpers/PhoneOwnership";
import FindOrCreateAiUserService from "../UserServices/FindOrCreateAiUserService";

const ACTION_MARKERS = {
  transferirAtendimento: "Ação: Transferir para Atendimento",
  transferirTecnico: "Ação: Transferir para Técnico",
  buscarBoleto: "Ação: Buscar Boleto",
  liberarConfianca: "Ação: Liberar Confiança",
  desvincularCpf: "Ação: Desvincular CPF"
} as const;

export const AI_ATTENDANCE_TAG_NAME = "Atendimento IA";

export const registerAiAttendance = async (
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name: AI_ATTENDANCE_TAG_NAME, companyId },
    defaults: { name: AI_ATTENDANCE_TAG_NAME, companyId, color: "#8B5CF6" }
  });

  await TicketTag.findOrCreate({
    where: { ticketId: ticket.id, tagId: tag.id }
  });
};

export const isAiHandledTicket = async (
  ticketId: number,
  companyId: number
): Promise<boolean> => {
  const tag = await Tag.findOne({
    where: { name: AI_ATTENDANCE_TAG_NAME, companyId }
  });
  if (!tag) return false;

  const ticketTag = await TicketTag.findOne({
    where: { ticketId, tagId: tag.id }
  });
  return ticketTag !== null;
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

const jidOf = (contact: Contact): string => `${contact.number}@s.whatsapp.net`;

export const handleBuscarBoletoAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<void> => {
  const cliente = await SgpService.consultarCliente(cpfCnpj);

  if (!cliente) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody("Não localizei seu cadastro pelo CPF/CNPJ informado.", contact)
    });
    return;
  }

  const boleto = await SgpService.buscarBoleto(cpfCnpj);

  if (!boleto) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(
        "Não encontrei nenhuma fatura em aberto no seu CPF/CNPJ no momento.",
        contact
      )
    });
    return;
  }

  const linhaDigitavelTexto = boleto.linhaDigitavel
    ? `\n*Linha digitável:* ${boleto.linhaDigitavel}`
    : "";

  await wbot.sendMessage(jidOf(contact), {
    text: formatBody(
      `Segue sua fatura:\n\n*Valor:* R$ ${boleto.valor}\n*Vencimento:* ${boleto.vencimento}\n*Link do boleto:* ${boleto.linkBoleto}${linhaDigitavelTexto}`,
      contact
    )
  });

  if (boleto.pixCopiaCola) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(`*PIX Copia e Cola:*\n${boleto.pixCopiaCola}`, contact)
    });
  }

  await wbot.sendMessage(jidOf(contact), {
    text: formatBody(
      `Estamos finalizando este atendimento. *Protocolo:* #${ticket.id}\n\nQualquer coisa é só chamar!`,
      contact
    )
  });

  const aiUser = await FindOrCreateAiUserService(companyId);
  await UpdateTicketService({
    ticketData: { status: "closed" },
    ticketId: ticket.id,
    companyId,
    actionUserId: String(aiUser.id)
  });
};

export const handleLiberarConfiancaAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<void> => {
  const cliente = await SgpService.consultarCliente(cpfCnpj);

  if (!cliente) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody("Não localizei seu cadastro pelo CPF/CNPJ informado.", contact)
    });
    return;
  }

  if (!phoneOwnershipMatches(contact.number, cliente.telefones)) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(
        "Por segurança, não consegui confirmar que este WhatsApp pertence ao titular desse CPF/CNPJ. Vou te encaminhar para um atendente.",
        contact
      )
    });
    await transferToQueueByName("Atendimento", ticket, companyId);
    return;
  }

  const resultado = await SgpService.liberarConfianca(
    cpfCnpj,
    cliente.centralSenha,
    cliente.contratoId
  );

  if (resultado.sucesso) {
    await wbot.sendMessage(jidOf(contact), {
      text: formatBody(
        `Pronto! Liberei sua conexão por confiança até *${resultado.dataPromessa}*. Aguarde alguns minutos e verifique se voltou a funcionar.\n\n*Protocolo:* ${resultado.protocolo}`,
        contact
      )
    });
    const aiUser = await FindOrCreateAiUserService(companyId);
    await UpdateTicketService({
      ticketData: { status: "closed" },
      ticketId: ticket.id,
      companyId,
      actionUserId: String(aiUser.id)
    });
    return;
  }

  if (resultado.sucesso === false) {
    if (resultado.motivo === "ja_utilizado") {
      await wbot.sendMessage(jidOf(contact), {
        text: formatBody(
          "Você já utilizou a liberação por confiança recentemente, então não posso liberar automaticamente dessa vez. Vou te encaminhar para o setor financeiro.",
          contact
        )
      });
      await transferToQueueByName("Financeiro", ticket, companyId);
      return;
    }
  }

  await wbot.sendMessage(jidOf(contact), {
    text: formatBody(
      "Não consegui processar a liberação no momento. Vou te encaminhar para um atendente.",
      contact
    )
  });
  await transferToQueueByName("Atendimento", ticket, companyId);
};

export const handleDesvincularCpfAction = async (
  contact: Contact,
  wbot: WASocket
): Promise<void> => {
  const cpfAnterior = contact.cpfCnpj;
  await contact.update({ cpfCnpj: null });
  await wbot.sendMessage(jidOf(contact), {
    text: formatBody(
      `Pronto, este número foi desvinculado do CPF/CNPJ ${cpfAnterior} que estava cadastrado aqui. Pode me informar o novo CPF/CNPJ pra eu continuar te ajudando.`,
      contact
    )
  });
};

export const dispatchAiAction = async (
  responseText: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number,
  onCleaned?: (cleaned: string) => Promise<void>
): Promise<string> => {
  const cpfCnpj = contact.cpfCnpj;

  if (responseText.includes(ACTION_MARKERS.transferirAtendimento)) {
    const cleaned = responseText.replace(ACTION_MARKERS.transferirAtendimento, "").trim();
    if (onCleaned) await onCleaned(cleaned);
    await transferToQueueByName("Atendimento", ticket, companyId);
    return onCleaned ? "" : cleaned;
  }

  if (responseText.includes(ACTION_MARKERS.transferirTecnico)) {
    const cleaned = responseText.replace(ACTION_MARKERS.transferirTecnico, "").trim();
    if (onCleaned) await onCleaned(cleaned);
    await transferToQueueByName("Técnico", ticket, companyId);
    return onCleaned ? "" : cleaned;
  }

  if (responseText.includes(ACTION_MARKERS.buscarBoleto)) {
    const cleaned = responseText.replace(ACTION_MARKERS.buscarBoleto, "").trim();
    if (onCleaned) await onCleaned(cleaned);
    if (cpfCnpj) {
      await handleBuscarBoletoAction(cpfCnpj, ticket, contact, wbot, companyId);
    }
    return onCleaned ? "" : cleaned;
  }

  if (responseText.includes(ACTION_MARKERS.liberarConfianca)) {
    const cleaned = responseText.replace(ACTION_MARKERS.liberarConfianca, "").trim();
    if (onCleaned) await onCleaned(cleaned);
    if (cpfCnpj) {
      await handleLiberarConfiancaAction(cpfCnpj, ticket, contact, wbot, companyId);
    }
    return onCleaned ? "" : cleaned;
  }

  if (responseText.includes(ACTION_MARKERS.desvincularCpf)) {
    const cleaned = responseText.replace(ACTION_MARKERS.desvincularCpf, "").trim();
    if (onCleaned) await onCleaned(cleaned);
    await handleDesvincularCpfAction(contact, wbot);
    return onCleaned ? "" : cleaned;
  }

  return responseText;
};
