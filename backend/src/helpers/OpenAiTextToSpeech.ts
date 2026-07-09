import axios from "axios";

const synthesizeSpeech = async (
  text: string,
  apiKey: string,
  voice: string = "nova"
): Promise<Buffer> => {
  const response = await axios.post(
    "https://api.openai.com/v1/audio/speech",
    { model: "tts-1", voice, input: text, response_format: "opus" },
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      responseType: "arraybuffer"
    }
  );
  return Buffer.from(response.data);
};

export default synthesizeSpeech;
