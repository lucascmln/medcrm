import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;
    const doctor = await prisma.doctor.findFirst({
      where: { id, tenantId },
      include: {
        unit:   { select: { id: true, name: true } },
        _count: { select: { leads: true } },
      },
    });

    if (!doctor) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(doctor);
  } catch (err) {
    console.error("GET /api/doctors/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.doctor.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const doctor = await prisma.doctor.update({
      where: { id },
      data: {
        name:      body.name      ?? existing.name,
        crm:       body.crm       ?? existing.crm,
        specialty: body.specialty ?? existing.specialty,
        phone:     body.phone     ?? existing.phone,
        email:     body.email     ?? existing.email,
        unitId:    body.unitId !== undefined ? body.unitId || null : existing.unitId,
        isActive:  body.isActive  ?? existing.isActive,
      },
      include: { unit: { select: { id: true, name: true } } },
    });

    return NextResponse.json(doctor);
  } catch (err) {
    console.error("PUT /api/doctors/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;
    const existing = await prisma.doctor.findFirst({ where: { id, tenantId } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.doctor.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/doctors/[id] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
