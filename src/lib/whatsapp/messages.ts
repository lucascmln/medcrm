/**
 * whatsapp/messages.ts
 *
 * Utilitários puros para interpretar o conteúdo de mensagens recebidas do
 * provider (Evolution API / mock). Sem dependências de banco — testável.
 */

export interface RawProviderMessage {
  conversation?: string;
  extendedTextMessage?: { text?: string };
  imageMessage?: { caption?: string };
  audioMessage?: Record<string, unknown>;
  documentMessage?: { title?: string };
  stickerMessage?: Record<string, unknown>;
}

/** Extrai o texto legível de uma mensagem do WhatsApp. */
export function extractMessageText(msg?: RawProviderMessage): string {
  if (!msg) return "[mensagem sem texto]";
  if (msg.conversation) return msg.conversation;
  if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text;
  if (msg.imageMessage?.caption) return `[Imagem] ${msg.imageMessage.caption}`;
  if (msg.imageMessage) return "[Imagem]";
  if (msg.audioMessage) return "[Áudio]";
  if (msg.documentMessage?.title) return `[Documento: ${msg.documentMessage.title}]`;
  if (msg.documentMessage) return "[Documento]";
  if (msg.stickerMessage) return "[Figurinha]";
  return "[mensagem]";
}

/** Deriva o tipo persistido (TEXT | IMAGE | AUDIO | DOCUMENT) da mensagem. */
export function deriveMessageType(msg?: RawProviderMessage): string {
  if (!msg) return "TEXT";
  if (msg.imageMessage) return "IMAGE";
  if (msg.audioMessage) return "AUDIO";
  if (msg.documentMessage) return "DOCUMENT";
  return "TEXT";
}
