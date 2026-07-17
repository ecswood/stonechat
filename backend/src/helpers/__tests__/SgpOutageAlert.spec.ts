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
import { notifySgpOutage } from "../SgpOutageAlert";

describe("notifySgpOutage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("manda a mensagem de alerta pro grupo NOC Avisos SNI usando a conexão padrão da empresa (companyId 1)", async () => {
    const sendMessage = jest.fn().mockResolvedValue({});
    (GetDefaultWhatsApp as jest.Mock).mockResolvedValue({ id: 7 });
    (getWbot as jest.Mock).mockReturnValue({ sendMessage });

    await notifySgpOutage();

    expect(GetDefaultWhatsApp).toHaveBeenCalledWith(1);
    expect(getWbot).toHaveBeenCalledWith(7);
    expect(sendMessage).toHaveBeenCalledWith(
      "120363410164424155@g.us",
      expect.objectContaining({ text: expect.stringContaining("SGP") })
    );
  });

  it("não lança erro quando o envio falha (ex: bot ainda não é membro do grupo) - só loga", async () => {
    (GetDefaultWhatsApp as jest.Mock).mockRejectedValue(new Error("sem conexão configurada"));

    await expect(notifySgpOutage()).resolves.not.toThrow();
  });
});
