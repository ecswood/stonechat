jest.mock("../../models/Tag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), findOne: jest.fn() }
}));
jest.mock("../../models/TicketTag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn(), findOne: jest.fn(), destroy: jest.fn() }
}));

// eslint-disable-next-line import/first
import Tag from "../../models/Tag";
// eslint-disable-next-line import/first
import TicketTag from "../../models/TicketTag";
// eslint-disable-next-line import/first
import {
  markAwaitingConfirmation,
  getAwaitingConfirmationSince,
  clearAwaitingConfirmation,
  POST_DELIVERY_WAIT_TAG_NAME
} from "../PostDeliveryWaitTag";

describe("PostDeliveryWaitTag", () => {
  beforeEach(() => jest.clearAllMocks());

  it("marca o ticket com a tag de aguardando confirmação", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 10 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await markAwaitingConfirmation(22, 1);

    expect(Tag.findOrCreate).toHaveBeenCalledWith({
      where: { name: POST_DELIVERY_WAIT_TAG_NAME, companyId: 1 },
      defaults: expect.objectContaining({
        name: POST_DELIVERY_WAIT_TAG_NAME,
        companyId: 1
      })
    });
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 10 }
    });
  });

  it("retorna o horário em que a tag foi marcada", async () => {
    const markedAt = new Date("2026-07-17T12:00:00Z");
    (Tag.findOne as jest.Mock).mockResolvedValue({ id: 10 });
    (TicketTag.findOne as jest.Mock).mockResolvedValue({ createdAt: markedAt });

    const result = await getAwaitingConfirmationSince(22, 1);

    expect(result).toEqual(markedAt);
  });

  it("retorna null quando não há tag marcada", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue(null);

    const result = await getAwaitingConfirmationSince(22, 1);

    expect(result).toBeNull();
  });

  it("remove a tag de aguardando confirmação", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue({ id: 10 });

    await clearAwaitingConfirmation(22, 1);

    expect(TicketTag.destroy).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 10 }
    });
  });

  it("não quebra ao tentar remover quando a tag nem existe pra essa empresa", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue(null);

    await expect(clearAwaitingConfirmation(22, 1)).resolves.not.toThrow();
    expect(TicketTag.destroy).not.toHaveBeenCalled();
  });
});
