import { proto } from "@whiskeysockets/baileys";
import Message from "../models/Message";

interface MessageKey {
  id?: string | null;
}

// Baileys needs this to fulfill retry requests from a recipient's device
// (common on the first message to a new contact, or after any session
// hiccup). Without it, a message can be accepted by WhatsApp's server
// (ack=1) but never actually delivered, since Baileys has nothing to
// resend when the recipient's client asks for the original content again.
const getMessageForRetry = async (
  key: MessageKey
): Promise<proto.IMessage | undefined> => {
  if (!key.id) return undefined;

  const message = await Message.findByPk(key.id);
  if (!message?.dataJson) return undefined;

  try {
    return JSON.parse(message.dataJson).message;
  } catch {
    return undefined;
  }
};

export default getMessageForRetry;
