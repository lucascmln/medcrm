import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const doctors = await prisma.doctor.findMany({
    where: { tenantId },
    include: { unit: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(doctors);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const body = await req.json();
  const doctor = await prisma.doctor.create({
    data: {
      tenantId,
      name: body.name,
      crm: body.crm || null,
      specialty: body.specialty || null,
      phone: body.phone || null,
      email: body.email || null,
      unitId: body.unitId || null,
    },
    include: { unit: { select: { id: true, name: true } } },
  });

  return NextResponse.json(doctor, { status: 201 });
}
