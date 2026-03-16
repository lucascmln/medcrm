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

    // Verify lead belongs to this tenant
    const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const notes = await prisma.leadNote.findMany({
      where: { leadId: id },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(notes);
  } catch (err) {
    console.error("GET /api/leads/[id]/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;

    // Verify lead belongs to this tenant
    const lead = await prisma.lead.findFirst({ where: { id, tenantId } });
    if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

    await prisma.leadHistory.create({
      data: {
        leadId: id,
        userId: session.user.id,
        action: "NOTE_ADDED",
        description: "Observação adicionada",
      },
    });

    return NextResponse.json(note, { status: 201 });
  } catch (err) {
    console.error("POST /api/leads/[id]/notes error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
