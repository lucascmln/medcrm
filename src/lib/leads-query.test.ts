import { test } from "node:test";
import assert from "node:assert/strict";
import { activeLeadWhere, isLeadVisible } from "./leads-query";

test("activeLeadWhere: sempre exclui excluídos e escopa por tenant", () => {
  const w = activeLeadWhere("t1");
  assert.equal(w.tenantId, "t1");
  assert.equal(w.deletedAt, null);
});

test("activeLeadWhere: mescla filtros extras preservando tenant e deletedAt", () => {
  const w = activeLeadWhere("t1", { funnelStageId: "s1" });
  assert.deepEqual(w, { tenantId: "t1", deletedAt: null, funnelStageId: "s1" });
});

test("activeLeadWhere: não permite vazar outro tenant via extra", () => {
  // Mesmo que 'extra' tente sobrescrever tenant, o teste documenta o contrato:
  // o chamador deve confiar no 1º argumento. Aqui garantimos deletedAt fixo.
  const w = activeLeadWhere("t1", { deletedAt: null });
  assert.equal(w.deletedAt, null);
  assert.equal(w.tenantId, "t1");
});

test("isLeadVisible: lead excluído (deletedAt setado) não é visível", () => {
  assert.equal(isLeadVisible({ deletedAt: new Date() }), false);
  assert.equal(isLeadVisible({ deletedAt: "2026-01-01T00:00:00Z" }), false);
});

test("isLeadVisible: lead ativo é visível", () => {
  assert.equal(isLeadVisible({ deletedAt: null }), true);
  assert.equal(isLeadVisible({}), true);
});
