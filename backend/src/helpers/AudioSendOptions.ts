export interface AudioSendOptions {
  mimetype: string;
  ptt: boolean;
}

// Áudio gravado no site (nome de arquivo "audio-record-site...") vira
// nota de voz (audio/mp4, ptt) via processAudio. Qualquer outro arquivo de
// áudio anexado passa por processAudioFile, que sempre reconverte pra MP3 -
// o mimetype enviado ao WhatsApp precisa refletir esse formato final
// (audio/mpeg), não o mimetype do upload original, senão o áudio chega
// corrompido/não toca.
const resolveAudioSendOptions = (originalname: string): AudioSendOptions => {
  if (originalname.includes("audio-record-site")) {
    return { mimetype: "audio/mp4", ptt: true };
  }
  return { mimetype: "audio/mpeg", ptt: false };
};

export default resolveAudioSendOptions;
