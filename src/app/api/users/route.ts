import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  const where: any = tenantId ? { tenantId } : {};

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      createdAt: true, unit: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["SUPER_ADMIN", "ADMIN"];
  if (!allowed.includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = session.user.tenantId;
  if (!tenantId && session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const hashed = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        tenantId: tenantId ?? body.tenantId,
        name: body.name,
        email: body.email,
        password: hashed,
        role: body.role ?? "ATTENDANT",
        unitId: body.unitId || null,
      },
      select: {
        id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
        unit: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Email já cadastrado" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
