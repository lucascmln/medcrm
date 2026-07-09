/**
 * GET /api/whatsapp/lead-conversation?leadId=<id>
 *
 * Resolve a conversa WhatsApp vinculada a um lead (escopado por tenant).
 * Usado pelos deep-links do Kanban e do drawer do lead.
 * Retorna { conversationId, status } ou { conversationId: null }.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  const leadId = req.nextUrl.searchParams.get("leadId");
  if (!leadId) {
    return NextResponse.json({ error: "leadId obrigatório" }, { status: 400 });
  }

  const conv = await prisma.whatsAppConversation.findFirst({
    where: { tenantId, leadId },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true, status: true },
  });

  return NextResponse.json({
    conversationId: conv?.id ?? null,
    status: conv?.status ?? null,
  });
}
