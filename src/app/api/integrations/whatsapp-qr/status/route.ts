/**
 * GET /api/integrations/whatsapp-qr/status
 *
 * Retorna o status atual da integração WhatsApp QR do tenant.
 * Consulta o banco + opcionalmente o provider para status em tempo real.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import {
  getConnectionStatus,
  isProviderConfigured,
  getProviderMode,
  type QrConnectionStatus,
} from "@/lib/whatsapp-qr-provider";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  // Busca integração whatsapp_qr salva no banco para este tenant
  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, external_id, label, config, is_active, created_at, updated_at
    FROM tenant_integrations
    WHERE tenant_id = ${tenantId}
      AND provider = 'whatsapp_qr'
    ORDER BY created_at DESC
    LIMIT 1
  `;

  const providerConfigured = isProviderConfigured();

  if (!rows.length) {
    return NextResponse.json({
      configured: false,
      providerConfigured,
      providerMode: getProviderMode(),
      status: "disconnected" as QrConnectionStatus,
    });
  }

  const row = rows[0];
  let config: Record<string, any> = {};
  try { config = JSON.parse(row.config ?? "{}"); } catch {}

  const instanceName: string = row.external_id;

  // Se o provider estiver configurado, busca o estado em tempo real
  let liveStatus: QrConnectionStatus = config.status ?? "disconnected";
  let phoneNumber: string | null = config.phoneNumber ?? null;

  if (providerConfigured && instanceName) {
    try {
      const live = await getConnectionStatus(instanceName);
      liveStatus = live.status;
      if (live.phoneNumber) phoneNumber = live.phoneNumber;

      // Persiste o status atualizado se mudou
      if (live.status !== config.status || (live.phoneNumber && live.phoneNumber !== config.phoneNumber)) {
        const newConfig = JSON.stringify({
          ...config,
          status: live.status,
          phoneNumber: live.phoneNumber ?? config.phoneNumber,
          ...(live.status === "connected" ? { lastConnectedAt: new Date().toISOString() } : {}),
        });
        await prisma.$executeRaw`
          UPDATE tenant_integrations
          SET config = ${newConfig}, updated_at = NOW()
          WHERE id = ${row.id}
        `;
      }
    } catch (err: any) {
      console.warn("[whatsapp-qr status] live check falhou:", err.message);
    }
  }

  return NextResponse.json({
    configured: true,
    providerConfigured,
    providerMode: getProviderMode(),
    id: row.id,
    instanceName,
    label: row.label,
    status: liveStatus,
    phoneNumber,
    lastConnectedAt: config.lastConnectedAt ?? null,
    lastError: config.lastError ?? null,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
