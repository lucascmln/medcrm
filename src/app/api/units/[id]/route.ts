import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const unit = await prisma.unit.findFirst({
    where: { id, tenantId: session.user.tenantId! },
    include: { _count: { select: { leads: true, doctors: true } } },
  });

  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(unit);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const existing = await prisma.unit.findFirst({ where: { id, tenantId: session.user.tenantId! } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const unit = await prisma.unit.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      address: body.address ?? existing.address,
      phone: body.phone ?? existing.phone,
      isActive: body.isActive ?? existing.isActive,
    },
  });

  return NextResponse.json(unit);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.unit.findFirst({ where: { id, tenantId: session.user.tenantId! } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.unit.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
