// WhatsApp can address a contact by its privacy-preserving @lid identity
// instead of its real phone number JID. If we persist the @lid digits as
// Contact.number, every later outbound send (SendWhatsAppMessage, campaigns,
// etc.) rebuilds "<number>@s.whatsapp.net" — a syntactically valid JID for a
// phone number that doesn't exist, which WhatsApp's server queues without
// error but never delivers (stuck at ack=1 forever). When the inbound
// message carries senderPn (the real phone-number JID), prefer that so
// Contact.number always stays a real, sendable phone number.
const resolveContactNumber = (remoteJid: string, senderPn?: string): string => {
  if (remoteJid.endsWith("@lid") && senderPn) {
    return senderPn.replace(/\D/g, "");
  }
  return remoteJid.replace(/\D/g, "");
};

export default resolveContactNumber;
