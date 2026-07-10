import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  phoneTail,
  samePhone,
  toProviderNumber,
  jidToNumber,
  resolveSendNumber,
  isLidJid,
  isDialableJid,
  looksLikeDialablePhone,
  pickDialableJid,
  resolveWhatsAppSendTarget,
  resolveInboundIdentity,
  NO_DIALABLE_TARGET_ERROR,
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

// ── LID / detecção de JID discável ────────────────────────────────────────────

test("isLidJid: reconhece @lid como identificador opaco", () => {
  assert.equal(isLidJid("195223946834081@lid"), true);
  assert.equal(isLidJid("5511987654321@s.whatsapp.net"), false);
  assert.equal(isLidJid(null), false);
});

test("isDialableJid: só @s.whatsapp.net e @c.us são discáveis", () => {
  assert.equal(isDialableJid("5511987654321@s.whatsapp.net"), true);
  assert.equal(isDialableJid("5511987654321@c.us"), true);
  assert.equal(isDialableJid("195223946834081@lid"), false);
  assert.equal(isDialableJid("123@g.us"), false);
  assert.equal(isDialableJid(null), false);
});

test("looksLikeDialablePhone: comprimento plausível de E.164", () => {
  assert.equal(looksLikeDialablePhone("5511987654321"), true);
  assert.equal(looksLikeDialablePhone("+55 11 98765-4321"), true);
  assert.equal(looksLikeDialablePhone("123"), false); // curto demais
  assert.equal(looksLikeDialablePhone("1952239468340812345"), false); // longo demais
  assert.equal(looksLikeDialablePhone(""), false);
});

test("pickDialableJid: escolhe o primeiro discável, ignorando @lid", () => {
  assert.equal(
    pickDialableJid(["195223946834081@lid", "5511987654321@s.whatsapp.net"]),
    "5511987654321@s.whatsapp.net"
  );
  assert.equal(pickDialableJid(["195223946834081@lid", null, "123@g.us"]), null);
  assert.equal(pickDialableJid([]), null);
});

// ── resolveWhatsAppSendTarget: o core do fix outbound @lid ─────────────────────

test("outbound: @lid puro NÃO vira número de envio → erro claro", () => {
  const r = resolveWhatsAppSendTarget({
    remoteJid: "195223946834081@lid",
    phone: "+195223946834081", // phone derivado do lid — também não confiável
  });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.error, NO_DIALABLE_TARGET_ERROR);
});

test("outbound: sendTargetJid discável tem prioridade mesmo com remoteJid @lid", () => {
  const r = resolveWhatsAppSendTarget({
    sendTargetJid: "5511987654321@s.whatsapp.net",
    remoteJid: "195223946834081@lid",
    phone: "+195223946834081",
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.number, "5511987654321");
  assert.equal(r.ok === true && r.source, "sendTargetJid");
});

test("outbound: remoteJid @s.whatsapp.net funciona quando não há sendTargetJid", () => {
  const r = resolveWhatsAppSendTarget({
    remoteJid: "5562904225255654@s.whatsapp.net",
    phone: "+62904225255654", // phone quebrado é ignorado
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.number, "5562904225255654");
  assert.equal(r.ok === true && r.source, "remoteJid");
});

test("outbound: conversa antiga sem remoteJid usa phone com DDI 55 como fallback", () => {
  const r = resolveWhatsAppSendTarget({ remoteJid: null, phone: "+5511987654321" });
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.number, "5511987654321");
  assert.equal(r.ok === true && r.source, "phone");
  assert.ok(r.ok === true && r.number.startsWith("55"), "deve preservar o DDI 55");
});

test("outbound: número inválido +195223946834081 vindo de @lid não é usado", () => {
  const r = resolveWhatsAppSendTarget({
    remoteJid: "195223946834081@lid",
    phone: "+195223946834081",
  });
  assert.equal(r.ok, false);
});

test("outbound: sem nenhum destino discável retorna erro", () => {
  const r = resolveWhatsAppSendTarget({ remoteJid: null, phone: null });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.error, NO_DIALABLE_TARGET_ERROR);
});

// ── resolveInboundIdentity: extração do destino discável no webhook ────────────

test("inbound: @lid + senderPn @s.whatsapp.net → usa senderPn como sendTarget", () => {
  const id = resolveInboundIdentity({
    remoteJid: "195223946834081@lid",
    candidates: ["5511987654321@s.whatsapp.net"], // senderPn
  });
  assert.equal(id.remoteJid, "195223946834081@lid"); // bruto preservado
  assert.equal(id.sendTargetJid, "5511987654321@s.whatsapp.net");
  assert.equal(id.phone, "+5511987654321"); // phone derivado do discável, não do lid

  // E o outbound resolvido a partir daí é discável:
  const send = resolveWhatsAppSendTarget({ sendTargetJid: id.sendTargetJid, remoteJid: id.remoteJid, phone: id.phone });
  assert.equal(send.ok === true && send.number, "5511987654321");
});

test("inbound: @lid + participant @s.whatsapp.net → usa participant", () => {
  const id = resolveInboundIdentity({
    remoteJid: "195223946834081@lid",
    candidates: [undefined, null, "5562988887777@s.whatsapp.net"], // participant após vazios
  });
  assert.equal(id.sendTargetJid, "5562988887777@s.whatsapp.net");
  assert.equal(id.phone, "+5562988887777");
});

test("inbound: remoteJid @s.whatsapp.net já discável vira o próprio sendTarget", () => {
  const id = resolveInboundIdentity({
    remoteJid: "5511987654321@s.whatsapp.net",
    candidates: [],
  });
  assert.equal(id.sendTargetJid, "5511987654321@s.whatsapp.net");
  assert.equal(id.phone, "+5511987654321");
});

test("inbound: só @lid, sem candidato discável → sendTargetJid null, phone do lid", () => {
  const id = resolveInboundIdentity({
    remoteJid: "195223946834081@lid",
    candidates: [null, undefined],
  });
  assert.equal(id.sendTargetJid, null);
  // phone cai no lid (para identidade/dedupe), mas outbound será bloqueado:
  const send = resolveWhatsAppSendTarget({ sendTargetJid: id.sendTargetJid, remoteJid: id.remoteJid, phone: id.phone });
  assert.equal(send.ok, false);
});
