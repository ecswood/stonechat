// @whiskeysockets/baileys ships pure ESM and is a heavy native/protocol
// dependency unrelated to the save-queueing behavior under test here — only
// authState.ts's own usage of these three exports needs a stand-in.
jest.mock("@whiskeysockets/baileys", () => ({
  BufferJSON: {
    replacer: (_key: string, value: unknown) => value,
    reviver: (_key: string, value: unknown) => value
  },
  initAuthCreds: () => ({}),
  proto: { Message: { AppStateSyncKeyData: { fromObject: (v: unknown) => v } } }
}));

import authState from "../authState";

describe("authState", () => {
  it("persists all keys even when saves complete out of order", async () => {
    let persistedSession: string | undefined;

    const whatsappMock: any = {
      session: null,
      update: jest.fn(({ session }: { session: string }) => {
        const isFirstCall = whatsappMock.update.mock.calls.length === 1;
        const delayMs = isFirstCall ? 50 : 0;
        return new Promise<void>(resolve => {
          setTimeout(() => {
            persistedSession = session;
            resolve();
          }, delayMs);
        });
      })
    };

    const { state } = await authState(whatsappMock);

    // First set() triggers a save whose write resolves slowly.
    state.keys.set({ "pre-key": { "1": { keyPair: "first" } } } as any);
    // Second set() triggers a save whose write resolves fast — it can
    // complete before the first one, so the first (stale) write must not
    // be allowed to land in the database afterwards and erase key "2".
    state.keys.set({ "pre-key": { "2": { keyPair: "second" } } } as any);

    // Wait for both in-flight saves to settle.
    await new Promise(resolve => setTimeout(resolve, 100));

    const finalState = JSON.parse(persistedSession as string);
    expect(finalState.keys.preKeys).toHaveProperty("1");
    expect(finalState.keys.preKeys).toHaveProperty("2");
  });
});
