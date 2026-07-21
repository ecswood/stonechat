jest.mock("../../../libs/socket", () => ({ __esModule: true, getIO: jest.fn() }));
jest.mock("../../../models/UserRating", () => ({
  __esModule: true,
  default: { create: jest.fn() }
}));
jest.mock("../../WhatsappService/ShowWhatsAppService", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../../helpers/Mustache", () => ({
  __esModule: true,
  default: jest.fn((body: string) => body)
}));
jest.mock("../SendWhatsAppMessage", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("../../../helpers/RatingFeedbackWaitTag", () => ({
  __esModule: true,
  markAwaitingFeedback: jest.fn()
}));

// eslint-disable-next-line import/first
import { getIO } from "../../../libs/socket";
// eslint-disable-next-line import/first
import UserRating from "../../../models/UserRating";
// eslint-disable-next-line import/first
import ShowWhatsAppService from "../../WhatsappService/ShowWhatsAppService";
// eslint-disable-next-line import/first
import SendWhatsAppMessage from "../SendWhatsAppMessage";
// eslint-disable-next-line import/first
import { markAwaitingFeedback } from "../../../helpers/RatingFeedbackWaitTag";
// eslint-disable-next-line import/first
import { verifyRating, handleRating, parseValidRating } from "../RatingHandler";

describe("verifyRating", () => {
  it("retorna true quando há rating pendente e a atendente tem dono", () => {
    const result = verifyRating(
      { finishedAt: null, userId: 5, ratingAt: new Date() } as any,
      false
    );
    expect(result).toBe(true);
  });

  it("retorna true quando não tem dono mas é atendimento por IA", () => {
    const result = verifyRating(
      { finishedAt: null, userId: null, ratingAt: new Date() } as any,
      true
    );
    expect(result).toBe(true);
  });

  it("retorna false quando ratingAt é null", () => {
    const result = verifyRating(
      { finishedAt: null, userId: 5, ratingAt: null } as any,
      false
    );
    expect(result).toBe(false);
  });

  it("retorna false quando já foi finalizado", () => {
    const result = verifyRating(
      { finishedAt: new Date(), userId: 5, ratingAt: new Date() } as any,
      false
    );
    expect(result).toBe(false);
  });
});

describe("parseValidRating", () => {
  it("retorna a nota quando a mensagem é um número válido", () => {
    expect(parseValidRating("3")).toBe(3);
    expect(parseValidRating("5")).toBe(5);
  });

  it("retorna null quando a mensagem não é um número (regressão: 'desvincular' sendo engolido enquanto avaliação está pendente)", () => {
    expect(parseValidRating("desvincular")).toBeNull();
    expect(parseValidRating("oi")).toBeNull();
    expect(parseValidRating("")).toBeNull();
  });

  it("retorna null para números que não são uma nota plausível, como um CPF (regressão real: CPF da Clau foi tratado como nota 'válida' e engoliu a mensagem)", () => {
    expect(parseValidRating("68197756953")).toBeNull();
    expect(parseValidRating("554396053325")).toBeNull();
  });
});

describe("handleRating", () => {
  const chain: any = {};
  const ticket = {
    id: 25,
    companyId: 1,
    whatsappId: 4,
    status: "pending",
    queueId: null,
    contact: {},
    update: jest.fn().mockResolvedValue(undefined)
  } as any;
  const ticketTraking = {
    ticketId: 25,
    companyId: 1,
    userId: 2,
    update: jest.fn().mockResolvedValue(undefined)
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    chain.to = jest.fn(() => chain);
    chain.emit = jest.fn();
    (getIO as jest.Mock).mockReturnValue(chain);
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({ complationMessage: "" });
  });

  it("não cria UserRating, não finaliza a atendente nem fecha o ticket quando a resposta não é um número (regressão do crash com 'oi')", async () => {
    await handleRating(NaN, ticket, ticketTraking);

    expect(UserRating.create).not.toHaveBeenCalled();
    expect(ticketTraking.update).not.toHaveBeenCalled();
    expect(ticket.update).not.toHaveBeenCalled();
    expect(getIO).not.toHaveBeenCalled();
  });

  it("cria o UserRating e fecha o ticket quando a nota é válida", async () => {
    await handleRating(3, ticket, ticketTraking);

    expect(UserRating.create).toHaveBeenCalledWith({
      ticketId: 25,
      companyId: 1,
      userId: 2,
      rate: 3
    });
    expect(ticketTraking.update).toHaveBeenCalledWith({
      finishedAt: expect.any(Date),
      rated: true
    });
    expect(ticket.update).toHaveBeenCalledWith({
      queueId: null,
      chatbot: null,
      queueOptionId: null,
      userId: null,
      status: "closed"
    });
  });

  it("envia a mensagem de encerramento quando a empresa tem complationMessage configurada", async () => {
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      complationMessage: "Obrigado pelo contato!"
    });

    await handleRating(5, ticket, ticketTraking);

    expect(SendWhatsAppMessage).toHaveBeenCalledWith({
      body: "‎Obrigado pelo contato!",
      ticket
    });
  });

  it("limita a nota a no máximo 5 e no mínimo 1", async () => {
    await handleRating(99, ticket, ticketTraking);
    expect(UserRating.create).toHaveBeenCalledWith(
      expect.objectContaining({ rate: 5 })
    );

    jest.clearAllMocks();
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({ complationMessage: "" });
    await handleRating(-3, ticket, ticketTraking);
    expect(UserRating.create).toHaveBeenCalledWith(
      expect.objectContaining({ rate: 1 })
    );
  });

  it("agradece a avaliação quando a nota é 3 (Muito Satisfeito)", async () => {
    await handleRating(3, ticket, ticketTraking);

    expect(SendWhatsAppMessage).toHaveBeenCalledWith({
      body: expect.stringContaining("brigad"),
      ticket
    });
  });

  it("diz que está sempre melhorando quando a nota é 2 (Satisfeito)", async () => {
    await handleRating(2, ticket, ticketTraking);

    expect(SendWhatsAppMessage).toHaveBeenCalledWith({
      body: expect.stringContaining("melhorando"),
      ticket
    });
  });

  it("pergunta o que poderia melhorar e marca aguardando feedback quando a nota é 1 (Insatisfeito)", async () => {
    await handleRating(1, ticket, ticketTraking);

    expect(SendWhatsAppMessage).toHaveBeenCalledWith({
      body: expect.stringContaining("melhorar"),
      ticket
    });
    expect(markAwaitingFeedback).toHaveBeenCalledWith(
      ticket.id,
      ticket.companyId
    );
  });

  it("não marca aguardando feedback quando a nota não é 1", async () => {
    await handleRating(3, ticket, ticketTraking);

    expect(markAwaitingFeedback).not.toHaveBeenCalled();
  });

  it("manda a mensagem específica da nota E a mensagem de conclusão configurada (não substitui uma pela outra)", async () => {
    (ShowWhatsAppService as jest.Mock).mockResolvedValue({
      complationMessage: "Obrigado pelo contato!"
    });

    await handleRating(3, ticket, ticketTraking);

    expect(SendWhatsAppMessage).toHaveBeenCalledTimes(2);
    expect(SendWhatsAppMessage).toHaveBeenCalledWith({
      body: "‎Obrigado pelo contato!",
      ticket
    });
  });
});
