/**
 * GET /api/whatsapp/conversations
 *
 * Lista as conversas WhatsApp do tenant atual, com busca e filtro.
 * Query params:
 *   q      — busca por nome do contato ou telefone
 *   filter — "open" (default) | "unread" | "all" | "closed"
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const filter = req.nextUrl.searchParams.get("filter") ?? "open";

  const where: Prisma.WhatsAppConversationWhereInput = { tenantId };

  if (filter === "open") where.status = "OPEN";
  else if (filter === "closed") where.status = "CLOSED";
  else if (filter === "unread") where.unreadCount = { gt: 0 };
  // "all" → sem filtro de status

  if (q) {
    where.OR = [
      { contactName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q.replace(/\D/g, "") || q } },
      { lead: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const conversations = await prisma.whatsAppConversation.findMany({
    where,
    orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      phone: true,
      contactName: true,
      status: true,
      unreadCount: true,
      lastMessage: true,
      lastMessageAt: true,
      lead: {
        select: {
          id: true,
          name: true,
          email: true,
          funnelStageId: true,
          funnelStage: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });

  return NextResponse.json({ conversations });
}
