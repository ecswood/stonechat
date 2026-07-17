import * as Sentry from "@sentry/node";
import { logger } from "../utils/logger";
import GetDefaultWhatsApp from "./GetDefaultWhatsApp";
import { getWbot } from "../libs/wbot";

const NOC_GROUP_JID = "120363410164424155@g.us";
const SNI_TELECOM_COMPANY_ID = 1;

// Pedido do Edison: avisar o grupo de monitoramento (NOC Avisos SNI) quando o
// SGP acumular falhas consecutivas de verdade (ver SgpService.withRetry).
// Pré-requisito operacional: o número do StoneChat precisa ser membro desse
// grupo - se ainda não for, o envio falha e só loga o erro, sem quebrar a
// resposta ao cliente que disparou a falha original.
export const notifySgpOutage = async (): Promise<void> => {
  try {
    const connection = await GetDefaultWhatsApp(SNI_TELECOM_COMPANY_ID);
    const wbot = getWbot(connection.id);
    await wbot.sendMessage(NOC_GROUP_JID, {
      text: "⚠️ SGP parece fora do ar: 3 falhas seguidas ao consultar o SGP pelo StoneChat."
    });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(`[SgpOutageAlert] falha ao notificar indisponibilidade do SGP: ${err}`);
  }
};
