jest.mock("../../models/Message", () => ({
  __esModule: true,
  default: { findByPk: jest.fn() }
}));

// eslint-disable-next-line import/first
import Message from "../../models/Message";
// eslint-disable-next-line import/first
import getMessageForRetry from "../GetMessageForRetry";

describe("getMessageForRetry", () => {
  it("returns the original message content when found", async () => {
    (Message.findByPk as jest.Mock).mockResolvedValue({
      dataJson: JSON.stringify({
        key: { id: "ABC123" },
        message: { conversation: "boa noite" }
      })
    });

    const result = await getMessageForRetry({ id: "ABC123" });

    expect(result).toEqual({ conversation: "boa noite" });
  });

  it("returns undefined when the message is not found", async () => {
    (Message.findByPk as jest.Mock).mockResolvedValue(null);

    const result = await getMessageForRetry({ id: "UNKNOWN" });

    expect(result).toBeUndefined();
  });

  it("returns undefined when the key has no id", async () => {
    const result = await getMessageForRetry({});

    expect(result).toBeUndefined();
    expect(Message.findByPk).not.toHaveBeenCalled();
  });
});
