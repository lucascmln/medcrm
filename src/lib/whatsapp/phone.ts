/**
 * whatsapp/phone.ts
 *
 * Utilitários puros para normalização e comparação de telefones do WhatsApp.
 * Sem dependências de banco — 100% testável.
 */

/**
 * Remove o sufixo de JID (@s.whatsapp.net, @c.us, @lid, @g.us) e o sufixo de
 * dispositivo do Baileys (":12"), retornando só a parte identificadora bruta.
 *
 *   "5562904225255654@s.whatsapp.net" → "5562904225255654"
 *   "5511999999999:12@s.whatsapp.net" → "5511999999999"
 *
 * NUNCA remove o DDI (ex.: "55") — apenas descarta sufixos de roteamento.
 */
function stripJidSuffix(raw: string): string {
  return raw.split("@")[0].split(":")[0];
}

/**
 * Normaliza um telefone (ou JID do WhatsApp) para o formato E.164 simplificado.
 *
 *   "5562904225255654@s.whatsapp.net" → "+5562904225255654"
 *   "5511999999999:12@s.whatsapp.net" → "+5511999999999"
 *   "+55 (11) 98765-4321"             → "+5511987654321"
 *
 * Mantém apenas dígitos (preservando o DDI) e prefixa com "+". "" se não houver.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const digits = stripJidSuffix(raw).replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

/**
 * Extrai apenas os dígitos enviáveis de um JID ou telefone, preservando o DDI.
 *
 *   "5562904225255654@s.whatsapp.net" → "5562904225255654"
 *
 * NUNCA remove "55" nem qualquer prefixo de país — só sufixos de JID/dispositivo.
 */
export function jidToNumber(raw: string | null | undefined): string {
  if (!raw) return "";
  return stripJidSuffix(raw).replace(/\D/g, "");
}

/**
 * Últimos N dígitos de um telefone — usado para dedupe tolerante a
 * variações de DDI/DDD/9º dígito. Default: 11 (DDD + 9 dígitos no Brasil).
 */
export function phoneTail(phone: string, n = 11): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.slice(-n);
}

/**
 * Compara dois telefones ignorando formatação. Considera iguais se os
 * últimos `n` dígitos coincidirem (tolera +55 vs sem, 9º dígito etc.).
 */
export function samePhone(a: string, b: string, n = 11): boolean {
  const ta = phoneTail(a, n);
  const tb = phoneTail(b, n);
  if (!ta || !tb) return false;
  return ta === tb;
}

/**
 * Converte um telefone normalizado (+55...) para o formato aceito pela
 * Evolution API no envio: só dígitos, sem "+".
 *
 *   "+5511987654321" → "5511987654321"
 */
export function toProviderNumber(phone: string): string {
  return (phone ?? "").replace(/\D/g, "");
}

/**
 * Decide o número a usar no envio OUTBOUND.
 *
 * Prefere o `remoteJid` original da conversa — a identidade exata de quem
 * enviou a mensagem inbound — evitando qualquer round-trip de normalização
 * que possa ter corrompido o telefone. Usa o `phone` normalizado apenas como
 * fallback quando não há remoteJid.
 *
 *   { remoteJid: "5562904225255654@s.whatsapp.net", phone: "+62904225255654" }
 *     → "5562904225255654"   (usa o JID; ignora o phone quebrado)
 *   { remoteJid: null, phone: "+5511987654321" }
 *     → "5511987654321"
 */
export function resolveSendNumber(input: {
  remoteJid?: string | null;
  phone?: string | null;
}): string {
  const fromJid = jidToNumber(input.remoteJid);
  if (fromJid) return fromJid;
  return toProviderNumber(input.phone ?? "");
}
