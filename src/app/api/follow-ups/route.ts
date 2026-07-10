import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addDays } from "date-fns";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const leadId = searchParams.get("leadId") || undefined;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;

    const followUps = await prisma.followUp.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true, funnelStage: { select: { name: true, color: true } } } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { dueAt: "asc" },
    });

    return NextResponse.json(followUps);
  } catch (err) {
    console.error("GET /api/follow-ups error:", err);
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
    if (!body.leadId || !body.dueAt) {
      return NextResponse.json({ error: "Lead e data são obrigatórios" }, { status: 400 });
    }

    // O lead precisa ser ATIVO e do mesmo tenant.
    const lead = await prisma.lead.findFirst({
      where: { id: body.leadId, tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!lead) {
      return NextResponse.json({ error: "Lead inválido" }, { status: 400 });
    }

    const followUp = await prisma.followUp.create({
      data: {
        tenantId,
        leadId: body.leadId,
        userId: body.userId || session.user.id,
        dueAt:  new Date(body.dueAt),
        notes:  body.notes || null,
        isAuto: body.isAuto ?? false,
        status: "PENDING",
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, funnelStage: { select: { name: true, color: true } } } },
        user: { select: { id: true, name: true } },
      },
    });

    await prisma.lead.updateMany({
      where: { id: body.leadId, tenantId, deletedAt: null },
      data:  { lastInteractionAt: new Date() },
    });

    return NextResponse.json(followUp, { status: 201 });
  } catch (err) {
    console.error("POST /api/follow-ups error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Auto-generate follow-ups for leads without appointments after 2 days
export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const twoDaysAgo = addDays(new Date(), -2);

    const leadsNeedingFollowUp = await prisma.lead.findMany({
      where: {
        tenantId,
        deletedAt: null, // não gera follow-up automático para leads excluídos
        createdAt:  { lte: twoDaysAgo },
        scheduledAt: null,
        followUps:  { none: {} },
        funnelStage: { isLost: false, isFinal: false },
      },
      select: { id: true },
      take: 500, // limita o lote por execução (evita processamento ilimitado)
    });

    // Inserção em lote — 1 query em vez de N (era N+1 com create por lead).
    const now = new Date();
    const { count: created } = await prisma.followUp.createMany({
      data: leadsNeedingFollowUp.map((lead) => ({
        tenantId,
        leadId: lead.id,
        dueAt:  now,
        notes:  "Follow-up automático — lead sem agendamento há mais de 2 dias",
        isAuto: true,
        status: "PENDING",
      })),
    });

    return NextResponse.json({ created });
  } catch (err) {
    console.error("PATCH /api/follow-ups error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
