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
  markAwaitingFeedback,
  getAwaitingFeedbackSince,
  clearAwaitingFeedback,
  RATING_FEEDBACK_WAIT_TAG_NAME
} from "../RatingFeedbackWaitTag";

describe("RatingFeedbackWaitTag", () => {
  beforeEach(() => jest.clearAllMocks());

  it("marca o ticket com a tag de aguardando feedback", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 11 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await markAwaitingFeedback(30, 1);

    expect(Tag.findOrCreate).toHaveBeenCalledWith({
      where: { name: RATING_FEEDBACK_WAIT_TAG_NAME, companyId: 1 },
      defaults: expect.objectContaining({
        name: RATING_FEEDBACK_WAIT_TAG_NAME,
        companyId: 1
      })
    });
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 30, tagId: 11 }
    });
  });

  it("retorna o horário em que a tag foi marcada", async () => {
    const markedAt = new Date("2026-07-21T12:00:00Z");
    (Tag.findOne as jest.Mock).mockResolvedValue({ id: 11 });
    (TicketTag.findOne as jest.Mock).mockResolvedValue({ createdAt: markedAt });

    const result = await getAwaitingFeedbackSince(30, 1);

    expect(result).toEqual(markedAt);
  });

  it("retorna null quando não há tag marcada", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue(null);

    const result = await getAwaitingFeedbackSince(30, 1);

    expect(result).toBeNull();
  });

  it("remove a tag de aguardando feedback", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue({ id: 11 });

    await clearAwaitingFeedback(30, 1);

    expect(TicketTag.destroy).toHaveBeenCalledWith({
      where: { ticketId: 30, tagId: 11 }
    });
  });

  it("não quebra ao tentar remover quando a tag nem existe pra essa empresa", async () => {
    (Tag.findOne as jest.Mock).mockResolvedValue(null);

    await expect(clearAwaitingFeedback(30, 1)).resolves.not.toThrow();
    expect(TicketTag.destroy).not.toHaveBeenCalled();
  });
});
