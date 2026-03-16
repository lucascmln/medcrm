import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;
    const lead = await prisma.lead.findFirst({
      where: { id, tenantId },
      include: {
        funnelStage: true,
        source: true,
        subsource: true,
        assignedTo: { select: { id: true, name: true, email: true } },
        doctor:     { select: { id: true, name: true, specialty: true } },
        unit:       { select: { id: true, name: true } },
        campaign:   { select: { id: true, name: true } },
        lossReason: { select: { id: true, name: true } },
        tags:       { include: { tag: true } },
        history: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
        notes: {
          include: { user: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(lead);
  } catch (err) {
    console.error("GET /api/leads/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { tagIds, ...data } = body;

    // Get current lead to track stage change
    const current = await prisma.lead.findFirst({
      where: { id, tenantId },
      include: { funnelStage: true },
    });
    if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updateData: any = { ...data };
    delete updateData.tagIds;

    if (data.potentialValue !== undefined) {
      updateData.potentialValue = data.potentialValue ? parseFloat(data.potentialValue) : null;
    }

    if (data.funnelStageId && data.funnelStageId !== current.funnelStageId) {
      const newStage = await prisma.funnelStage.findUnique({ where: { id: data.funnelStageId } });
      if (newStage) {
        if (newStage.isLost && !current.lostAt) updateData.lostAt = new Date();
        if (!newStage.isLost && !newStage.isFinal) {
          const name = newStage.name.toLowerCase();
          if (name.includes("agendado") && !current.scheduledAt) updateData.scheduledAt = new Date();
          if (name.includes("compareceu") && !current.attendedAt) updateData.attendedAt = new Date();
        }
        if (newStage.isFinal && !newStage.isLost && !current.closedAt) updateData.closedAt = new Date();

        await prisma.leadHistory.create({
          data: {
            leadId:      id,
            userId:      session.user.id,
            action:      "STAGE_CHANGED",
            fromStage:   current.funnelStage?.name ?? "—",
            toStage:     newStage.name,
            description: `Etapa alterada de "${current.funnelStage?.name ?? "—"}" para "${newStage.name}"`,
          },
        });
      }
    }

    if (data.assignedToId && data.assignedToId !== current.assignedToId && !current.firstContactAt) {
      updateData.firstContactAt = new Date();
    }

    if (tagIds !== undefined) {
      await prisma.leadTag.deleteMany({ where: { leadId: id } });
      if (tagIds.length > 0) {
        await prisma.leadTag.createMany({
          data: tagIds.map((tagId: string) => ({ leadId: id, tagId })),
        });
      }
    }

    const lead = await prisma.lead.update({
      where: { id },
      data:  updateData,
      include: {
        funnelStage: true,
        source:      true,
        subsource:   true,
        assignedTo:  { select: { id: true, name: true } },
        doctor:      { select: { id: true, name: true } },
        unit:        { select: { id: true, name: true } },
        tags:        { include: { tag: true } },
      },
    });

    return NextResponse.json(lead);
  } catch (error) {
    console.error("PUT /api/leads/[id] error:", error);
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
    const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.lead.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/leads/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
