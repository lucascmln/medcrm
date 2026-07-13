import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { id } = await params;

  // Isolamento de tenant: o histórico só é retornado se o lead pertencer ao tenant.
  const lead = await prisma.lead.findFirst({ where: { id, tenantId }, select: { id: true } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const history = await prisma.leadHistory.findMany({
    where: { leadId: id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json(history);
}
