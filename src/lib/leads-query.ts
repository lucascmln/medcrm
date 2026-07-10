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
