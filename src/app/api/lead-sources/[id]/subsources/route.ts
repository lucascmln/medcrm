import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const subsources = await prisma.leadSubsource.findMany({
    where: { sourceId: id, isActive: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(subsources);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const subsource = await prisma.leadSubsource.create({
    data: { sourceId: id, name: body.name },
  });
  return NextResponse.json(subsource, { status: 201 });
}
