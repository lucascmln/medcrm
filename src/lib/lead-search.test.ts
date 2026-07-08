/**
 * Unit tests for the shared lead-search logic.
 * Run with:  npm test   (uses `tsx --test`, no extra runner needed)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizePhone,
  buildLeadSearchOr,
  phoneDigits,
  leadMatchesSearch,
  LEAD_SEARCH_TEXT_FIELDS,
} from "./lead-search";

const mirela = { name: "Mirela Vasconcelos", phone: "(11) 98003-0008", email: "mirela@ex.com", procedure: "Botox" };
const norma = { name: "Norma Silva", phone: "(21) 3333-4444", email: null, procedure: null };
const joao = { name: "João Pereira", phone: "(31) 91234-5678", email: "joao@ex.com", procedure: "Preenchimento" };

test("first name matches (Mirela → Mirela Vasconcelos)", () => {
  assert.ok(leadMatchesSearch(mirela, "Mirela"));
});

test("partial first name matches (mir → Mirela Vasconcelos)", () => {
  assert.ok(leadMatchesSearch(mirela, "mir"));
});

test("surname matches (Vasco → Mirela Vasconcelos)", () => {
  assert.ok(leadMatchesSearch(mirela, "Vasco"));
});

test("any slice of full name matches, case-insensitive", () => {
  assert.ok(leadMatchesSearch(mirela, "ela vasc"));
  assert.ok(leadMatchesSearch(mirela, "MIRELA"));
});

test("Norma only matches the Norma lead", () => {
  assert.ok(leadMatchesSearch(norma, "Norma"));
  assert.equal(leadMatchesSearch(mirela, "Norma"), false);
  assert.equal(leadMatchesSearch(joao, "Norma"), false);
});

test("phone matches with or without formatting", () => {
  assert.ok(leadMatchesSearch(mirela, "980030008"));       // raw digits
  assert.ok(leadMatchesSearch(mirela, "98003-0008"));      // partial formatted
  assert.ok(leadMatchesSearch(mirela, "(11) 98003-0008")); // exactly as stored
});

test("email and procedure are searchable", () => {
  assert.ok(leadMatchesSearch(mirela, "mirela@ex"));
  assert.ok(leadMatchesSearch(joao, "Preenchimento"));
});

test("non-existent term returns no match", () => {
  assert.equal(leadMatchesSearch(mirela, "Zzzxxx"), false);
  assert.equal(leadMatchesSearch(norma, "Zzzxxx"), false);
});

test("empty / whitespace term is treated as no filter (matches all)", () => {
  assert.ok(leadMatchesSearch(mirela, ""));
  assert.ok(leadMatchesSearch(mirela, "   "));
});

test("channel/origin is NOT part of the text search fields", () => {
  // The searchable fields are name/phone/email/procedure only — never source,
  // trafficSource or any channel column. Guards against search cross-matching
  // with the (separate, explicit) channel filter.
  assert.deepEqual([...LEAD_SEARCH_TEXT_FIELDS], ["name", "phone", "email", "procedure"]);
  const leadOnDirect = { ...mirela, source: "Direto", trafficSource: "DIRECT" } as any;
  // Searching the channel name must NOT match a lead just because it's "Direto".
  assert.equal(leadMatchesSearch(leadOnDirect, "Direto"), false);
});

test("normalizePhone keeps digits only", () => {
  assert.equal(normalizePhone("(11) 98003-0008"), "11980030008");
  assert.equal(normalizePhone(null), "");
});

test("phoneDigits skips terms with fewer than 3 digits", () => {
  assert.equal(phoneDigits("ab12"), "");   // 2 digits → skip
  assert.equal(phoneDigits("980"), "980"); // 3 digits → use
});

test("buildLeadSearchOr targets exactly the text fields, case-insensitive", () => {
  const or = buildLeadSearchOr("Mirela");
  assert.equal(or.length, 4);
  assert.deepEqual(or, [
    { name: { contains: "Mirela", mode: "insensitive" } },
    { phone: { contains: "Mirela", mode: "insensitive" } },
    { email: { contains: "Mirela", mode: "insensitive" } },
    { procedure: { contains: "Mirela", mode: "insensitive" } },
  ]);
});

test("buildLeadSearchOr is empty for a blank term", () => {
  assert.deepEqual(buildLeadSearchOr("   "), []);
});
