/**
 * leads-query.ts
 *
 * Helpers puros para consultas de Lead com soft-delete. Um Lead é considerado
 * excluído quando `deletedAt` não é nulo — e nunca deve aparecer em listas nem
 * no funil.
 */

/**
 * Cláusula `where` base para leads ATIVOS (não excluídos), sempre escopada por
 * tenant. `extra` mescla filtros adicionais.
 *
 *   activeLeadWhere("t1", { funnelStageId: "s1" })
 *     → { tenantId: "t1", deletedAt: null, funnelStageId: "s1" }
 */
export function activeLeadWhere(
  tenantId: string,
  extra: Record<string, unknown> = {}
): Record<string, unknown> {
  return { tenantId, deletedAt: null, ...extra };
}

/** True se o lead está visível (não foi soft-deleted). */
export function isLeadVisible(lead: { deletedAt?: Date | string | null }): boolean {
  return lead.deletedAt === null || lead.deletedAt === undefined;
}

/**
 * Campos que NUNCA podem ser definidos pelo corpo de um update de lead vindo do
 * cliente — evita mass-assignment (mover de tenant, "des-excluir", forjar
 * identidade/timestamps).
 */
export const PROTECTED_LEAD_UPDATE_FIELDS = [
  "id",
  "tenantId",
  "deletedAt",
  "createdAt",
  "updatedAt",
] as const;

/** Remove os campos protegidos de um objeto de atualização de lead. */
export function stripProtectedLeadFields<T extends Record<string, unknown>>(data: T): T {
  const out = { ...data };
  for (const f of PROTECTED_LEAD_UPDATE_FIELDS) delete (out as Record<string, unknown>)[f];
  return out;
}
