import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

// ─── PUT — atualiza integração ────────────────────────────────────────────────
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { label, externalId, accessToken, displayPhone, isActive } = body;

    const existing = await prisma.$queryRaw<any[]>`
      SELECT id, label, external_id, config, is_active
      FROM tenant_integrations
      WHERE id = ${id} AND tenant_id = ${tenantId}
      LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
    }

    const row = existing[0];
    let currentConfig: Record<string, any> = {};
    try { currentConfig = JSON.parse(row.config ?? "{}"); } catch {}

    const newConfig = JSON.stringify({
      ...currentConfig,
      ...(accessToken  !== undefined && accessToken  !== "" ? { accessToken }  : {}),
      ...(displayPhone !== undefined && displayPhone !== "" ? { displayPhone } : {}),
    });

    const newLabel      = label      ?? row.label;
    const newExternalId = externalId ?? row.external_id;
    const newIsActive   = isActive   !== undefined ? Boolean(isActive) : Boolean(row.is_active);

    await prisma.$executeRaw`
      UPDATE tenant_integrations
      SET label       = ${newLabel},
          external_id = ${newExternalId},
          config      = ${newConfig},
          is_active   = ${newIsActive},
          updated_at  = NOW()
      WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    console.log("[integrations PUT] atualizado:", id);
    return NextResponse.json({ id, label: newLabel, externalId: newExternalId, isActive: Boolean(newIsActive) });

  } catch (err: any) {
    console.error("[integrations PUT] erro:", err?.message ?? err);
    return NextResponse.json({ error: "Erro interno ao atualizar" }, { status: 500 });
  }
}

// ─── DELETE — remove integração ───────────────────────────────────────────────
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const { id } = await params;

    const existing = await prisma.$queryRaw<any[]>`
      SELECT id FROM tenant_integrations WHERE id = ${id} AND tenant_id = ${tenantId} LIMIT 1
    `;
    if (!existing.length) {
      return NextResponse.json({ error: "Integração não encontrada" }, { status: 404 });
    }

    await prisma.$executeRaw`
      DELETE FROM tenant_integrations WHERE id = ${id} AND tenant_id = ${tenantId}
    `;

    console.log("[integrations DELETE] removido:", id);
    return NextResponse.json({ deleted: true });

  } catch (err: any) {
    console.error("[integrations DELETE] erro:", err?.message ?? err);
    return NextResponse.json({ error: "Erro interno ao remover" }, { status: 500 });
  }
}
