import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const sources = await prisma.leadSource.findMany({
    where: { tenantId },
    include: { subsources: { where: { isActive: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(sources);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const body = await req.json();
  const source = await prisma.leadSource.create({
    data: {
      tenantId,
      name: body.name,
      color: body.color ?? "#64748b",
      icon: body.icon ?? null,
    },
    include: { subsources: true },
  });

  return NextResponse.json(source, { status: 201 });
}
