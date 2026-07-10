import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FUNNEL_STAGES,
  STAGE_HAS_LEADS_MESSAGE,
  resolveStagesWithFallback,
  visibleFunnelStages,
  canDeleteStage,
  reorderStages,
  applySingleDefault,
  type StageLike,
} from "./funnel";

test("etapas padrão: 6 etapas com inicial, ganho e perdido definidos", () => {
  assert.equal(DEFAULT_FUNNEL_STAGES.length, 6);
  assert.deepEqual(
    DEFAULT_FUNNEL_STAGES.map((s) => s.name),
    ["Novo Lead", "Em contato", "Agendado", "Compareceu", "Fechado", "Perdido"]
  );
  assert.equal(DEFAULT_FUNNEL_STAGES.find((s) => s.isDefault)?.name, "Novo Lead");
  assert.equal(DEFAULT_FUNNEL_STAGES.find((s) => s.isFinal)?.name, "Fechado");
  assert.equal(DEFAULT_FUNNEL_STAGES.find((s) => s.isLost)?.name, "Perdido");
});

test("fallback: sem etapas usa as padrão; com etapas usa as existentes (não duplica)", () => {
  const existing: StageLike[] = [{ id: "a", name: "X", color: "#000", order: 1 }];
  assert.equal(resolveStagesWithFallback(existing), existing);
  assert.equal(resolveStagesWithFallback([]), DEFAULT_FUNNEL_STAGES);
  assert.equal(resolveStagesWithFallback(null), DEFAULT_FUNNEL_STAGES);
});

test("etapas visíveis: exclui arquivadas, ordena por order", () => {
  const stages: StageLike[] = [
    { id: "b", name: "B", color: "#000", order: 2 },
    { id: "arch", name: "Arq", color: "#000", order: 3, isArchived: true },
    { id: "a", name: "A", color: "#000", order: 1 },
  ];
  const vis = visibleFunnelStages(stages);
  assert.deepEqual(vis.map((s) => s.id), ["a", "b"]); // arquivada some, ordenado
});

test("etapas visíveis: hideLost oculta etapas de perda", () => {
  const stages: StageLike[] = [
    { id: "a", name: "A", color: "#000", order: 1 },
    { id: "lost", name: "Perdido", color: "#000", order: 2, isLost: true },
  ];
  assert.deepEqual(visibleFunnelStages(stages, { hideLost: true }).map((s) => s.id), ["a"]);
  assert.deepEqual(visibleFunnelStages(stages, { hideLost: false }).map((s) => s.id), ["a", "lost"]);
});

test("não permite excluir etapa com leads ativos (mensagem segura)", () => {
  const blocked = canDeleteStage(3);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.reason, STAGE_HAS_LEADS_MESSAGE);
  assert.equal(canDeleteStage(0).ok, true);
});

test("reordenar etapas aplica order incremental conforme ids", () => {
  const stages: StageLike[] = [
    { id: "a", name: "A", color: "#000", order: 1 },
    { id: "b", name: "B", color: "#000", order: 2 },
    { id: "c", name: "C", color: "#000", order: 3 },
  ];
  const out = reorderStages(stages, ["c", "a", "b"]);
  assert.deepEqual(out.map((s) => [s.id, s.order]), [["c", 1], ["a", 2], ["b", 3]]);
});

test("applySingleDefault marca exatamente uma etapa como inicial", () => {
  const stages: StageLike[] = [
    { id: "a", name: "A", color: "#000", order: 1, isDefault: true },
    { id: "b", name: "B", color: "#000", order: 2 },
  ];
  const out = applySingleDefault(stages, "b");
  assert.equal(out.find((s) => s.id === "a")?.isDefault, false);
  assert.equal(out.find((s) => s.id === "b")?.isDefault, true);
  assert.equal(out.filter((s) => s.isDefault).length, 1);
});
