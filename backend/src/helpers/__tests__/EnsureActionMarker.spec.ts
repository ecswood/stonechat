import ensureActionMarker from "../EnsureActionMarker";

describe("ensureActionMarker", () => {
  const baseParams = {
    model: "gpt-4",
    messages: [{ role: "system", content: "sistema" }],
    max_tokens: 100,
    temperature: 0.3
  };

  it("retorna a resposta original sem chamar a API de novo quando ela já tem uma frase de Ação", async () => {
    const createChatCompletion = jest.fn();
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "Vou buscar. Ação: Buscar Boleto"
    );

    expect(result).toBe("Vou buscar. Ação: Buscar Boleto");
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("retorna a resposta original sem chamar a API de novo quando ela não promete nenhuma ação (conversa comum)", async () => {
    const createChatCompletion = jest.fn();
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "Bom dia! Em que posso te ajudar?"
    );

    expect(result).toBe("Bom dia! Em que posso te ajudar?");
    expect(createChatCompletion).not.toHaveBeenCalled();
  });

  it("insiste com o modelo quando a resposta promete uma ação sem incluir a frase-gatilho (regressão real: 'Vou proceder com a solicitação para liberar a conexão por confiança.' sem marcador)", async () => {
    const createChatCompletion = jest.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content:
                "Vou proceder com a solicitação para liberar a conexão por confiança. Ação: Liberar Confiança"
            }
          }
        ]
      }
    });
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "Vou proceder com a solicitação para liberar a conexão por confiança."
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(1);
    const [callArgs] = createChatCompletion.mock.calls[0];
    expect(callArgs.messages[callArgs.messages.length - 2]).toEqual({
      role: "assistant",
      content:
        "Vou proceder com a solicitação para liberar a conexão por confiança."
    });
    expect(result).toBe(
      "Vou proceder com a solicitação para liberar a conexão por confiança. Ação: Liberar Confiança"
    );
  });

  it("se a segunda tentativa ainda não tiver marcador, retorna a resposta original mesmo assim (não trava, não inventa ação)", async () => {
    const createChatCompletion = jest.fn().mockResolvedValue({
      data: {
        choices: [{ message: { content: "Vou verificar isso ainda sem marcador." } }]
      }
    });
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "Vou verificar isso pra você."
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(1);
    expect(result).toBe("Vou verificar isso pra você.");
  });
});
