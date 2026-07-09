/**
 * POST /api/integrations/whatsapp-qr/create
 *
 * Cria (ou recria) a instância WhatsApp QR para o tenant atual.
 * Se já existir uma integração, reconfigura o webhook e retorna o status.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import {
  createInstance,
  buildInstanceName,
  isProviderConfigured,
  getProviderConfig,
} from "@/lib/whatsapp-qr-provider";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden — requer ADMIN ou SUPER_ADMIN" }, { status: 403 });
  }

  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const label: string = body.label?.trim() || "WhatsApp Principal";

  // Busca integração existente
  const existing = await prisma.$queryRaw<any[]>`
    SELECT id, external_id, config
    FROM tenant_integrations
    WHERE tenant_id = ${tenantId}
      AND provider = 'whatsapp_qr'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const instanceName = existing[0]?.external_id ?? buildInstanceName(tenantId);

  // Salva/atualiza o registro no banco antes de chamar o provider
  if (existing.length === 0) {
    const id = `waqr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const initialConfig = JSON.stringify({
      status: "disconnected",
      phoneNumber: null,
      lastConnectedAt: null,
      lastError: null,
    });
    await prisma.$executeRaw`
      INSERT INTO tenant_integrations
        (id, tenant_id, provider, external_id, label, config, is_active, created_at, updated_at)
      VALUES
        (${id}, ${tenantId}, 'whatsapp_qr', ${instanceName}, ${label}, ${initialConfig}, true, NOW(), NOW())
    `;
  }

  const providerConfigured = isProviderConfigured();

  if (!providerConfigured) {
    // Modo sem provider: salva no banco e retorna status "not_configured"
    // O usuário pode configurar o provider depois sem perder a configuração
    return NextResponse.json({
      instanceName,
      label,
      status: "not_configured",
      message: "Integração registrada. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no servidor para ativar.",
    });
  }

  // Cria a instância no provider
  const info = await createInstance(tenantId, instanceName);

  // Persiste o status retornado pelo provider
  const config = JSON.stringify({
    status: info.status,
    phoneNumber: info.phoneNumber ?? null,
    lastConnectedAt: null,
    lastError: info.lastError ?? null,
    webhookUrl: getProviderConfig()?.webhookUrl,
  });

  await prisma.$executeRaw`
    UPDATE tenant_integrations
    SET label = ${label}, config = ${config}, updated_at = NOW()
    WHERE tenant_id = ${tenantId}
      AND provider = 'whatsapp_qr'
      AND external_id = ${instanceName}
  `;

  return NextResponse.json({
    instanceName,
    label,
    status: info.status,
    message: info.status === "connected"
      ? "WhatsApp já conectado."
      : "Instância criada. Agora gere o QR Code para conectar.",
  });
}
