import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import { DEFAULT_FUNNEL_STAGES, STAGE_HAS_LEADS_MESSAGE, canDeleteStage } from "@/lib/funnel";

/**
 * Cria as etapas padrão para um tenant que ainda não possui NENHUMA etapa.
 * Idempotente por design: só roda quando a contagem é zero (nunca duplica).
 */
async function ensureDefaultStages(tenantId: string) {
  const count = await prisma.funnelStage.count({ where: { tenantId } });
  if (count > 0) return;
  await prisma.funnelStage.createMany({
    data: DEFAULT_FUNNEL_STAGES.map((s) => ({
      tenantId,
      name: s.name,
      color: s.color,
      order: s.order,
      isDefault: s.isDefault,
      isFinal: s.isFinal,
      isLost: s.isLost,
    })),
  });
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const includeArchived = new URL(req.url).searchParams.get("includeArchived") === "1";

    // Fallback seguro: provisiona as etapas padrão se o tenant não tiver nenhuma.
    await ensureDefaultStages(tenantId);

    const stages = await prisma.funnelStage.findMany({
      where: { tenantId, ...(includeArchived ? {} : { isArchived: false }) },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(stages);
  } catch (error) {
    console.error("GET /api/funnel-stages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const body = await req.json();
    if (!body?.name?.trim()) {
      return NextResponse.json({ error: "Nome da etapa é obrigatório" }, { status: 400 });
    }

    // Nova etapa entra ao final por padrão.
    let order = body.order;
    if (order === undefined || order === null) {
      const last = await prisma.funnelStage.findFirst({
        where: { tenantId },
        orderBy: { order: "desc" },
        select: { order: true },
      });
      order = (last?.order ?? 0) + 1;
    }

    const stage = await prisma.funnelStage.create({
      data: {
        tenantId,
        name: body.name.trim(),
        color: body.color ?? "#64748b",
        order,
        isLost: body.isLost ?? false,
        isFinal: body.isFinal ?? false,
        isDefault: body.isDefault ?? false,
      },
    });

    return NextResponse.json(stage, { status: 201 });
  } catch (error) {
    console.error("POST /api/funnel-stages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * PUT — atualização em lote (reordenar/renomear/cor/flags). Cada update é
 * escopado por tenant (updateMany where {id, tenantId}) para impedir alteração
 * de etapa de outro tenant. Se alguma etapa marcar isDefault=true, garante que
 * apenas ela fique como inicial.
 */
export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const body = await req.json();
    const stages: Array<{
      id: string;
      order?: number;
      name?: string;
      color?: string;
      isDefault?: boolean;
      isFinal?: boolean;
      isLost?: boolean;
      isArchived?: boolean;
    }> = body.stages ?? [];

    const newDefaultId = stages.find((s) => s.isDefault === true)?.id;

    await prisma.$transaction(async (tx) => {
      // Se uma nova etapa inicial foi escolhida, zera as demais primeiro.
      if (newDefaultId) {
        await tx.funnelStage.updateMany({
          where: { tenantId, isDefault: true },
          data: { isDefault: false },
        });
      }
      for (const s of stages) {
        const data: Record<string, unknown> = {};
        if (s.order !== undefined) data.order = s.order;
        if (s.name !== undefined) data.name = s.name;
        if (s.color !== undefined) data.color = s.color;
        if (s.isFinal !== undefined) data.isFinal = s.isFinal;
        if (s.isLost !== undefined) data.isLost = s.isLost;
        if (s.isArchived !== undefined) data.isArchived = s.isArchived;
        // Garante exatamente UMA etapa inicial: se alguma foi marcada como
        // default, só ela fica true (as demais false); senão, respeita o valor.
        if (newDefaultId) data.isDefault = s.id === newDefaultId;
        else if (s.isDefault !== undefined) data.isDefault = s.isDefault;
        if (Object.keys(data).length === 0) continue;
        // Escopado por tenant — nunca toca etapa de outro tenant.
        await tx.funnelStage.updateMany({ where: { id: s.id, tenantId }, data });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PUT /api/funnel-stages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/**
 * DELETE ?id=<stageId>[&moveTo=<stageId>]
 * - Bloqueia (409) se a etapa tiver leads ATIVOS e nenhum destino for informado.
 * - Se `moveTo` for informado, move os leads ativos para lá e então exclui.
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const url = new URL(req.url);
    const id = url.searchParams.get("id") ?? "";
    const moveTo = url.searchParams.get("moveTo") ?? "";
    if (!id) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 });

    const stage = await prisma.funnelStage.findFirst({ where: { id, tenantId } });
    if (!stage) return NextResponse.json({ error: "Etapa não encontrada" }, { status: 404 });

    // Conta apenas leads ATIVOS (não excluídos) nesta etapa.
    const activeLeads = await prisma.lead.count({
      where: { tenantId, funnelStageId: id, deletedAt: null },
    });

    const decision = canDeleteStage(activeLeads);
    if (!decision.ok && !moveTo) {
      return NextResponse.json(
        { error: decision.reason ?? STAGE_HAS_LEADS_MESSAGE, leadCount: activeLeads },
        { status: 409 }
      );
    }

    // `funnelStageId` é FK obrigatória (inclusive em leads soft-deleted). Antes de
    // excluir a etapa, TODO lead que a referencia — ativo OU excluído — precisa ser
    // repontado, senão a exclusão viola a FK (P2003 → 500).
    const anyLeads = await prisma.lead.count({ where: { tenantId, funnelStageId: id } });

    if (anyLeads > 0) {
      // Destino: o informado (não arquivado) ou um fallback (inicial/primeira etapa).
      const target = moveTo
        ? await prisma.funnelStage.findFirst({ where: { id: moveTo, tenantId, isArchived: false } })
        : await prisma.funnelStage.findFirst({
            where: { tenantId, id: { not: id } },
            orderBy: [{ isDefault: "desc" }, { order: "asc" }],
          });
      if (!target || target.id === id) {
        return NextResponse.json(
          { error: "Etapa destino inválida — informe outra etapa para mover os leads", leadCount: activeLeads },
          { status: 400 }
        );
      }
      await prisma.$transaction([
        prisma.lead.updateMany({
          where: { tenantId, funnelStageId: id }, // ativos + soft-deleted
          data: { funnelStageId: target.id },
        }),
        prisma.funnelStage.deleteMany({ where: { id, tenantId } }),
      ]);
      return NextResponse.json({ success: true, movedLeads: activeLeads });
    }

    await prisma.funnelStage.deleteMany({ where: { id, tenantId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/funnel-stages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
