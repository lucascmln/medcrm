import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const units = await prisma.unit.findMany({
    where: { tenantId },
    include: { _count: { select: { leads: true, doctors: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(units);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const body = await req.json();
  const unit = await prisma.unit.create({
    data: {
      tenantId,
      name: body.name,
      address: body.address || null,
      phone: body.phone || null,
    },
  });

  return NextResponse.json(unit, { status: 201 });
}
