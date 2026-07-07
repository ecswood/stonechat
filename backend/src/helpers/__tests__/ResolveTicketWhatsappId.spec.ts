import AppError from "../../errors/AppError";
import resolveTicketWhatsappId from "../ResolveTicketWhatsappId";

describe("resolveTicketWhatsappId", () => {
  it("returns the ticket's whatsappId as a string when present", () => {
    const ticket: any = { whatsappId: 3 };

    expect(resolveTicketWhatsappId(ticket)).toBe("3");
  });

  it("throws a clear AppError when the ticket has no whatsappId", () => {
    const ticket: any = { whatsappId: null };

    expect(() => resolveTicketWhatsappId(ticket)).toThrow(AppError);
  });
});
