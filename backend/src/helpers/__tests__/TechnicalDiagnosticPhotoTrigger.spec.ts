import shouldTransferToTechnicalSupport from "../TechnicalDiagnosticPhotoTrigger";

describe("shouldTransferToTechnicalSupport", () => {
  it("retorna true quando o cliente manda uma foto durante um diagnóstico técnico em aberto", () => {
    const result = shouldTransferToTechnicalSupport({
      isImageMessage: true,
      fromMe: false,
      hasTechnicalDiagnosticTag: true,
      ticketQueueIdIsNull: true
    });
    expect(result).toBe(true);
  });

  it("retorna false quando a mensagem não é imagem", () => {
    const result = shouldTransferToTechnicalSupport({
      isImageMessage: false,
      fromMe: false,
      hasTechnicalDiagnosticTag: true,
      ticketQueueIdIsNull: true
    });
    expect(result).toBe(false);
  });

  it("retorna false quando a foto foi enviada pelo próprio atendente (fromMe)", () => {
    const result = shouldTransferToTechnicalSupport({
      isImageMessage: true,
      fromMe: true,
      hasTechnicalDiagnosticTag: true,
      ticketQueueIdIsNull: true
    });
    expect(result).toBe(false);
  });

  it("retorna false quando não há diagnóstico técnico em andamento nesse ticket", () => {
    const result = shouldTransferToTechnicalSupport({
      isImageMessage: true,
      fromMe: false,
      hasTechnicalDiagnosticTag: false,
      ticketQueueIdIsNull: true
    });
    expect(result).toBe(false);
  });

  it("retorna false quando o ticket já foi transferido pra alguma fila (queueId não é mais null)", () => {
    const result = shouldTransferToTechnicalSupport({
      isImageMessage: true,
      fromMe: false,
      hasTechnicalDiagnosticTag: true,
      ticketQueueIdIsNull: false
    });
    expect(result).toBe(false);
  });
});
