import { test } from "node:test";
import assert from "node:assert/strict";
import { primaryNav, allNavLabels, allNavHrefs, isNavGroup, type NavGroup } from "./nav";

test("menu renderiza o grupo 'Comercial'", () => {
  const labels = allNavLabels(primaryNav);
  assert.ok(labels.includes("Comercial"), "esperava 'Comercial' no menu");
});

test("'Comercial' é um grupo expansível/colapsável", () => {
  const comercial = primaryNav.find((e) => e.label === "Comercial");
  assert.ok(comercial && isNavGroup(comercial), "'Comercial' deve ser um NavGroup");
  assert.equal((comercial as NavGroup).children.length, 3);
});

test("dentro de Comercial: Funil de vendas, Todos os leads, Configurar funil", () => {
  const comercial = primaryNav.find((e) => e.label === "Comercial") as NavGroup;
  const childLabels = comercial.children.map((c) => c.label);
  assert.deepEqual(childLabels, ["Funil de vendas", "Todos os leads", "Configurar funil"]);
});

test("'Funil de vendas' leva ao kanban e 'Todos os leads' à lista", () => {
  const comercial = primaryNav.find((e) => e.label === "Comercial") as NavGroup;
  const byLabel = Object.fromEntries(comercial.children.map((c) => [c.label, c.href]));
  assert.equal(byLabel["Funil de vendas"], "/kanban");
  assert.equal(byLabel["Todos os leads"], "/leads");
  assert.equal(byLabel["Configurar funil"], "/settings/funnel");
});

test("'Pipelines' não aparece no menu", () => {
  assert.ok(!allNavLabels(primaryNav).includes("Pipelines"));
});

test("'Funil / Kanban' não aparece mais no menu", () => {
  assert.ok(!allNavLabels(primaryNav).includes("Funil / Kanban"));
});

test("todos os hrefs de navegação são rotas válidas conhecidas", () => {
  const hrefs = allNavHrefs(primaryNav);
  assert.ok(hrefs.includes("/kanban"));
  assert.ok(hrefs.includes("/leads"));
  assert.ok(hrefs.includes("/settings/funnel"));
});
