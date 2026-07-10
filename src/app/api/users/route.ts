import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getEffectiveTenantId } from "@/lib/tenant";
import { canManageUsers, validateRoleAssignment } from "@/lib/authz";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // SUPER_ADMIN with no impersonated tenant sees all users; otherwise scoped to tenant
    const tenantId = getEffectiveTenantId(req, session);
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
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const actorRole = session.user.role;
    const isSuper = actorRole === "SUPER_ADMIN";
    if (!canManageUsers(actorRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    if (!body.name?.trim() || !body.email?.trim()) {
      return NextResponse.json({ error: "Nome e e-mail são obrigatórios" }, { status: 400 });
    }
    if (!body.password || body.password.length < 6) {
      return NextResponse.json({ error: "Senha deve ter no mínimo 6 caracteres" }, { status: 400 });
    }

    // Papel: valida e impede ADMIN de criar SUPER_ADMIN.
    const requestedRole = body.role ?? "ATTENDANT";
    const roleCheck = validateRoleAssignment(actorRole, requestedRole);
    if (!roleCheck.ok) {
      return NextResponse.json({ error: roleCheck.error }, { status: roleCheck.status });
    }

    // Tenant: ADMIN é SEMPRE forçado ao próprio tenant (ignora body.tenantId).
    // SUPER_ADMIN usa o tenant impersonado (cookie) ou um body.tenantId validado.
    let targetTenantId: string | null;
    if (isSuper) {
      targetTenantId = getEffectiveTenantId(req, session) ?? (body.tenantId || null);
      if (targetTenantId) {
        const t = await prisma.tenant.findUnique({ where: { id: targetTenantId }, select: { id: true } });
        if (!t) return NextResponse.json({ error: "Tenant inválido" }, { status: 400 });
      }
      // Usuários não-SUPER_ADMIN precisam pertencer a um tenant.
      if (requestedRole !== "SUPER_ADMIN" && !targetTenantId) {
        return NextResponse.json({ error: "tenantId é obrigatório para este usuário" }, { status: 400 });
      }
    } else {
      targetTenantId = getEffectiveTenantId(req, session);
      if (!targetTenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });
    }

    const hashed = await bcrypt.hash(body.password, 10);

    const user = await prisma.user.create({
      data: {
        tenantId: targetTenantId,
        name:     body.name,
        email:    body.email,
        password: hashed,
        role:     requestedRole,
        unitId:   body.unitId || null,
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
    console.error("POST /api/users error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
