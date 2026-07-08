/**
 * Unit tests for avatar initials. Run with: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getInitials } from "./utils";

test("strips title and uses first + last name", () => {
  assert.equal(getInitials("Dra. Ana Silva"), "AS");
  assert.equal(getInitials("Dr. Ricardo Mendes"), "RM");
});

test("handles Doutor / Doutora written out", () => {
  assert.equal(getInitials("Doutora Ana Silva"), "AS");
  assert.equal(getInitials("Doutor Ricardo Mendes"), "RM");
});

test("single name → single initial", () => {
  assert.equal(getInitials("Ricardo"), "R");
  assert.equal(getInitials("Dr. Ricardo"), "R"); // title stripped, one name left
});

test("uses first and LAST word for 3+ word names", () => {
  assert.equal(getInitials("Mirela Vasconcelos"), "MV");
  assert.equal(getInitials("Ana Beatriz Souza"), "AS");
});

test("ignores extra whitespace", () => {
  assert.equal(getInitials("  Dra.   Ana   Silva  "), "AS");
});

test("always uppercase", () => {
  assert.equal(getInitials("mirela vasconcelos"), "MV");
});

test("safe fallback for empty / null / title-only", () => {
  assert.equal(getInitials(""), "?");
  assert.equal(getInitials(null), "?");
  assert.equal(getInitials(undefined), "?");
  assert.equal(getInitials("   "), "?");
  assert.equal(getInitials("Dr."), "?");
});
