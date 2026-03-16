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

    const reasons = await prisma.lossReason.findMany({
      where: { tenantId, isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(reasons);
  } catch (err) {
    console.error("GET /api/loss-reasons error:", err);
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
    const reason = await prisma.lossReason.create({
      data: { tenantId, name: body.name },
    });
    return NextResponse.json(reason, { status: 201 });
  } catch (err) {
    console.error("POST /api/loss-reasons error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
