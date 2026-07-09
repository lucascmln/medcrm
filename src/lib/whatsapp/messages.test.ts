import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMessageText, deriveMessageType } from "./messages";

test("extractMessageText: texto simples", () => {
  assert.equal(extractMessageText({ conversation: "Olá" }), "Olá");
});

test("extractMessageText: extendedTextMessage", () => {
  assert.equal(extractMessageText({ extendedTextMessage: { text: "Oi" } }), "Oi");
});

test("extractMessageText: imagem com e sem legenda", () => {
  assert.equal(extractMessageText({ imageMessage: { caption: "foto" } }), "[Imagem] foto");
  assert.equal(extractMessageText({ imageMessage: {} }), "[Imagem]");
});

test("extractMessageText: fallback para mensagem vazia", () => {
  assert.equal(extractMessageText(undefined), "[mensagem sem texto]");
  assert.equal(extractMessageText({}), "[mensagem]");
});

test("deriveMessageType: mapeia tipos de mídia", () => {
  assert.equal(deriveMessageType({ conversation: "x" }), "TEXT");
  assert.equal(deriveMessageType({ imageMessage: {} }), "IMAGE");
  assert.equal(deriveMessageType({ audioMessage: {} }), "AUDIO");
  assert.equal(deriveMessageType({ documentMessage: {} }), "DOCUMENT");
  assert.equal(deriveMessageType(undefined), "TEXT");
});
