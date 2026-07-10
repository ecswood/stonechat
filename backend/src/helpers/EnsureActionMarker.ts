import { hasAnyActionMarker } from "./ActionMarkers";

// O modelo às vezes promete uma ação ("Vou liberar a conexão...", "Vou
// verificar isso...") sem incluir a frase-gatilho exigida no final - a ação
// correspondente nunca dispara e o cliente fica sem resposta (regressão
// real: liberação de confiança prometida e nunca executada). Detecta esse
// padrão e insiste com o modelo UMA vez antes de aceitar a resposta como
// definitiva. Se a segunda tentativa também não tiver marcador, usa a
// resposta original mesmo assim - nunca trava nem inventa uma ação.
const COMMITTAL_PATTERN =
  /\bvou\s+(proceder|verificar|processar|buscar|liberar|desvincular|transferir|encerrar)\b/i;

interface OpenAiClient {
  createChatCompletion: (
    params: any
  ) => Promise<{ data: { choices: { message?: { content?: string } }[] } }>;
}

const ensureActionMarker = async (
  openai: OpenAiClient,
  baseParams: { messages: any[] } & Record<string, any>,
  response: string
): Promise<string> => {
  if (hasAnyActionMarker(response) || !COMMITTAL_PATTERN.test(response)) {
    return response;
  }

  const retryMessages = [
    ...baseParams.messages,
    { role: "assistant", content: response },
    {
      role: "system",
      content:
        "Sua resposta anterior prometeu realizar uma ação mas não incluiu a frase de Ação obrigatória no final. Repita a mesma resposta, mas termine com a frase de Ação correta (Buscar Boleto, Liberar Confiança, Desvincular CPF, Verificar Bloqueio, Encerrar Atendimento, Transferir para Atendimento, ou Transferir para Técnico) correspondente ao que você prometeu fazer."
    }
  ];

  const retryChat = await openai.createChatCompletion({
    ...baseParams,
    messages: retryMessages
  });

  const retryContent = retryChat.data.choices[0].message?.content;
  if (retryContent && hasAnyActionMarker(retryContent)) {
    return retryContent;
  }

  return response;
};

export default ensureActionMarker;
