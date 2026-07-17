import { hasAnyActionMarker } from "./ActionMarkers";
import { HALLUCINATED_RESULT_PATTERN } from "./HallucinatedResultPattern";

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
  response: string,
  cpfJustProvided = false
): Promise<string> => {
  if (hasAnyActionMarker(response)) {
    return response;
  }

  const isCommittal = COMMITTAL_PATTERN.test(response);
  const isHallucinatedResult = HALLUCINATED_RESULT_PATTERN.test(response);

  // cpfJustProvided cobre o caso geral: o cliente acabou de responder com um
  // CPF/CNPJ válido (verificado por código, não pelo texto do modelo) a um
  // pedido pendente, então a resposta SEMPRE precisa de uma Ação - não dá
  // pra depender de reconhecer toda frase possível de alucinação (regressão
  // real: "não está vinculado ao nosso sistema" nunca tinha aparecido antes
  // e não batia em nenhum padrão já coberto).
  if (!isCommittal && !isHallucinatedResult && !cpfJustProvided) {
    return response;
  }

  const retryInstruction = cpfJustProvided
    ? "O cliente acabou de informar o CPF/CNPJ que você tinha pedido, mas sua resposta anterior não incluiu nenhuma frase de Ação - isso significa que você não consultou o sistema de verdade antes de responder. Repita, mas agora termine com a frase de Ação correta (Buscar Boleto, Liberar Confiança, ou Verificar Bloqueio) baseada no que o cliente pediu antes de fornecer o CPF/CNPJ."
    : isHallucinatedResult
    ? "Sua resposta anterior afirmou um resultado de consulta (que o CPF/CNPJ não está cadastrado, que não há fatura em aberto, ou algo parecido) sem ter acionado a Ação que faz essa consulta de verdade - você não tem essa informação por conta própria. Repita a mesma ideia, mas termine com a frase de Ação correta (Buscar Boleto, Liberar Confiança, Desvincular CPF, ou Verificar Bloqueio) pra que o sistema confirme o resultado de verdade, em vez de você afirmar isso sozinho."
    : "Sua resposta anterior prometeu realizar uma ação mas não incluiu a frase de Ação obrigatória no final. Repita a mesma resposta, mas termine com a frase de Ação correta (Buscar Boleto, Liberar Confiança, Desvincular CPF, Verificar Bloqueio, Encerrar Atendimento, Transferir para Atendimento, ou Transferir para Técnico) correspondente ao que você prometeu fazer.";

  const retryMessages = [
    ...baseParams.messages,
    { role: "assistant", content: response },
    {
      role: "system",
      content: retryInstruction
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
