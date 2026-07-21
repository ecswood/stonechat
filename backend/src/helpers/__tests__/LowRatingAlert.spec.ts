jest.mock("../GetDefaultWhatsApp", () => ({
  __esModule: true,
  default: jest.fn()
}));
jest.mock("../../libs/wbot", () => ({
  getWbot: jest.fn()
}));

// eslint-disable-next-line import/first
import GetDefaultWhatsApp from "../GetDefaultWhatsApp";
// eslint-disable-next-line import/first
import { getWbot } from "../../libs/wbot";
// eslint-disable-next-line import/first
import { notifyLowRating } from "../LowRatingAlert";

describe("notifyLowRating", () => {
  beforeEach(() => jest.clearAllMocks());

  it("manda o alerta pro número do Edison usando a conexão padrão da empresa (companyId 1)", async () => {
    const sendMessage = jest.fn().mockResolvedValue({});
    (GetDefaultWhatsApp as jest.Mock).mockResolvedValue({ id: 7 });
    (getWbot as jest.Mock).mockReturnValue({ sendMessage });

    await notifyLowRating(1, "Clau Marins", null);

    expect(GetDefaultWhatsApp).toHaveBeenCalledWith(1);
    expect(getWbot).toHaveBeenCalledWith(7);
    expect(sendMessage).toHaveBeenCalledWith(
      "554399332300@s.whatsapp.net",
      expect.objectContaining({
        text: expect.stringContaining("Clau Marins")
      })
    );
  });

  it("inclui a nota na mensagem", async () => {
    const sendMessage = jest.fn().mockResolvedValue({});
    (GetDefaultWhatsApp as jest.Mock).mockResolvedValue({ id: 7 });
    (getWbot as jest.Mock).mockReturnValue({ sendMessage });

    await notifyLowRating(2, "Fabricio Rossato", null);

    expect(sendMessage).toHaveBeenCalledWith(
      "554399332300@s.whatsapp.net",
      expect.objectContaining({ text: expect.stringContaining("2") })
    );
  });

  it("inclui o feedback na mensagem quando informado", async () => {
    const sendMessage = jest.fn().mockResolvedValue({});
    (GetDefaultWhatsApp as jest.Mock).mockResolvedValue({ id: 7 });
    (getWbot as jest.Mock).mockReturnValue({ sendMessage });

    await notifyLowRating(1, "Edison Carlos", "o serviço de internet não anda muito bom");

    expect(sendMessage).toHaveBeenCalledWith(
      "554399332300@s.whatsapp.net",
      expect.objectContaining({
        text: expect.stringContaining("o serviço de internet não anda muito bom")
      })
    );
  });

  it("não quebra quando feedback não foi informado", async () => {
    const sendMessage = jest.fn().mockResolvedValue({});
    (GetDefaultWhatsApp as jest.Mock).mockResolvedValue({ id: 7 });
    (getWbot as jest.Mock).mockReturnValue({ sendMessage });

    await expect(notifyLowRating(1, "Edison Carlos", null)).resolves.not.toThrow();
  });

  it("não lança erro quando o envio falha - só loga", async () => {
    (GetDefaultWhatsApp as jest.Mock).mockRejectedValue(new Error("sem conexão configurada"));

    await expect(notifyLowRating(1, "Edison Carlos", null)).resolves.not.toThrow();
  });
});
