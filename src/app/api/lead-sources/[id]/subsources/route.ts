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

  // Verify source belongs to tenant
  const source = await prisma.leadSource.findFirst({ where: { id, tenantId } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const subsources = await prisma.leadSubsource.findMany({
    where: { sourceId: id, isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(subsources);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { id } = await params;

  // Verify source belongs to tenant
  const source = await prisma.leadSource.findFirst({ where: { id, tenantId } });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const subsource = await prisma.leadSubsource.create({
    data: { sourceId: id, name: body.name },
  });
  return NextResponse.json(subsource, { status: 201 });
}
