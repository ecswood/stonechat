import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import { getWbot } from "../libs/wbot";

const EDISON_ALERT_NUMBER = "554399332300";
const SNI_TELECOM_COMPANY_ID = 1;

// Pedido do Edison: avisar direto no WhatsApp dele quando um cliente dá nota
// 1 (Insatisfeito) ou 2 (Satisfeito) na pesquisa - as duas piores notas da
// escala. Pra nota 1, chamado 2x: uma vez assim que a nota chega (ver
// RatingHandler.handleRating) e de novo quando o feedback texto do cliente
// (resposta a "o que poderíamos melhorar") é capturado (ver
// wbotMessageListener.ts), dessa vez incluindo o texto do feedback.
export const notifyLowRating = async (
  rate: number,
  contactName: string,
  feedback?: string | null
): Promise<void> => {
  try {
    const connection = await GetDefaultWhatsApp(SNI_TELECOM_COMPANY_ID);
    const wbot = getWbot(connection.id);

    const emoji = rate === 1 ? "🔴" : "🟡";
    let text = `${emoji} Avaliação nota ${rate} recebida de *${contactName}*.`;
    if (feedback) {
      text += `\n\n_"${feedback}"_`;
    }

    await wbot.sendMessage(`${EDISON_ALERT_NUMBER}@s.whatsapp.net`, { text });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[LowRatingAlert] falha ao notificar avaliação baixa: ${err}`);
  }
};
