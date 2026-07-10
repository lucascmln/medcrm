import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  phoneTail,
  samePhone,
  toProviderNumber,
  jidToNumber,
  resolveSendNumber,
} from "./phone";

test("normalizePhone: extrai dígitos de um JID do WhatsApp", () => {
  assert.equal(normalizePhone("5511987654321@s.whatsapp.net"), "+5511987654321");
});

test("normalizePhone: remove formatação", () => {
  assert.equal(normalizePhone("+55 (11) 98765-4321"), "+5511987654321");
  assert.equal(normalizePhone("11 98765 4321"), "+11987654321");
});

test("normalizePhone: entradas vazias retornam string vazia", () => {
  assert.equal(normalizePhone(""), "");
  assert.equal(normalizePhone(null), "");
  assert.equal(normalizePhone(undefined), "");
  assert.equal(normalizePhone("abc"), "");
});

test("phoneTail: retorna os últimos 11 dígitos por padrão", () => {
  assert.equal(phoneTail("+5511987654321"), "11987654321");
  assert.equal(phoneTail("+5511987654321", 8), "87654321");
});

test("samePhone: tolera DDI e formatação diferentes", () => {
  assert.equal(samePhone("+5511987654321", "11987654321"), true);
  assert.equal(samePhone("+55 (11) 98765-4321", "5511987654321"), true);
  assert.equal(samePhone("+5511987654321", "+5511000000000"), false);
});

test("samePhone: telefones vazios nunca são iguais", () => {
  assert.equal(samePhone("", ""), false);
  assert.equal(samePhone("+5511987654321", ""), false);
});

test("toProviderNumber: remove o + para o provider", () => {
  assert.equal(toProviderNumber("+5511987654321"), "5511987654321");
});

// ── Regressão do bug outbound: DDI 55 NUNCA é removido ────────────────────────

test("normalizePhone: preserva o DDI 55 do JID (bug outbound)", () => {
  assert.equal(normalizePhone("5562904225255654@s.whatsapp.net"), "+5562904225255654");
  assert.equal(normalizePhone("556581197476@s.whatsapp.net"), "+556581197476");
});

test("normalizePhone: só mantém 62 se o JID realmente começar com 62", () => {
  // Número que de fato começa com 62 permanece com 62 (não vira 55 nem perde dígito).
  assert.equal(normalizePhone("62904225255654@s.whatsapp.net"), "+62904225255654");
});

test("normalizePhone: descarta sufixo de dispositivo Baileys (:12)", () => {
  assert.equal(normalizePhone("5511999999999:12@s.whatsapp.net"), "+5511999999999");
});

test("jidToNumber: extrai dígitos preservando o 55, removendo sufixos", () => {
  assert.equal(jidToNumber("5562904225255654@s.whatsapp.net"), "5562904225255654");
  assert.equal(jidToNumber("5511999999999:5@s.whatsapp.net"), "5511999999999");
  assert.equal(jidToNumber("556581197476@c.us"), "556581197476");
  assert.equal(jidToNumber(null), "");
});

// ── Caso real: outbound deve usar o remoteJid, não o phone quebrado ───────────

test("resolveSendNumber: usa o remoteJid correto mesmo com phone salvo errado", () => {
  // remoteJid correto (5562...), mas phone salvo veio quebrado (+62...).
  assert.equal(
    resolveSendNumber({
      remoteJid: "5562904225255654@s.whatsapp.net",
      phone: "+62904225255654",
    }),
    "5562904225255654" // usa o JID, ignora o +62 quebrado
  );
});

test("resolveSendNumber: cai no phone quando não há remoteJid", () => {
  assert.equal(resolveSendNumber({ remoteJid: null, phone: "+5511987654321" }), "5511987654321");
  assert.equal(resolveSendNumber({ remoteJid: "", phone: "+5511987654321" }), "5511987654321");
});

test("resolveSendNumber: nunca remove o 55 automaticamente", () => {
  const out = resolveSendNumber({ remoteJid: "5562904225255654@s.whatsapp.net", phone: null });
  assert.ok(out.startsWith("55"), `esperava começar com 55, veio: ${out}`);
});
