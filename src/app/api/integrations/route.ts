import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

// Status das variáveis de ambiente — nunca expõe valores reais
function buildEnvStatus() {
  return {
    APP_BASE_URL:          { configured: !!process.env.APP_BASE_URL,          preview: process.env.APP_BASE_URL ? maskUrl(process.env.APP_BASE_URL) : null },
    META_VERIFY_TOKEN:     { configured: !!process.env.META_VERIFY_TOKEN,     preview: null },
    WHATSAPP_VERIFY_TOKEN: { configured: !!process.env.WHATSAPP_VERIFY_TOKEN, preview: null },
  };
}

// ─── GET — lista integrações do tenant + status das variáveis de ambiente ────
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantId = getEffectiveTenantId(req, session);

    // SUPER_ADMIN sem tenant selecionado: retorna lista vazia + envStatus
    // (não é erro — o admin pode ainda não ter escolhido um tenant)
    if (!tenantId) {
      console.log("[integrations GET] sem tenantId (SUPER_ADMIN sem tenant selecionado)");
      return NextResponse.json({ integrations: [], envStatus: buildEnvStatus() });
    }

    console.log("[integrations GET] tenant:", tenantId);

    const rows = await prisma.$queryRaw<any[]>`
      SELECT id, tenant_id, provider, external_id, label, config, is_active, created_at, updated_at
      FROM tenant_integrations
      WHERE tenant_id = ${tenantId}
      ORDER BY created_at ASC
    `;

    const integrations = rows.map((i) => {
      let configObj: Record<string, any> = {};
      try { configObj = JSON.parse(i.config ?? "{}"); } catch {}
      return {
        id:             i.id,
        provider:       i.provider,
        externalId:     i.external_id,
        label:          i.label,
        isActive:       Boolean(i.is_active),
        createdAt:      i.created_at,
        hasAccessToken: !!configObj.accessToken,
        displayPhone:   configObj.displayPhone ?? null,
      };
    });

    console.log(`[integrations GET] ${integrations.length} integração(ões) encontrada(s)`);

    return NextResponse.json({ integrations, envStatus: buildEnvStatus() });

  } catch (err: any) {
    console.error("[integrations GET] erro:", err?.message ?? err);
    return NextResponse.json(
      { error: "Erro interno", integrations: [], envStatus: buildEnvStatus() },
      { status: 500 }
    );
  }
}

// ─── POST — cria nova integração ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role ?? "")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) {
      return NextResponse.json({ error: "Selecione um tenant antes de criar integrações" }, { status: 403 });
    }

    const body = await req.json();
    const { provider, externalId, label, accessToken, displayPhone } = body;

    if (!provider || !externalId?.trim() || !label?.trim()) {
      return NextResponse.json({ error: "provider, externalId e label são obrigatórios" }, { status: 400 });
    }
    if (!["meta", "whatsapp"].includes(provider)) {
      return NextResponse.json({ error: "provider deve ser 'meta' ou 'whatsapp'" }, { status: 400 });
    }

    const config = JSON.stringify({
      ...(accessToken?.trim()  ? { accessToken:  accessToken.trim()  } : {}),
      ...(displayPhone?.trim() ? { displayPhone: displayPhone.trim() } : {}),
    });

    const id = `int-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await prisma.$executeRaw`
      INSERT INTO tenant_integrations (id, tenant_id, provider, external_id, label, config, is_active, created_at, updated_at)
      VALUES (${id}, ${tenantId}, ${provider}, ${externalId.trim()}, ${label.trim()}, ${config}, true, NOW(), NOW())
    `;

    console.log("[integrations POST] criado:", id, provider, externalId);
    return NextResponse.json({ id, provider, externalId, label, isActive: true }, { status: 201 });

  } catch (err: any) {
    console.error("[integrations POST] erro:", err?.message ?? err);
    if (err.message?.includes("UNIQUE constraint") || err.message?.includes("duplicate key")) {
      return NextResponse.json({ error: "Já existe uma integração com esse provider e ID externo" }, { status: 409 });
    }
    return NextResponse.json({ error: "Erro interno ao salvar integração" }, { status: 500 });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.hostname}`;
  } catch {
    return url.slice(0, 30);
  }
}
