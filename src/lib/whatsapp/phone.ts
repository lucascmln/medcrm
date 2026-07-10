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
 *
 * ATENÇÃO: helper de baixo nível — NÃO trata `@lid`. Para outbound use
 * `resolveWhatsAppSendTarget`, que descarta identificadores não discáveis.
 */
export function resolveSendNumber(input: {
  remoteJid?: string | null;
  phone?: string | null;
}): string {
  const fromJid = jidToNumber(input.remoteJid);
  if (fromJid) return fromJid;
  return toProviderNumber(input.phone ?? "");
}

// ── LID / identificação de destino discável ────────────────────────────────────

/** Sufixos de JID que representam um destino REALMENTE discável (roteável). */
const DIALABLE_JID_SUFFIXES = ["@s.whatsapp.net", "@c.us"];

/**
 * True se o JID é um identificador LID (`@lid`). O WhatsApp usa LID addressing
 * para ocultar o número de telefone real; o número dentro de um `@lid` é OPACO
 * e NUNCA deve ser usado como destino de envio.
 */
export function isLidJid(raw: string | null | undefined): boolean {
  return typeof raw === "string" && raw.includes("@lid");
}

/** True se o JID termina em sufixo discável (`@s.whatsapp.net` ou `@c.us`). */
export function isDialableJid(raw: string | null | undefined): boolean {
  if (!raw) return false;
  return DIALABLE_JID_SUFFIXES.some((suffix) => raw.includes(suffix));
}

/**
 * Heurística leve: `value` parece um telefone discável (E.164)?
 * Apenas dígitos, comprimento plausível (8–15). Não valida país — só descarta
 * strings vazias/curtas demais. A rejeição de números opacos de `@lid` é feita
 * por contexto em `resolveWhatsAppSendTarget`, não por comprimento.
 */
export function looksLikeDialablePhone(value: string | null | undefined): boolean {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * Dado um conjunto de candidatos (JIDs ou telefones vindos do payload), retorna
 * o primeiro que seja um JID discável (`@s.whatsapp.net`/`@c.us`). Ignora
 * `@lid`, `@g.us`, `@broadcast` e valores vazios. Retorna o JID cru (com sufixo)
 * para que a origem discável fique registrável; `null` se nenhum for discável.
 */
export function pickDialableJid(
  candidates: Array<string | null | undefined>
): string | null {
  for (const c of candidates) {
    if (isDialableJid(c)) return c as string;
  }
  return null;
}

export interface SendTargetInput {
  /** Melhor JID discável já resolvido/persistido para a conversa. */
  sendTargetJid?: string | null;
  /** JID original de quem enviou (pode ser `@lid`, não discável). */
  remoteJid?: string | null;
  /** Telefone normalizado da conversa (pode ter vindo de um `@lid`). */
  phone?: string | null;
}

export type SendTargetResult =
  | { ok: true; number: string; source: "sendTargetJid" | "remoteJid" | "phone" }
  | { ok: false; error: string };

/** Mensagem de erro única quando não há destino discável confiável. */
export const NO_DIALABLE_TARGET_ERROR =
  "Não foi possível identificar número discável para envio";

/**
 * Resolve o destino OUTBOUND, NUNCA transformando um `@lid`/identificador opaco
 * em número. Prioridade:
 *
 *   a) `sendTargetJid` discável (melhor caso — resolvido no inbound);
 *   b) `remoteJid`, somente se for discável (`@s.whatsapp.net`/`@c.us`);
 *   c) `phone` normalizado, somente se parecer telefone real E NÃO for derivado
 *      de um `@lid` (ex.: phone == dígitos do lid → rejeitado);
 *   d) caso contrário, erro claro (nada é enviado).
 *
 *   { sendTargetJid: "5511987654321@s.whatsapp.net", remoteJid: "999@lid" }
 *     → { ok: true, number: "5511987654321", source: "sendTargetJid" }
 *   { remoteJid: "195223946834081@lid", phone: "+195223946834081" }
 *     → { ok: false, error: NO_DIALABLE_TARGET_ERROR }
 */
export function resolveWhatsAppSendTarget(input: SendTargetInput): SendTargetResult {
  // a) JID discável explicitamente resolvido no inbound.
  if (isDialableJid(input.sendTargetJid)) {
    return { ok: true, number: jidToNumber(input.sendTargetJid), source: "sendTargetJid" };
  }

  // b) remoteJid — apenas se discável. `@lid` cai fora aqui.
  if (isDialableJid(input.remoteJid)) {
    return { ok: true, number: jidToNumber(input.remoteJid), source: "remoteJid" };
  }

  // c) phone — fallback final, mas nunca um número opaco derivado de `@lid`.
  const phoneDigits = toProviderNumber(input.phone ?? "");
  const lidDigits = isLidJid(input.remoteJid) ? jidToNumber(input.remoteJid) : "";
  const phoneIsLidDerived = lidDigits !== "" && phoneDigits === lidDigits;
  if (phoneDigits && !phoneIsLidDerived && looksLikeDialablePhone(phoneDigits)) {
    return { ok: true, number: phoneDigits, source: "phone" };
  }

  return { ok: false, error: NO_DIALABLE_TARGET_ERROR };
}

/**
 * Resolve a identidade de uma mensagem INBOUND a partir dos campos do payload,
 * separando o identificador bruto (`remoteJid`, que pode ser `@lid`) do melhor
 * destino discável para outbound (`sendTargetJid`).
 *
 * `candidates` deve conter, em ordem de prioridade, os campos discáveis do
 * payload (ex.: `key.senderPn`, `key.participant`, `sender`...). O primeiro que
 * for discável vira `sendTargetJid`; o `phone` é derivado desse discável quando
 * existir, senão do próprio `remoteJid`.
 */
export function resolveInboundIdentity(input: {
  remoteJid?: string | null;
  candidates?: Array<string | null | undefined>;
}): { remoteJid: string; sendTargetJid: string | null; phone: string } {
  const remoteJid = input.remoteJid ?? "";
  const sendTargetJid = pickDialableJid([
    ...(input.candidates ?? []),
    remoteJid, // o próprio remoteJid entra por último — só conta se já for discável
  ]);
  const phone = normalizePhone(sendTargetJid ?? remoteJid);
  return { remoteJid, sendTargetJid, phone };
}
