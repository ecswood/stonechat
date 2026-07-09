import resolveAudioSendOptions from "../AudioSendOptions";

describe("resolveAudioSendOptions", () => {
  it("retorna mimetype audio/mp4 e ptt=true para áudio gravado no site (audio-record-site)", () => {
    const result = resolveAudioSendOptions("audio-record-site-1234.webm");
    expect(result).toEqual({ mimetype: "audio/mp4", ptt: true });
  });

  it("retorna mimetype audio/mpeg (não o mimetype original) para um arquivo de áudio comum (regressão real: mandava rotulado com o mimetype original do upload, ex: audio/ogg, mas o arquivo já tinha sido reconvertido pra mp3, quebrando a reprodução no WhatsApp)", () => {
    const result = resolveAudioSendOptions("clara_tts-1_nova.ogg");
    expect(result).toEqual({ mimetype: "audio/mpeg", ptt: false });
  });
});
