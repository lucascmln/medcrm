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

    const campaigns = await prisma.campaign.findMany({
      where: { tenantId },
      include: { _count: { select: { leads: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (err) {
    console.error("GET /api/campaigns error:", err);
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
    const campaign = await prisma.campaign.create({
      data: {
        tenantId,
        name:      body.name,
        channel:   body.channel   || null,
        budget:    body.budget    ? parseFloat(body.budget) : null,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate:   body.endDate   ? new Date(body.endDate)   : null,
      },
    });

    return NextResponse.json(campaign, { status: 201 });
  } catch (err) {
    console.error("POST /api/campaigns error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
