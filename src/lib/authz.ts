/**
 * authz.ts
 *
 * Regras puras de autorização para gestão de usuários — 100% testável, sem
 * dependência de banco/sessão. As rotas resolvem sessão/tenant e delegam a
 * decisão para estas funções.
 *
 * Papéis: SUPER_ADMIN (global, cross-tenant) > ADMIN (gerencia o próprio
 * tenant) > MANAGER > ATTENDANT (sem gestão de usuários).
 */

export const USER_ROLES = ["SUPER_ADMIN", "ADMIN", "MANAGER", "ATTENDANT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** True se `role` é um papel válido conhecido. */
export function isValidRole(role: unknown): role is UserRole {
  return typeof role === "string" && (USER_ROLES as readonly string[]).includes(role);
}

/** Quem pode criar/editar/desativar usuários: apenas ADMIN e SUPER_ADMIN. */
export function canManageUsers(actorRole: string | undefined | null): boolean {
  return actorRole === "SUPER_ADMIN" || actorRole === "ADMIN";
}

/**
 * O ator pode ATRIBUIR o papel `targetRole`? Somente SUPER_ADMIN concede
 * SUPER_ADMIN; ADMIN concede apenas papéis não-super. Papel inválido → false.
 */
export function canAssignRole(actorRole: string | undefined | null, targetRole: unknown): boolean {
  if (!isValidRole(targetRole)) return false;
  if (targetRole === "SUPER_ADMIN") return actorRole === "SUPER_ADMIN";
  return canManageUsers(actorRole);
}

export type AuthzResult = { ok: true } | { ok: false; status: number; error: string };

const FORBIDDEN: AuthzResult = { ok: false, status: 403, error: "Forbidden" };

/**
 * O ator pode atuar (editar/desativar) sobre o usuário-alvo?
 * - precisa poder gerenciar usuários;
 * - se não for SUPER_ADMIN, o alvo precisa ser do mesmo tenant efetivo;
 * - ADMIN não pode tocar em um usuário SUPER_ADMIN.
 */
export function canActOnUser(input: {
  actorRole: string | undefined | null;
  isSuper: boolean;
  sameTenant: boolean;
  targetRole: string | undefined | null;
}): AuthzResult {
  if (!canManageUsers(input.actorRole)) return FORBIDDEN;
  if (!input.isSuper && !input.sameTenant) return FORBIDDEN;
  if (!input.isSuper && input.targetRole === "SUPER_ADMIN") return FORBIDDEN;
  return { ok: true };
}

/**
 * Valida a atribuição de papel numa criação/edição. Retorna erro adequado se o
 * papel for inválido (400) ou se o ator não puder concedê-lo (403).
 */
export function validateRoleAssignment(
  actorRole: string | undefined | null,
  requestedRole: unknown
): AuthzResult {
  if (!isValidRole(requestedRole)) {
    return { ok: false, status: 400, error: "Papel (role) inválido" };
  }
  if (!canAssignRole(actorRole, requestedRole)) {
    return { ok: false, status: 403, error: "Sem permissão para atribuir este papel" };
  }
  return { ok: true };
}
