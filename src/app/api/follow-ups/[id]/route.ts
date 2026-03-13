import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const followUp = await prisma.followUp.update({
    where: { id },
    data: {
      status: body.status,
      notes: body.notes,
      dueAt: body.dueAt ? new Date(body.dueAt) : undefined,
      userId: body.userId,
      completedAt: body.status === "COMPLETED" ? new Date() : undefined,
    },
    include: {
      lead: { select: { id: true, name: true, phone: true, funnelStage: { select: { name: true, color: true } } } },
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(followUp);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  await prisma.followUp.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
