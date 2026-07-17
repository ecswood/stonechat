jest.mock("../../../libs/socket", () => ({
  __esModule: true,
  getIO: jest.fn(() => ({ to: jest.fn(() => ({ emit: jest.fn() })) }))
}));

jest.mock("../../../models/Contact", () => ({
  __esModule: true,
  default: { findOne: jest.fn(), create: jest.fn() }
}));

// eslint-disable-next-line import/first
import Contact from "../../../models/Contact";
// eslint-disable-next-line import/first
import CreateOrUpdateContactService from "../CreateOrUpdateContactService";

describe("CreateOrUpdateContactService - atualização de nome em contato existente", () => {
  const number = "43999332300";
  const companyId = 1;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("atualiza o nome quando o contato existente tinha só o número (fallback) e chega um pushName real", async () => {
    const update = jest.fn();
    (Contact.findOne as jest.Mock).mockResolvedValue({
      number,
      companyId,
      name: number, // criado antes sem pushName (ex: mensagem enviada primeiro)
      whatsappId: 1,
      update
    });

    await CreateOrUpdateContactService({
      name: "Clau",
      number,
      isGroup: false,
      companyId,
      whatsappId: 1
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Clau" })
    );
  });

  it("NÃO sobrescreve um nome real já salvo quando a mensagem seguinte chega sem pushName (name = number)", async () => {
    const update = jest.fn();
    (Contact.findOne as jest.Mock).mockResolvedValue({
      number,
      companyId,
      name: "Clau",
      whatsappId: 1,
      update
    });

    await CreateOrUpdateContactService({
      name: number, // sem pushName desta vez
      number,
      isGroup: false,
      companyId,
      whatsappId: 1
    });

    const nameUpdates = update.mock.calls.filter(call => "name" in (call[0] || {}));
    expect(nameUpdates).toHaveLength(0);
  });
});
