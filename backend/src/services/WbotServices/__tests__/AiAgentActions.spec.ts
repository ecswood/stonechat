jest.mock("../../../models/Tag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));
jest.mock("../../../models/TicketTag", () => ({
  __esModule: true,
  default: { findOrCreate: jest.fn() }
}));

// eslint-disable-next-line import/first
import Tag from "../../../models/Tag";
// eslint-disable-next-line import/first
import TicketTag from "../../../models/TicketTag";
// eslint-disable-next-line import/first
import { registerAiAttendance } from "../AiAgentActions";

describe("registerAiAttendance", () => {
  it("cria a tag 'Atendimento IA' se não existir e aplica ao ticket", async () => {
    (Tag.findOrCreate as jest.Mock).mockResolvedValue([{ id: 5 }, true]);
    (TicketTag.findOrCreate as jest.Mock).mockResolvedValue([{}, true]);

    await registerAiAttendance({ id: 22 } as any, 1);

    expect(Tag.findOrCreate).toHaveBeenCalledWith({
      where: { name: "Atendimento IA", companyId: 1 },
      defaults: { name: "Atendimento IA", companyId: 1, color: "#8B5CF6" }
    });
    expect(TicketTag.findOrCreate).toHaveBeenCalledWith({
      where: { ticketId: 22, tagId: 5 }
    });
  });
});
