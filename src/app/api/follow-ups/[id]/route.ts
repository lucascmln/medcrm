import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;

    // Verify ownership before updating
    const existing = await prisma.followUp.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const followUp = await prisma.followUp.update({
      where: { id },
      data: {
        status:      body.status,
        notes:       body.notes,
        dueAt:       body.dueAt ? new Date(body.dueAt) : undefined,
        userId:      body.userId,
        completedAt: body.status === "COMPLETED" ? new Date() : undefined,
      },
      include: {
        lead: { select: { id: true, name: true, phone: true, funnelStage: { select: { name: true, color: true } } } },
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(followUp);
  } catch (err) {
    console.error("PUT /api/follow-ups/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;

    // Verify ownership before deleting
    const existing = await prisma.followUp.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.followUp.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/follow-ups/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
