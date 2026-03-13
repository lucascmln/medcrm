import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) {
      return NextResponse.json({ error: "No tenant" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";
    const stageId = searchParams.get("stageId") || "";
    const sourceId = searchParams.get("sourceId") || "";
    const assignedToId = searchParams.get("assignedToId") || "";
    const doctorId = searchParams.get("doctorId") || "";
    const unitId = searchParams.get("unitId") || "";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const all = searchParams.get("all") === "true";

    const where: any = { tenantId: tenantId! };

    if (search) {
      // SQLite does not support mode:"insensitive" — LIKE is already case-insensitive for ASCII
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { email: { contains: search } },
      ];
    }
    if (stageId) where.funnelStageId = stageId;
    if (sourceId) where.sourceId = sourceId;
    if (assignedToId) where.assignedToId = assignedToId;
    if (doctorId) where.doctorId = doctorId;
    if (unitId) where.unitId = unitId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate + "T23:59:59");
    }

    const include = {
      funnelStage: true,
      source: true,
      subsource: true,
      assignedTo: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true } },
      unit: { select: { id: true, name: true } },
      tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
      campaign: { select: { id: true, name: true } },
      followUps: {
        where: { status: "PENDING" },
        orderBy: { dueAt: "asc" as const },
        take: 1,
        select: { id: true, dueAt: true, status: true },
      },
    };

    if (all) {
      const leads = await prisma.lead.findMany({ where, include, orderBy: { createdAt: "desc" } });
      return NextResponse.json({ leads, total: leads.length });
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return NextResponse.json({ leads, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  try {
    const body = await req.json();
    const { tagIds, ...data } = body;

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        procedure: data.procedure || null,
        potentialValue: data.potentialValue ? parseFloat(data.potentialValue) : null,
        observations: data.observations || null,
        funnelStageId: data.funnelStageId,
        sourceId: data.sourceId || null,
        subsourceId: data.subsourceId || null,
        campaignId: data.campaignId || null,
        doctorId: data.doctorId || null,
        unitId: data.unitId || null,
        assignedToId: data.assignedToId || null,
        firstContactAt: data.assignedToId ? new Date() : null,
        tags: tagIds?.length
          ? { create: tagIds.map((tagId: string) => ({ tagId })) }
          : undefined,
      },
      include: {
        funnelStage: true,
        source: true,
        assignedTo: { select: { id: true, name: true } },
      },
    });

    // history entry
    await prisma.leadHistory.create({
      data: {
        leadId: lead.id,
        userId: session.user.id,
        action: "CREATED",
        toStage: lead.funnelStage.name,
        description: `Lead criado por ${session.user.name ?? "sistema"}`,
      },
    });

    return NextResponse.json(lead, { status: 201 });
  } catch (error) {
    console.error("POST /api/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
