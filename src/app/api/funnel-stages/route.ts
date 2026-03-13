import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const stages = await prisma.funnelStage.findMany({
    where: { tenantId },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(stages);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const body = await req.json();
  const stage = await prisma.funnelStage.create({
    data: {
      tenantId,
      name: body.name,
      color: body.color ?? "#64748b",
      order: body.order ?? 99,
      isLost: body.isLost ?? false,
      isFinal: body.isFinal ?? false,
    },
  });

  return NextResponse.json(stage, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  // Bulk reorder
  const body = await req.json();
  const stages: Array<{ id: string; order: number; name?: string; color?: string }> = body.stages;

  await Promise.all(
    stages.map((s) =>
      prisma.funnelStage.update({
        where: { id: s.id },
        data: { order: s.order, name: s.name, color: s.color },
      })
    )
  );

  return NextResponse.json({ success: true });
}
