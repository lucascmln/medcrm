/**
 * PATCH /api/whatsapp/conversations/[id]/lead-stage
 *
 * Muda a etapa do funil do lead vinculado à conversa, diretamente pela tela
 * de mensagens. Registra LeadHistory (reflete no Kanban).
 * Body: { funnelStageId: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const funnelStageId: string = (body.funnelStageId ?? "").toString();
  if (!funnelStageId) {
    return NextResponse.json({ error: "funnelStageId obrigatório" }, { status: 400 });
  }

  const conversation = await prisma.whatsAppConversation.findFirst({
    where: { id, tenantId },
    select: { id: true, leadId: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }
  if (!conversation.leadId) {
    return NextResponse.json({ error: "Conversa sem lead vinculado" }, { status: 409 });
  }

  // A etapa alvo precisa pertencer ao mesmo tenant.
  const targetStage = await prisma.funnelStage.findFirst({
    where: { id: funnelStageId, tenantId },
    select: { id: true, name: true },
  });
  if (!targetStage) {
    return NextResponse.json({ error: "Etapa inválida" }, { status: 400 });
  }

  // Lead atual (para registrar fromStage → toStage).
  const lead = await prisma.lead.findFirst({
    where: { id: conversation.leadId, tenantId },
    select: { id: true, funnelStageId: true, funnelStage: { select: { name: true } } },
  });
  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  if (lead.funnelStageId === targetStage.id) {
    return NextResponse.json({ ok: true, unchanged: true, funnelStage: targetStage });
  }

  const fromName = lead.funnelStage?.name ?? null;

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: lead.id },
      data: { funnelStageId: targetStage.id, lastInteractionAt: new Date() },
    }),
    prisma.leadHistory.create({
      data: {
        leadId: lead.id,
        userId: session.user.id ?? null,
        action: "STAGE_CHANGED",
        fromStage: fromName,
        toStage: targetStage.name,
        description: `Etapa alterada pela conversa do WhatsApp: ${fromName ?? "—"} → ${targetStage.name}`,
      },
    }),
  ]);

  return NextResponse.json({ ok: true, funnelStage: targetStage });
}
