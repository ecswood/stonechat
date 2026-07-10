import buildConversationHistory from "../BuildConversationHistory";

describe("buildConversationHistory", () => {
  it("retorna as mensagens em ordem cronológica (mais antiga primeiro), não na ordem invertida que vem do banco (regressão real: histórico invertido fazia a IA repetir a mesma pergunta sem parar)", () => {
    // Message.findAll busca com order DESC (mais recente primeiro) - é assim que chega aqui
    const messagesDesc = [
      { fromMe: true, body: "pergunta 2", mediaType: "extendedTextMessage" },
      { fromMe: false, body: "resposta 1", mediaType: "conversation" },
      { fromMe: true, body: "pergunta 1", mediaType: "extendedTextMessage" }
    ];

    const result = buildConversationHistory(messagesDesc);

    expect(result).toEqual([
      { role: "assistant", content: "pergunta 1" },
      { role: "user", content: "resposta 1" },
      { role: "assistant", content: "pergunta 2" }
    ]);
  });

  it("ignora mensagens de mídia sem conteúdo de texto real (ex: imagem sem legenda)", () => {
    const messagesDesc = [
      { fromMe: true, body: "-", mediaType: "image" },
      { fromMe: false, body: "oi", mediaType: "conversation" }
    ];

    const result = buildConversationHistory(messagesDesc);

    expect(result).toEqual([{ role: "user", content: "oi" }]);
  });

  it("inclui mensagens de áudio com a transcrição/resposta já salva no body (regressão real: áudio ficava com body 'Áudio' genérico e sumia do histórico, fazendo a IA perder o contexto do que foi dito por voz)", () => {
    const messagesDesc = [
      { fromMe: true, body: "Vou verificar isso pra você.", mediaType: "audio" },
      { fromMe: false, body: "estou sem internet", mediaType: "audio" }
    ];

    const result = buildConversationHistory(messagesDesc);

    expect(result).toEqual([
      { role: "user", content: "estou sem internet" },
      { role: "assistant", content: "Vou verificar isso pra você." }
    ]);
  });

  it("mapeia fromMe=true pra assistant e fromMe=false pra user", () => {
    const messagesDesc = [
      { fromMe: false, body: "cliente", mediaType: "conversation" },
      { fromMe: true, body: "ia", mediaType: "extendedTextMessage" }
    ];

    const result = buildConversationHistory(messagesDesc);

    expect(result).toEqual([
      { role: "assistant", content: "ia" },
      { role: "user", content: "cliente" }
    ]);
  });

  it("retorna array vazio quando não há mensagens", () => {
    expect(buildConversationHistory([])).toEqual([]);
  });
});
