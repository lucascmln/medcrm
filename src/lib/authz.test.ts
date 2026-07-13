import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isValidRole,
  canManageUsers,
  canAssignRole,
  canActOnUser,
  validateRoleAssignment,
  userListScope,
} from "./authz";

test("isValidRole: aceita papéis conhecidos e rejeita o resto", () => {
  assert.equal(isValidRole("ADMIN"), true);
  assert.equal(isValidRole("SUPER_ADMIN"), true);
  assert.equal(isValidRole("ATTENDANT"), true);
  assert.equal(isValidRole("HACKER"), false);
  assert.equal(isValidRole(undefined), false);
  assert.equal(isValidRole(123), false);
});

test("ATTENDANT não pode gerenciar usuários (criar/editar/deletar)", () => {
  assert.equal(canManageUsers("ATTENDANT"), false);
  assert.equal(canManageUsers("MANAGER"), false);
  assert.equal(canManageUsers("ADMIN"), true);
  assert.equal(canManageUsers("SUPER_ADMIN"), true);
  assert.equal(canManageUsers(undefined), false);
});

test("ADMIN não pode criar/atribuir SUPER_ADMIN; SUPER_ADMIN pode", () => {
  assert.equal(canAssignRole("ADMIN", "SUPER_ADMIN"), false);
  assert.equal(canAssignRole("ADMIN", "ADMIN"), true);
  assert.equal(canAssignRole("ADMIN", "ATTENDANT"), true);
  assert.equal(canAssignRole("SUPER_ADMIN", "SUPER_ADMIN"), true);
  assert.equal(canAssignRole("ATTENDANT", "ATTENDANT"), false); // nem gerencia
  assert.equal(canAssignRole("ADMIN", "INVALIDO"), false);
});

test("validateRoleAssignment: papel inválido → 400; sem permissão → 403", () => {
  assert.deepEqual(validateRoleAssignment("ADMIN", "ATTENDANT"), { ok: true });
  const invalid = validateRoleAssignment("ADMIN", "ROOT");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.ok === false && invalid.status, 400);
  const forbidden = validateRoleAssignment("ADMIN", "SUPER_ADMIN");
  assert.equal(forbidden.ok, false);
  assert.equal(forbidden.ok === false && forbidden.status, 403);
});

test("ADMIN só atua sobre usuário do mesmo tenant", () => {
  const ok = canActOnUser({ actorRole: "ADMIN", isSuper: false, sameTenant: true, targetRole: "ATTENDANT" });
  assert.equal(ok.ok, true);
  const cross = canActOnUser({ actorRole: "ADMIN", isSuper: false, sameTenant: false, targetRole: "ATTENDANT" });
  assert.equal(cross.ok, false);
  assert.equal(cross.ok === false && cross.status, 403);
});

test("ADMIN não pode atuar sobre um SUPER_ADMIN", () => {
  const r = canActOnUser({ actorRole: "ADMIN", isSuper: false, sameTenant: true, targetRole: "SUPER_ADMIN" });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.status, 403);
});

test("ATTENDANT não pode atuar sobre nenhum usuário", () => {
  const r = canActOnUser({ actorRole: "ATTENDANT", isSuper: false, sameTenant: true, targetRole: "ATTENDANT" });
  assert.equal(r.ok, false);
});

test("SUPER_ADMIN pode atuar cross-tenant e sobre SUPER_ADMIN", () => {
  const cross = canActOnUser({ actorRole: "SUPER_ADMIN", isSuper: true, sameTenant: false, targetRole: "ADMIN" });
  assert.equal(cross.ok, true);
  const onSuper = canActOnUser({ actorRole: "SUPER_ADMIN", isSuper: true, sameTenant: false, targetRole: "SUPER_ADMIN" });
  assert.equal(onSuper.ok, true);
});

// ── Listagem de usuários (GET /api/users) ─────────────────────────────────────

test("ATTENDANT não pode listar usuários", () => {
  assert.deepEqual(userListScope({ role: "ATTENDANT", effectiveTenantId: "t1" }), { allowed: false });
});

test("MANAGER não pode listar usuários (por enquanto)", () => {
  assert.deepEqual(userListScope({ role: "MANAGER", effectiveTenantId: "t1" }), { allowed: false });
});

test("ADMIN lista APENAS usuários do próprio tenant efetivo", () => {
  assert.deepEqual(userListScope({ role: "ADMIN", effectiveTenantId: "t1" }), {
    allowed: true,
    where: { tenantId: "t1" },
  });
  // Tenant diferente → where filtra pelo outro tenant (nunca vê t1).
  assert.deepEqual(userListScope({ role: "ADMIN", effectiveTenantId: "t2" }), {
    allowed: true,
    where: { tenantId: "t2" },
  });
  // ADMIN sem tenant efetivo não lista.
  assert.deepEqual(userListScope({ role: "ADMIN", effectiveTenantId: null }), { allowed: false });
});

test("SUPER_ADMIN lista pelo tenant efetivo/impersonado; global se nenhum", () => {
  assert.deepEqual(userListScope({ role: "SUPER_ADMIN", effectiveTenantId: "t1" }), {
    allowed: true,
    where: { tenantId: "t1" },
  });
  assert.deepEqual(userListScope({ role: "SUPER_ADMIN", effectiveTenantId: null }), {
    allowed: true,
    where: {},
  });
});
