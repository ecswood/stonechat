export interface RawHistoryMessage {
  fromMe: boolean;
  body: string;
  mediaType: string;
}

export interface ChatHistoryMessage {
  role: "assistant" | "user";
  content: string;
}

// Message.findAll busca com order DESC (mais recente primeiro, pra pegar as
// últimas N mensagens com um LIMIT). Mas a API de chat da OpenAI espera o
// histórico em ordem cronológica - mandar invertido faz o modelo perder a
// noção de qual foi sua última pergunta e repeti-la sem parar.
const buildConversationHistory = (
  messagesDesc: RawHistoryMessage[]
): ChatHistoryMessage[] => {
  return messagesDesc
    .filter(
      message =>
        message.mediaType === "conversation" ||
        message.mediaType === "extendedTextMessage" ||
        message.mediaType === "audio"
    )
    .reverse()
    .map(message => ({
      role: message.fromMe ? "assistant" : "user",
      content: message.body
    }));
};

export default buildConversationHistory;
