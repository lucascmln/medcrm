/**
 * POST /api/whatsapp/simulate
 *
 * Simula uma mensagem INBOUND para testar o inbox sem WhatsApp real.
 * Disponível SOMENTE em modo mock (WHATSAPP_QR_PROVIDER=mock).
 *
 * Exercita todo o fluxo real: cria lead na 1ª etapa do funil, cria conversa,
 * salva a mensagem e faz o lead aparecer no Kanban.
 *
 * Body (opcional): { phone?, name?, text? }
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import { getProviderMode } from "@/lib/whatsapp-qr-provider";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { processInboundMessage } from "@/lib/whatsapp/inbox";
import { prismaInboxStore } from "@/lib/whatsapp/inbox-store";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["SUPER_ADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    return NextResponse.json({ error: "Forbidden — requer ADMIN" }, { status: 403 });
  }
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  if (getProviderMode() !== "mock") {
    return NextResponse.json(
      { error: "Simulação disponível apenas em modo mock (defina WHATSAPP_QR_PROVIDER=mock)." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));

  // Telefone novo por padrão, para exercitar a criação de lead a cada teste.
  const rawPhone: string =
    (body.phone ?? "").toString() || `+5511${String(Date.now()).slice(-9)}`;
  const phone = normalizePhone(rawPhone);
  const name: string = (body.name ?? "").toString().trim() || "Contato Teste WhatsApp";
  const text: string = (body.text ?? "").toString().trim() || "Olá! Vim pelo WhatsApp e gostaria de informações.";

  // Instância mock do tenant (sintetiza se ainda não houver).
  const rows = await prisma.$queryRaw<Array<{ external_id: string }>>`
    SELECT external_id FROM tenant_integrations
    WHERE tenant_id = ${tenantId} AND provider = 'whatsapp_qr'
    ORDER BY created_at DESC LIMIT 1
  `;
  const instanceName = rows[0]?.external_id ?? `mock_${tenantId}`;

  try {
    const result = await processInboundMessage(prismaInboxStore, {
      tenantId,
      instanceName,
      phone,
      contactName: name,
      text,
      type: "TEXT",
      externalMessageId: `MOCK_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      sentAt: new Date(),
    });
    return NextResponse.json({ ok: true, simulated: { phone, name, text }, result });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Falha na simulação" },
      { status: 500 }
    );
  }
}
