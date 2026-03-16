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

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, name: true, slug: true, logo: true, primaryColor: true, plan: true, isActive: true },
    });

    if (!tenant) return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    return NextResponse.json(tenant);
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const allowed = ["SUPER_ADMIN", "ADMIN"];
    if (!allowed.includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const body = await req.json();
    const tenant = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name:         body.name,
        logo:         body.logo         ?? undefined,
        primaryColor: body.primaryColor ?? undefined,
      },
      select: { id: true, name: true, slug: true, logo: true, primaryColor: true, plan: true },
    });

    return NextResponse.json(tenant);
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
