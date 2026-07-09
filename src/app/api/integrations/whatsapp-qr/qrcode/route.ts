/**
 * GET /api/integrations/whatsapp-qr/qrcode
 *
 * Retorna o QR Code atual da instância do tenant.
 * Se a instância ainda não existe, cria antes de retornar.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import {
  getQRCode,
  createInstance,
  buildInstanceName,
  isProviderConfigured,
} from "@/lib/whatsapp-qr-provider";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  if (!isProviderConfigured()) {
    return NextResponse.json(
      { error: "Provider não configurado. Defina EVOLUTION_API_URL e EVOLUTION_API_KEY." },
      { status: 503 }
    );
  }

  // Busca ou cria instância
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, external_id, config
    FROM tenant_integrations
    WHERE tenant_id = ${tenantId} AND provider = 'whatsapp_qr'
    ORDER BY created_at DESC LIMIT 1
  `;

  let instanceName: string;
  let integrationId: string;

  if (rows.length === 0) {
    // Cria instância automaticamente na primeira chamada
    instanceName = buildInstanceName(tenantId);
    const id = `waqr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    integrationId = id;
    const initialConfig = JSON.stringify({ status: "disconnected", phoneNumber: null });
    await prisma.$executeRaw`
      INSERT INTO tenant_integrations
        (id, tenant_id, provider, external_id, label, config, is_active, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, 'whatsapp_qr', ${instanceName}, 'WhatsApp Principal', ${initialConfig}, true, NOW(), NOW())
    `;
    await createInstance(tenantId, instanceName);
  } else {
    instanceName = rows[0].external_id;
    integrationId = rows[0].id;
  }

  // Busca QR Code no provider
  const info = await getQRCode(instanceName);

  // Persiste status no banco
  let currentConfig: Record<string, any> = {};
  try { currentConfig = JSON.parse(rows[0]?.config ?? "{}"); } catch {}

  const newConfig = JSON.stringify({
    ...currentConfig,
    status: info.status,
    ...(info.status === "connected" ? { lastConnectedAt: new Date().toISOString() } : {}),
    ...(info.lastError ? { lastError: info.lastError } : { lastError: null }),
  });

  await prisma.$executeRaw`
    UPDATE tenant_integrations
    SET config = ${newConfig}, updated_at = NOW()
    WHERE id = ${integrationId}
  `;

  if (info.status === "error") {
    return NextResponse.json(
      { error: info.lastError ?? "Erro ao gerar QR Code", status: "error" },
      { status: 502 }
    );
  }

  if (info.status === "connected") {
    return NextResponse.json({
      status: "connected",
      message: "WhatsApp já está conectado. Não é necessário escanear QR.",
      phoneNumber: info.phoneNumber ?? null,
    });
  }

  return NextResponse.json({
    status: info.status,
    qrCodeBase64: info.qrCodeBase64 ?? null,
    qrCodeText: info.qrCodeText ?? null,
    instanceName,
  });
}
