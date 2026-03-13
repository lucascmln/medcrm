import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const notes = await prisma.leadNote.findMany({
    where: { leadId: id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const note = await prisma.leadNote.create({
    data: {
      leadId: id,
      userId: session.user.id,
      content: body.content,
      isPrivate: body.isPrivate ?? false,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  // Add history entry
  await prisma.leadHistory.create({
    data: {
      leadId: id,
      userId: session.user.id,
      action: "NOTE_ADDED",
      description: "Observação adicionada",
    },
  });

  return NextResponse.json(note, { status: 201 });
}
