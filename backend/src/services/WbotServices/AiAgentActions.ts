import Tag from "../../models/Tag";
import TicketTag from "../../models/TicketTag";
import Ticket from "../../models/Ticket";
import Queue from "../../models/Queue";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import Contact from "../../models/Contact";
import SgpService from "../SgpServices/SgpService";
import { WASocket } from "@whiskeysockets/baileys";
import formatBody from "../../helpers/Mustache";
import FindOrCreateAiUserService from "../UserServices/FindOrCreateAiUserService";
import closingFarewell from "../../helpers/ClosingFarewell";
import { getBrasiliaHour } from "../../helpers/GreetingByTime";
import { formatDateBR } from "../../helpers/FormatDateBR";
import { maskCpfCnpj } from "../../helpers/MaskCpfCnpj";
import { ACTION_MARKERS, hasAnyActionMarker } from "../../helpers/ActionMarkers";
import { HALLUCINATED_RESULT_PATTERN } from "../../helpers/HallucinatedResultPattern";
import CreateMessageService from "../MessageServices/CreateMessageService";
import resolveAckStatus from "../../helpers/ResolveAckStatus";
import {
  markAwaitingConfirmation,
  clearAwaitingConfirmation
} from "../../helpers/PostDeliveryWaitTag";

export { hasAnyActionMarker };

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

export const TECHNICAL_DIAGNOSTIC_TAG_NAME = "Diagnostico Tecnico";

export const isTechnicalDiagnosticTicket = async (
  ticketId: number,
  companyId: number
): Promise<boolean> => {
  const tag = await Tag.findOne({
    where: { name: TECHNICAL_DIAGNOSTIC_TAG_NAME, companyId }
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
    ticketData: { queueId: queue.id, useIntegration: false, promptId: null, status: "pending" },
    ticketId: ticket.id,
    companyId
  });
  return true;
};

const jidOf = (contact: Contact): string => `${contact.number}@s.whatsapp.net`;

// Regressão real: mensagens enviadas via wbot.sendMessage puro só são salvas
// no banco depois, de forma assíncrona, pelo listener de eco - e esse eco
// pode falhar ou atrasar (sessão do WhatsApp instável, "Bad MAC"/"No matching
// sessions", etc.), fazendo mensagens sumirem do painel ou aparecerem fora de
// ordem (ex: pesquisa de satisfação, que salva de forma síncrona - ver
// SendWhatsAppMessage.ts - aparecendo antes do conteúdo real que foi enviado
// primeiro). Toda mensagem que a IA manda neste arquivo passa por aqui e
// salva na hora, na ordem real de envio - elimina a corrida e a perda.
const sendAndPersist = async (
  wbot: WASocket,
  contact: Contact,
  ticket: Ticket,
  companyId: number,
  text: string
): Promise<void> => {
  const sentMessage = await wbot.sendMessage(jidOf(contact), { text });
  await CreateMessageService({
    messageData: {
      id: sentMessage!.key!.id!,
      ticketId: ticket.id,
      body: text,
      fromMe: true,
      read: true,
      mediaType: "extendedTextMessage",
      ack: resolveAckStatus(sentMessage!.status)
    },
    companyId
  });
};

// Pedido do Edison: depois de entregar boleto/liberação, o atendimento não
// fecha na hora — pergunta se pode ajudar em algo mais e aguarda. Se o
// cliente pedir outra coisa ou confirmar que não precisa de nada, o fluxo
// normal (Ação: Encerrar Atendimento) fecha depois. Se não houver resposta,
// um job periódico (AutoCloseAfterWaitQueue) fecha sozinho após 10 minutos.
const askAnythingElseAndWait = async (
  wbot: WASocket,
  contact: Contact,
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  await sendAndPersist(
    wbot,
    contact,
    ticket,
    companyId,
    formatBody("Posso te ajudar em algo mais?", contact)
  );
  await markAwaitingConfirmation(ticket.id, companyId);
};

// Regressão real 2026-07-17: uma falha de rede/timeout na consulta ao SGP
// era engolida silenciosamente (virava null) e o cliente ouvia "não
// localizei seu cadastro"/"não encontrei fatura em aberto" mesmo quando o
// CPF era real e tinha fatura de verdade - a consulta simplesmente não
// rodou. Agora SgpService propaga esses erros; aqui tratamos isso como o
// que realmente é (falha de consulta), nunca como "não encontrado".
const CONSULTATION_ERROR_MESSAGE =
  "Não consegui verificar seu cadastro agora. Tente novamente em instantes ou fale com um atendente.";

const sendConsultationError = async (
  wbot: WASocket,
  contact: Contact,
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  await sendAndPersist(
    wbot,
    contact,
    ticket,
    companyId,
    formatBody(CONSULTATION_ERROR_MESSAGE, contact)
  );
  await transferToQueueByName("Atendimento", ticket, companyId);
};

export const handleBuscarBoletoAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number,
  isLastAction: boolean = true
): Promise<void> => {
  let cliente;
  let boleto;
  try {
    cliente = await SgpService.consultarCliente(cpfCnpj);
    if (cliente) {
      boleto = await SgpService.buscarBoleto(cpfCnpj);
    }
  } catch {
    await sendConsultationError(wbot, contact, ticket, companyId);
    return;
  }

  if (!cliente) {
    await sendAndPersist(
      wbot,
      contact,
      ticket,
      companyId,
      formatBody("Não localizei seu cadastro pelo CPF/CNPJ informado.", contact)
    );
    return;
  }

  if (!boleto) {
    await sendAndPersist(
      wbot,
      contact,
      ticket,
      companyId,
      formatBody(
        "Não encontrei nenhuma fatura em aberto no seu CPF/CNPJ no momento.",
        contact
      )
    );
    return;
  }

  const linhaDigitavelTexto = boleto.linhaDigitavel
    ? `\n*Linha digitável:* ${boleto.linhaDigitavel}`
    : "";

  await sendAndPersist(
    wbot,
    contact,
    ticket,
    companyId,
    formatBody(
      `Segue sua fatura:\n\n*Valor:* R$ ${boleto.valor}\n*Vencimento:* ${formatDateBR(boleto.vencimento)}\n*Link do boleto:* ${boleto.linkBoleto}${linhaDigitavelTexto}`,
      contact
    )
  );

  if (boleto.pixCopiaCola) {
    await sendAndPersist(
      wbot,
      contact,
      ticket,
      companyId,
      formatBody(`*PIX Copia e Cola:*\n${boleto.pixCopiaCola}`, contact)
    );
  }

  // Quando há outra tarefa pendente na mesma mensagem (ex: boleto + religação),
  // só a ÚLTIMA ação da sequência pergunta se pode ajudar em algo mais —
  // senão essa pergunta sai antes da informação da tarefa seguinte.
  if (!isLastAction) return;

  await askAnythingElseAndWait(wbot, contact, ticket, companyId);
};

export const handleLiberarConfiancaAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number,
  isLastAction: boolean = true
): Promise<void> => {
  let cliente;
  try {
    cliente = await SgpService.consultarCliente(cpfCnpj);
  } catch {
    await sendConsultationError(wbot, contact, ticket, companyId);
    return;
  }

  if (!cliente) {
    await sendAndPersist(
      wbot,
      contact,
      ticket,
      companyId,
      formatBody("Não localizei seu cadastro pelo CPF/CNPJ informado.", contact)
    );
    return;
  }

  const resultado = await SgpService.liberarConfianca(
    cpfCnpj,
    cliente.centralSenha,
    cliente.contratoId
  );

  if (resultado.sucesso) {
    // O protocolo aqui é o retornado pelo próprio SGP (diferente do protocolo
    // baseado no ticket usado no encerramento) - faz parte do resultado
    // entregue, não da despedida, então vai sempre, mesmo se isLastAction=false.
    const pertinente = `Pronto! Liberei sua conexão por confiança até *${formatDateBR(resultado.dataPromessa)}*. Aguarde alguns minutos e verifique se voltou a funcionar.\n\n*Protocolo:* ${resultado.protocolo}`;

    await sendAndPersist(wbot, contact, ticket, companyId, formatBody(pertinente, contact));

    // Quando há outra tarefa pendente na mesma mensagem (ex: boleto + religação),
    // só a ÚLTIMA ação da sequência pergunta se pode ajudar em algo mais —
    // senão essa pergunta sai antes da informação da tarefa seguinte.
    if (!isLastAction) return;

    await askAnythingElseAndWait(wbot, contact, ticket, companyId);
    return;
  }

  if (resultado.sucesso === false) {
    if (resultado.motivo === "ja_utilizado") {
      await sendAndPersist(
        wbot,
        contact,
        ticket,
        companyId,
        formatBody(
          "Você já utilizou a liberação por confiança recentemente, então não posso liberar automaticamente dessa vez. Vou te encaminhar para o setor financeiro.",
          contact
        )
      );
      await transferToQueueByName("Financeiro", ticket, companyId);
      return;
    }
  }

  await sendAndPersist(
    wbot,
    contact,
    ticket,
    companyId,
    formatBody(
      "Não consegui processar a liberação no momento. Vou te encaminhar para um atendente.",
      contact
    )
  );
  await transferToQueueByName("Atendimento", ticket, companyId);
};

export const handleDesvincularCpfAction = async (
  contact: Contact,
  wbot: WASocket,
  ticket: Ticket,
  companyId: number,
  isLastAction: boolean = true
): Promise<void> => {
  const cpfAnterior = contact.cpfCnpj;

  if (!cpfAnterior) {
    await sendAndPersist(
      wbot,
      contact,
      ticket,
      companyId,
      formatBody(
        "Não encontrei nenhum CPF/CNPJ vinculado a este número pra desvincular.",
        contact
      )
    );
    return;
  }

  await contact.update({ cpfCnpj: null });

  const desvinculoTexto = `Pronto, este número foi desvinculado do CPF/CNPJ ${maskCpfCnpj(cpfAnterior)} que estava cadastrado aqui.`;

  // Quando há outra tarefa pendente na mesma mensagem, só a ÚLTIMA ação da
  // sequência encerra o atendimento — senão a despedida e a pesquisa de
  // satisfação saem antes da informação da tarefa seguinte.
  if (!isLastAction) {
    await sendAndPersist(wbot, contact, ticket, companyId, formatBody(desvinculoTexto, contact));
    return;
  }

  await sendAndPersist(
    wbot,
    contact,
    ticket,
    companyId,
    formatBody(
      `${desvinculoTexto}\n\nSNI Telecom agradece seu contato. ${closingFarewell(getBrasiliaHour())}`,
      contact
    )
  );

  const aiUser = await FindOrCreateAiUserService(companyId);
  await UpdateTicketService({
    ticketData: { status: "closed" },
    ticketId: ticket.id,
    companyId,
    actionUserId: String(aiUser.id)
  });
};

export const handleVerificarBloqueioAction = async (
  cpfCnpj: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<void> => {
  const [tag] = await Tag.findOrCreate({
    where: { name: TECHNICAL_DIAGNOSTIC_TAG_NAME, companyId },
    defaults: { name: TECHNICAL_DIAGNOSTIC_TAG_NAME, companyId, color: "#F59E0B" }
  });
  await TicketTag.findOrCreate({
    where: { ticketId: ticket.id, tagId: tag.id }
  });

  let cliente;
  try {
    cliente = await SgpService.consultarCliente(cpfCnpj);
  } catch {
    return;
  }
  if (!cliente) return;

  if (cliente.contratoStatus.trim().toLowerCase() !== "ativo") {
    await sendAndPersist(
      wbot,
      contact,
      ticket,
      companyId,
      formatBody(
        `Verifiquei seu cadastro e encontrei uma pendência: o contrato está com status "${cliente.contratoStatus}". Isso pode ser a causa do problema. Recomendo regularizar para restabelecer o serviço — posso te ajudar a localizar o boleto em aberto, se quiser.`,
        contact
      )
    );
  }
};

export const handleEncerrarAtendimentoAction = async (
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number
): Promise<void> => {
  await sendAndPersist(
    wbot,
    contact,
    ticket,
    companyId,
    formatBody(
      `SNI Telecom agradece seu contato. ${closingFarewell(getBrasiliaHour())}`,
      contact
    )
  );

  const aiUser = await FindOrCreateAiUserService(companyId);
  await UpdateTicketService({
    ticketData: { status: "closed" },
    ticketId: ticket.id,
    companyId,
    actionUserId: String(aiUser.id)
  });
  await clearAwaitingConfirmation(ticket.id, companyId);
};

const CPF_MENTION_REGEX = /cpf|cnpj/i;

// Regressão real: a IA às vezes aciona a frase-gatilho sem CPF/CNPJ conhecido
// e sem pedir o documento na própria fala (ex: só "vou agilizar sua
// solicitação, um momento"), deixando o atendimento parado sem próximo passo.
// Como a ação em si já é pulada quando cpfCnpj está ausente, garantimos aqui
// que o cliente sempre recebe um pedido explícito do CPF/CNPJ nesse caso.
const sendCpfRequestFallback = async (
  cleaned: string,
  contact: Contact,
  wbot: WASocket,
  ticket: Ticket,
  companyId: number
): Promise<void> => {
  if (CPF_MENTION_REGEX.test(cleaned)) return;

  await sendAndPersist(
    wbot,
    contact,
    ticket,
    companyId,
    formatBody(
      "Pra prosseguir, me informe o CPF/CNPJ do titular do contrato.",
      contact
    )
  );
};

const SAFE_NARRATION_FALLBACK = "Um momento, já verifico.";

// Regressão real 2026-07-17: a IA afirmou "não consegui localizar o
// cadastro" e, na mesma resposta, incluiu a frase de Ação corretamente -
// a busca real rodou e encontrou o cliente, entregando o boleto segundos
// depois de ter dito que não tinha achado nada. A frase de Ação presente
// não é garantia de que a narração ANTES dela seja verdadeira: ela nunca
// pode afirmar um resultado de consulta, porque só a Ação confirma isso.
const sanitizeNarration = (narration: string): string =>
  HALLUCINATED_RESULT_PATTERN.test(narration)
    ? SAFE_NARRATION_FALLBACK
    : narration;

type ActionMarkerKey = keyof typeof ACTION_MARKERS;

// Ações que só podem ser executadas com CPF/CNPJ já vinculado ao contato.
const CPF_REQUIRED_MARKERS: ActionMarkerKey[] = [
  "buscarBoleto",
  "liberarConfianca",
  "verificarBloqueio"
];

// Pedido do Edison: a decisão de acionar a consulta de verdade não pode
// depender da IA reconhecer que precisa fazer isso — ela pode inventar
// qualquer frase nova pra "responder" sem consultar nada. Aqui o sistema
// marca no PRÓPRIO TICKET (tag, mesmo mecanismo de "Atendimento IA") qual
// ação ficou pendente de CPF/CNPJ; assim que o CPF chegar, o sistema aciona
// essa ação sozinho, independente do que a IA disser na mesma mensagem — a
// IA continua livre pra conversar/narrar, só não decide mais SE a consulta
// acontece.
const PENDING_CPF_ACTION_TAG_NAMES: Partial<Record<ActionMarkerKey, string>> = {
  buscarBoleto: "Pendente CPF: Buscar Boleto",
  liberarConfianca: "Pendente CPF: Liberar Confiança",
  verificarBloqueio: "Pendente CPF: Verificar Bloqueio"
};

const markPendingCpfAction = async (
  ticketId: number,
  companyId: number,
  key: ActionMarkerKey
): Promise<void> => {
  const tagName = PENDING_CPF_ACTION_TAG_NAMES[key];
  if (!tagName) return;

  const [tag] = await Tag.findOrCreate({
    where: { name: tagName, companyId },
    defaults: { name: tagName, companyId, color: "#EAB308" }
  });
  await TicketTag.findOrCreate({ where: { ticketId, tagId: tag.id } });
};

const getPendingCpfAction = async (
  ticketId: number,
  companyId: number
): Promise<ActionMarkerKey | null> => {
  const keys = Object.keys(PENDING_CPF_ACTION_TAG_NAMES) as ActionMarkerKey[];

  for (const key of keys) {
    const tagName = PENDING_CPF_ACTION_TAG_NAMES[key]!;
    // eslint-disable-next-line no-await-in-loop
    const tag = await Tag.findOne({ where: { name: tagName, companyId } });
    if (!tag) continue;

    // eslint-disable-next-line no-await-in-loop
    const ticketTag = await TicketTag.findOne({ where: { ticketId, tagId: tag.id } });
    if (ticketTag) return key;
  }

  return null;
};

const clearPendingCpfAction = async (
  ticketId: number,
  companyId: number,
  key: ActionMarkerKey
): Promise<void> => {
  const tagName = PENDING_CPF_ACTION_TAG_NAMES[key];
  if (!tagName) return;

  const tag = await Tag.findOne({ where: { name: tagName, companyId } });
  if (!tag) return;

  await TicketTag.destroy({ where: { ticketId, tagId: tag.id } });
};

const runActionHandler = async (
  key: ActionMarkerKey,
  cpfCnpj: string | null | undefined,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number,
  isLastAction: boolean
): Promise<void> => {
  switch (key) {
    case "transferirAtendimento":
      await transferToQueueByName("Atendimento", ticket, companyId);
      return;
    case "transferirTecnico":
      await transferToQueueByName("Técnico", ticket, companyId);
      return;
    case "buscarBoleto":
      if (cpfCnpj) {
        await handleBuscarBoletoAction(cpfCnpj, ticket, contact, wbot, companyId, isLastAction);
      }
      return;
    case "liberarConfianca":
      if (cpfCnpj) {
        await handleLiberarConfiancaAction(cpfCnpj, ticket, contact, wbot, companyId, isLastAction);
      }
      return;
    case "desvincularCpf":
      await handleDesvincularCpfAction(contact, wbot, ticket, companyId, isLastAction);
      return;
    case "verificarBloqueio":
      if (cpfCnpj) await handleVerificarBloqueioAction(cpfCnpj, ticket, contact, wbot, companyId);
      return;
    case "encerrarAtendimento":
      await handleEncerrarAtendimentoAction(ticket, contact, wbot, companyId);
  }
};

// Encontra todas as frases de Ação presentes na resposta, na ordem em que
// aparecem no texto (é essa ordem que define a sequência de execução quando
// o cliente pede mais de uma coisa na mesma mensagem, ex: boleto + religação).
const findMarkersInOrder = (
  responseText: string
): { key: ActionMarkerKey; index: number }[] =>
  (Object.keys(ACTION_MARKERS) as ActionMarkerKey[])
    .map(key => ({ key, index: responseText.indexOf(ACTION_MARKERS[key]) }))
    .filter(m => m.index !== -1)
    .sort((a, b) => a.index - b.index);

export const dispatchAiAction = async (
  responseText: string,
  ticket: Ticket,
  contact: Contact,
  wbot: WASocket,
  companyId: number,
  onCleaned?: (cleaned: string) => Promise<void>
): Promise<string> => {
  const cpfCnpj = contact.cpfCnpj;
  let markers = findMarkersInOrder(responseText);

  // A IA pode responder sem NENHUMA frase de Ação (nem alucinada, nem
  // esquecida) mesmo já sabendo o CPF/CNPJ — se havia uma ação marcada como
  // pendente (ver markPendingCpfAction), o sistema força a execução aqui,
  // sem depender de a IA ter "lembrado" de acionar.
  if (markers.length === 0 && cpfCnpj) {
    const pendingKey = await getPendingCpfAction(ticket.id, companyId);
    if (pendingKey) {
      responseText = `${responseText} ${ACTION_MARKERS[pendingKey]}`.trim();
      markers = findMarkersInOrder(responseText);
    }
  }

  if (markers.length === 0) {
    return responseText;
  }

  // Pedir o CPF/CNPJ é pré-requisito pra qualquer ação que precise dele —
  // se faltar, pede uma única vez e não executa nenhuma ação ainda, mesmo
  // que o cliente tenha pedido várias coisas na mesma mensagem.
  const missingCpfMarker = markers.find(m => CPF_REQUIRED_MARKERS.includes(m.key));

  if (!cpfCnpj && missingCpfMarker) {
    await markPendingCpfAction(ticket.id, companyId, missingCpfMarker.key);
    const cleaned = sanitizeNarration(responseText.slice(0, markers[0].index).trim());
    if (onCleaned) await onCleaned(cleaned);
    await sendCpfRequestFallback(cleaned, contact, wbot, ticket, companyId);
    return onCleaned ? "" : cleaned;
  }

  let cursor = 0;
  const narrations: string[] = [];

  for (let i = 0; i < markers.length; i++) {
    const { key, index } = markers[i];
    const isLastAction = i === markers.length - 1;
    const narration = sanitizeNarration(responseText.slice(cursor, index).trim());
    narrations.push(narration);

    let nextCursor = index + ACTION_MARKERS[key].length;
    if (responseText[nextCursor] === ".") nextCursor += 1;
    cursor = nextCursor;

    if (onCleaned) await onCleaned(narration);
    await runActionHandler(key, cpfCnpj, ticket, contact, wbot, companyId, isLastAction);

    if (CPF_REQUIRED_MARKERS.includes(key)) {
      await clearPendingCpfAction(ticket.id, companyId, key);
    }
  }

  return onCleaned ? "" : narrations.join(" ");
};
