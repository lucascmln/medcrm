import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const reasons = await prisma.lossReason.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(reasons);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const body = await req.json();
  const reason = await prisma.lossReason.create({
    data: { tenantId, name: body.name },
  });
  return NextResponse.json(reason, { status: 201 });
}
