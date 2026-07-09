/**
 * PATCH /api/whatsapp/conversations/[id]/reopen
 *
 * Reabre manualmente uma conversa encerrada (status = OPEN).
 * (A reabertura automática por nova mensagem inbound é tratada no webhook.)
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

  const conversation = await prisma.whatsAppConversation.findFirst({
    where: { id, tenantId },
    select: { id: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  await prisma.whatsAppConversation.update({
    where: { id },
    data: { status: "OPEN" },
  });

  return NextResponse.json({ ok: true, status: "OPEN" });
}
