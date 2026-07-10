/**
 * funnel.ts
 *
 * Lógica pura das etapas do funil de vendas — 100% testável sem banco.
 * Reutiliza o model Prisma `FunnelStage` (campos: name, color, order,
 * isDefault, isFinal [=ganho/fechado], isLost, isArchived).
 */

export interface StageLike {
  id?: string;
  name: string;
  color: string;
  order: number;
  isDefault?: boolean;
  isFinal?: boolean; // ganho / fechado
  isLost?: boolean;
  isArchived?: boolean;
}

export const DEFAULT_STAGE_COLOR = "#64748b";

/** Mensagem única exibida ao tentar excluir etapa com leads ativos. */
export const STAGE_HAS_LEADS_MESSAGE =
  "Esta etapa possui leads. Mova os leads para outra etapa antes de excluir.";

/**
 * Etapas padrão criadas quando um tenant ainda não tem nenhuma configurada.
 * Novo Lead é a inicial (isDefault), Fechado é ganho (isFinal), Perdido é isLost.
 */
export const DEFAULT_FUNNEL_STAGES: Array<{
  name: string;
  color: string;
  order: number;
  isDefault: boolean;
  isFinal: boolean;
  isLost: boolean;
}> = [
  { name: "Novo Lead", color: "#64748b", order: 1, isDefault: true, isFinal: false, isLost: false },
  { name: "Em contato", color: "#3b82f6", order: 2, isDefault: false, isFinal: false, isLost: false },
  { name: "Agendado", color: "#8b5cf6", order: 3, isDefault: false, isFinal: false, isLost: false },
  { name: "Compareceu", color: "#06b6d4", order: 4, isDefault: false, isFinal: false, isLost: false },
  { name: "Fechado", color: "#10b981", order: 5, isDefault: false, isFinal: true, isLost: false },
  { name: "Perdido", color: "#ef4444", order: 6, isDefault: false, isFinal: false, isLost: true },
];

/**
 * Fallback seguro: devolve as etapas existentes ou, se não houver nenhuma,
 * as etapas padrão. NUNCA duplica (só usa o padrão quando a lista está vazia).
 */
export function resolveStagesWithFallback<T extends StageLike>(
  existing: T[] | null | undefined
): T[] | typeof DEFAULT_FUNNEL_STAGES {
  return existing && existing.length > 0 ? existing : DEFAULT_FUNNEL_STAGES;
}

/**
 * Etapas visíveis no funil/kanban: exclui arquivadas, ordena por `order` e,
 * opcionalmente, oculta as de perda.
 */
export function visibleFunnelStages<T extends StageLike>(
  stages: T[],
  opts?: { hideLost?: boolean }
): T[] {
  return [...stages]
    .filter((s) => !s.isArchived)
    .filter((s) => (opts?.hideLost ? !s.isLost : true))
    .sort((a, b) => a.order - b.order);
}

/**
 * Regra de exclusão: bloqueia se a etapa tiver leads ativos. O chamador pode
 * oferecer mover os leads para outra etapa (moveToStageId) e então excluir.
 */
export function canDeleteStage(activeLeadCount: number): { ok: boolean; reason?: string } {
  if (activeLeadCount > 0) {
    return { ok: false, reason: STAGE_HAS_LEADS_MESSAGE };
  }
  return { ok: true };
}

/**
 * Reordena as etapas conforme a sequência de ids fornecida, atribuindo
 * `order` incremental (1..n). Ids desconhecidos são ignorados; etapas não
 * citadas mantêm-se ao final preservando a ordem relativa.
 */
export function reorderStages<T extends StageLike>(stages: T[], orderedIds: string[]): T[] {
  const byId = new Map(stages.map((s) => [s.id, s]));
  const result: T[] = [];
  for (const id of orderedIds) {
    const s = byId.get(id);
    if (s) {
      result.push(s);
      byId.delete(id);
    }
  }
  // Etapas não mencionadas vão para o fim, na ordem original.
  for (const s of stages) {
    if (s.id !== undefined && byId.has(s.id)) result.push(s);
  }
  return result.map((s, i) => ({ ...s, order: i + 1 }));
}

/**
 * Garante que exatamente uma etapa seja a inicial padrão (isDefault).
 */
export function applySingleDefault<T extends StageLike>(stages: T[], defaultId: string): T[] {
  return stages.map((s) => ({ ...s, isDefault: s.id === defaultId }));
}
