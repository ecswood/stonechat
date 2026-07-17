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

  it("insiste com o modelo quando ele afirma um resultado de consulta (CPF não cadastrado) sem ter acionado nenhuma Ação (regressão real: CPF de cliente real do SGP foi dito como 'não localizado' sem a IA nunca ter consultado de verdade)", async () => {
    const createChatCompletion = jest.fn().mockResolvedValue({
      data: {
        choices: [
          {
            message: {
              content:
                "Edison, não localizei o cadastro com o CPF informado. Ação: Buscar Boleto"
            }
          }
        ]
      }
    });
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "Edison, não localizei o cadastro com o CPF informado. Você gostaria de confirmar o número novamente ou prefere falar com um atendente?"
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(1);
    expect(result).toBe(
      "Edison, não localizei o cadastro com o CPF informado. Ação: Buscar Boleto"
    );
  });

  it("insiste quando o modelo afirma que não encontrou fatura/boleto sem marcador (mesma alucinação, outra frase)", async () => {
    const createChatCompletion = jest.fn().mockResolvedValue({
      data: {
        choices: [
          { message: { content: "Não encontrei nenhuma fatura em aberto. Ação: Buscar Boleto" } }
        ]
      }
    });
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "Não encontrei nenhuma fatura em aberto no seu CPF."
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(1);
    expect(result).toBe("Não encontrei nenhuma fatura em aberto. Ação: Buscar Boleto");
  });

  it("insiste quando o cliente acabou de informar um CPF/CNPJ válido e a resposta não tem nenhuma Ação, mesmo com uma frase nunca vista antes (regressão real 2026-07-17: 'O CPF informado não está vinculado ao nosso sistema' - CPF real da Juliane do Vale, com 2 contratos e 10 títulos em aberto, dito como não vinculado, sem nenhuma Ação acionada)", async () => {
    const createChatCompletion = jest.fn().mockResolvedValue({
      data: {
        choices: [
          { message: { content: "Um momento, já verifico. Ação: Buscar Boleto" } }
        ]
      }
    });
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "O CPF informado não está vinculado ao nosso sistema. Você deseja confirmar o número novamente ou prefere falar com um atendente?",
      true
    );

    expect(createChatCompletion).toHaveBeenCalledTimes(1);
    expect(result).toBe("Um momento, já verifico. Ação: Buscar Boleto");
  });

  it("NÃO insiste por conta do CPF só recebido quando a resposta já tem uma Ação (evita retry desnecessário)", async () => {
    const createChatCompletion = jest.fn();
    const openai = { createChatCompletion };

    const result = await ensureActionMarker(
      openai,
      baseParams,
      "Um momento, já verifico. Ação: Buscar Boleto",
      true
    );

    expect(createChatCompletion).not.toHaveBeenCalled();
    expect(result).toBe("Um momento, já verifico. Ação: Buscar Boleto");
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
