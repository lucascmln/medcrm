/**
 * GET /api/whatsapp/conversations/[id]
 *
 * Retorna a conversa (escopada ao tenant), suas mensagens e o lead vinculado
 * com dados úteis para o painel lateral (etapa do funil, últimas atividades).
 * Zera o contador de não-lidas ao abrir.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(
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

  // Escopo por tenant: findFirst com tenantId evita vazamento entre tenants.
  const conversation = await prisma.whatsAppConversation.findFirst({
    where: { id, tenantId },
    select: {
      id: true,
      phone: true,
      contactName: true,
      status: true,
      unreadCount: true,
      instanceName: true,
      createdAt: true,
      lead: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          trafficSource: true,
          funnelStageId: true,
          funnelStage: { select: { id: true, name: true, color: true } },
          history: {
            orderBy: { createdAt: "desc" },
            take: 10,
            select: { id: true, action: true, description: true, createdAt: true },
          },
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  const messages = await prisma.whatsAppMessage.findMany({
    where: { conversationId: id, tenantId },
    orderBy: { createdAt: "asc" },
    take: 500,
    select: {
      id: true,
      direction: true,
      type: true,
      body: true,
      mediaUrl: true,
      status: true,
      sentAt: true,
      createdAt: true,
    },
  });

  // Zera o contador de não-lidas ao abrir a conversa.
  if (conversation.unreadCount > 0) {
    await prisma.whatsAppConversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  // Etapas do funil disponíveis para o dropdown de classificação.
  const stages = await prisma.funnelStage.findMany({
    where: { tenantId },
    orderBy: { order: "asc" },
    select: { id: true, name: true, color: true, isFinal: true, isLost: true },
  });

  return NextResponse.json({ conversation: { ...conversation, unreadCount: 0 }, messages, stages });
}
