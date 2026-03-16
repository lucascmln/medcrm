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
    const appointment = await prisma.appointment.findFirst({
      where: { id, tenantId },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (!appointment) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(appointment);
  } catch (err) {
    console.error("GET /api/appointments/[id] error:", err);
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

    // Verify ownership before updating
    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        title:       body.title,
        notes:       body.notes,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined,
        duration:    body.duration,
        status:      body.status,
        leadId:      body.leadId,
        userId:      body.userId,
      },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(appointment);
  } catch (err) {
    console.error("PUT /api/appointments/[id] error:", err);
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
    const existing = await prisma.appointment.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.appointment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/appointments/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
