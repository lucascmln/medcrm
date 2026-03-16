import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const status    = searchParams.get("status") || undefined;
    const leadId    = searchParams.get("leadId") || undefined;
    const startDate = searchParams.get("startDate");
    const endDate   = searchParams.get("endDate");

    const where: any = { tenantId };
    if (status) where.status = status;
    if (leadId) where.leadId = leadId;
    if (startDate || endDate) {
      where.scheduledAt = {};
      if (startDate) where.scheduledAt.gte = new Date(startDate);
      if (endDate)   where.scheduledAt.lte = new Date(endDate + "T23:59:59");
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
    });

    return NextResponse.json(appointments);
  } catch (err) {
    console.error("GET /api/appointments error:", err);
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
    if (!body.title || !body.scheduledAt) {
      return NextResponse.json({ error: "Título e data são obrigatórios" }, { status: 400 });
    }

    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        leadId:      body.leadId || null,
        userId:      body.userId || session.user.id,
        title:       body.title,
        notes:       body.notes || null,
        scheduledAt: new Date(body.scheduledAt),
        duration:    body.duration ?? 60,
        status:      "SCHEDULED",
      },
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        user: { select: { id: true, name: true } },
      },
    });

    if (body.leadId) {
      await prisma.lead.update({
        where: { id: body.leadId },
        data: { scheduledAt: new Date(body.scheduledAt), lastInteractionAt: new Date() },
      });
    }

    return NextResponse.json(appointment, { status: 201 });
  } catch (err) {
    console.error("POST /api/appointments error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
