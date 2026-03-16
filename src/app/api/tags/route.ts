import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const tags = await prisma.tag.findMany({ where: { tenantId }, orderBy: { name: "asc" } });
    return NextResponse.json(tags);
  } catch (err) {
    console.error("GET /api/tags error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const body = await req.json();
    const tag = await prisma.tag.create({
      data: { tenantId, name: body.name, color: body.color ?? "#64748b" },
    });
    return NextResponse.json(tag, { status: 201 });
  } catch (err) {
    console.error("POST /api/tags error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Ensure the tag belongs to this tenant before deleting
    const tag = await prisma.tag.findFirst({ where: { id, tenantId } });
    if (!tag) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.tag.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/tags error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
