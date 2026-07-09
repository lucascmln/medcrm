/**
 * POST /api/integrations/whatsapp-qr/disconnect
 *
 * Desconecta e remove a instância WhatsApp QR do tenant.
 * O registro no banco é mantido (isActive = false) para histórico.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import { disconnectInstance, isProviderConfigured } from "@/lib/whatsapp-qr-provider";

export async function POST(req: NextRequest) {
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

  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, external_id, config
    FROM tenant_integrations
    WHERE tenant_id = ${tenantId} AND provider = 'whatsapp_qr'
    ORDER BY created_at DESC LIMIT 1
  `;

  if (!rows.length) {
    return NextResponse.json({ error: "Nenhuma integração WhatsApp QR encontrada" }, { status: 404 });
  }

  const { id: integrationId, external_id: instanceName } = rows[0];

  // Desconecta no provider (se configurado)
  if (isProviderConfigured()) {
    await disconnectInstance(instanceName);
  }

  // Marca como inativo no banco e limpa config sensível
  const disconnectedConfig = JSON.stringify({
    status: "disconnected",
    phoneNumber: null,
    lastConnectedAt: null,
    lastError: null,
  });

  await prisma.$executeRaw`
    UPDATE tenant_integrations
    SET is_active = false, config = ${disconnectedConfig}, updated_at = NOW()
    WHERE id = ${integrationId}
  `;

  return NextResponse.json({ success: true, message: "WhatsApp desconectado com sucesso." });
}
