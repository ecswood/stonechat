jest.mock("axios");

// eslint-disable-next-line import/first
import axios from "axios";
// eslint-disable-next-line import/first
import synthesizeSpeech from "../OpenAiTextToSpeech";

describe("synthesizeSpeech", () => {
  it("chama a API de TTS da OpenAI e retorna um Buffer com o áudio", async () => {
    const fakeAudioBytes = new Uint8Array([1, 2, 3, 4]);
    (axios.post as jest.Mock).mockResolvedValue({ data: fakeAudioBytes.buffer });

    const result = await synthesizeSpeech("Olá, tudo bem?", "sk-teste");

    expect(result).toEqual(Buffer.from(fakeAudioBytes.buffer));
    expect(axios.post).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/speech",
      { model: "tts-1", voice: "alloy", input: "Olá, tudo bem?" },
      {
        headers: { Authorization: "Bearer sk-teste" },
        responseType: "arraybuffer"
      }
    );
  });

  it("usa a voz informada quando passada explicitamente", async () => {
    const fakeAudioBytes = new Uint8Array([1, 2, 3, 4]);
    (axios.post as jest.Mock).mockResolvedValue({ data: fakeAudioBytes.buffer });

    await synthesizeSpeech("Oi", "sk-teste", "nova");

    expect(axios.post).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/speech",
      { model: "tts-1", voice: "nova", input: "Oi" },
      expect.anything()
    );
  });
});
