import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await prisma.tenant.findMany({
    include: {
      _count: { select: { users: true, leads: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tenants);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  try {
    const tenant = await prisma.tenant.create({
      data: {
        name: body.name,
        slug: body.slug,
        primaryColor: body.primaryColor ?? "#0284c7",
      },
    });

    // Create default funnel stages
    const defaultStages = [
      { name: "Novo lead", color: "#6366f1", order: 1, isDefault: true },
      { name: "Em atendimento", color: "#0284c7", order: 2 },
      { name: "Aguardando retorno", color: "#f59e0b", order: 3 },
      { name: "Agendado", color: "#10b981", order: 4 },
      { name: "Compareceu", color: "#059669", order: 5 },
      { name: "Fechado / converteu", color: "#16a34a", order: 6, isFinal: true },
      { name: "Perdido", color: "#ef4444", order: 7, isLost: true, isFinal: true },
    ];
    await prisma.funnelStage.createMany({
      data: defaultStages.map((s) => ({ ...s, tenantId: tenant.id })),
    });

    // Create default lead sources
    const defaultSources = [
      { name: "WhatsApp", color: "#25d366" },
      { name: "Instagram", color: "#e1306c" },
      { name: "Meta Ads", color: "#1877f2" },
      { name: "Google Ads", color: "#4285f4" },
      { name: "Site", color: "#64748b" },
      { name: "Indicação", color: "#8b5cf6" },
    ];
    await prisma.leadSource.createMany({
      data: defaultSources.map((s) => ({ ...s, tenantId: tenant.id })),
    });

    // Create admin user if email/password provided
    if (body.adminEmail && body.adminPassword) {
      const hashed = await bcrypt.hash(body.adminPassword, 10);
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          name: body.adminName ?? "Administrador",
          email: body.adminEmail,
          password: hashed,
          role: "ADMIN",
        },
      });
    }

    return NextResponse.json(tenant, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Slug já existe" }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
