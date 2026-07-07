import resolveContactNumber from "../ResolveContactNumber";

describe("resolveContactNumber", () => {
  it("uses the real phone number when the contact is addressed via @lid", () => {
    const result = resolveContactNumber(
      "33466536173815@lid",
      "554388515951@s.whatsapp.net"
    );

    expect(result).toBe("554388515951");
  });

  it("falls back to the @lid digits when no senderPn is available", () => {
    const result = resolveContactNumber("33466536173815@lid", undefined);

    expect(result).toBe("33466536173815");
  });

  it("uses the remoteJid digits as-is for a normal phone-number JID", () => {
    const result = resolveContactNumber(
      "554388515951@s.whatsapp.net",
      undefined
    );

    expect(result).toBe("554388515951");
  });

  it("ignores senderPn for a normal (non-@lid) phone-number JID", () => {
    const result = resolveContactNumber(
      "554388515951@s.whatsapp.net",
      "999999999@s.whatsapp.net"
    );

    expect(result).toBe("554388515951");
  });
});
