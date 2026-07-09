import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, phoneTail, samePhone, toProviderNumber } from "./phone";

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
