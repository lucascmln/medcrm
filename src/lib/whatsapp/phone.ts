/**
 * whatsapp/phone.ts
 *
 * Utilitários puros para normalização e comparação de telefones do WhatsApp.
 * Sem dependências de banco — 100% testável.
 */

/**
 * Normaliza um telefone (ou JID do WhatsApp) para o formato E.164 simplificado.
 *
 *   "5511987654321@s.whatsapp.net" → "+5511987654321"
 *   "+55 (11) 98765-4321"          → "+5511987654321"
 *   "11987654321"                  → "+11987654321"
 *
 * Mantém apenas dígitos e prefixa com "+". Retorna "" se não houver dígitos.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const jid = raw.split("@")[0]; // remove sufixo de JID, se houver
  const digits = jid.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
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
