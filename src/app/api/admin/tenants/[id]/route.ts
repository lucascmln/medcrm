import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// ─── PUT — update tenant metadata ────────────────────────────────────────────
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  try {
    const tenant = await prisma.tenant.update({
      where: { id },
      data: {
        ...(body.name        !== undefined && { name:         body.name }),
        ...(body.slug        !== undefined && { slug:         body.slug }),
        ...(body.primaryColor!== undefined && { primaryColor: body.primaryColor }),
        ...(body.plan        !== undefined && { plan:         body.plan }),
        ...(body.isActive    !== undefined && { isActive:     Boolean(body.isActive) }),
      },
    });
    return NextResponse.json(tenant);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Slug já está em uso" }, { status: 409 });
    }
    if (error?.code === "P2025") {
      return NextResponse.json({ error: "Tenant não encontrado" }, { status: 404 });
    }
    console.error("[admin/tenants/[id] PUT]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
