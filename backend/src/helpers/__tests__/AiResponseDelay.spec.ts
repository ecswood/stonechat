import { delayAiResponse, AI_RESPONSE_DELAY_MS } from "../AiResponseDelay";

describe("delayAiResponse", () => {
  it("resolve depois de AI_RESPONSE_DELAY_MS", async () => {
    jest.useFakeTimers();

    const spy = jest.fn();
    delayAiResponse().then(spy);

    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(AI_RESPONSE_DELAY_MS - 1);
    await Promise.resolve();
    expect(spy).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(spy).toHaveBeenCalled();

    jest.useRealTimers();
  });
});
