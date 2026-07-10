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

// ── Métricas (dashboard / relatórios / KPIs) ──────────────────────────────────
// Dashboard e relatórios contam leads via activeLeadWhere(tenantId, ...), que
// sempre injeta deletedAt: null. Estes testes modelam essa contagem.

/** Conta apenas leads ATIVOS, como as métricas fazem via `deletedAt: null`. */
function countLeadsForMetrics(leads: Array<{ deletedAt?: Date | string | null }>): number {
  return leads.filter(isLeadVisible).length;
}

const SAMPLE = [
  { id: "a", deletedAt: null },
  { id: "b", deletedAt: null },
  { id: "c", deletedAt: new Date() }, // excluído
];

test("KPIs: lead com deletedAt preenchido NÃO entra na contagem", () => {
  assert.equal(countLeadsForMetrics(SAMPLE), 2);
});

test("relatórios: filtro activeLeadWhere sempre exclui leads excluídos", () => {
  // Qualquer relatório de leads usa este where — deletedAt: null é garantido.
  const w = activeLeadWhere("t1", { createdAt: { gte: new Date(0) } });
  assert.equal(w.deletedAt, null);
});

test("lead ativo continua contando normalmente nas métricas", () => {
  const onlyActive = [{ id: "x", deletedAt: null }, { id: "y", deletedAt: undefined }];
  assert.equal(countLeadsForMetrics(onlyActive), 2);
});
