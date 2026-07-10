/**
 * POST /api/whatsapp/conversations/[id]/messages
 *
 * Envia uma mensagem de texto pela conversa (OUTBOUND).
 * Fluxo: valida → envia pelo provider → persiste (SENT ou FAILED) → atualiza conversa.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";
import { sendMessage, getProviderMode } from "@/lib/whatsapp-qr-provider";
import { resolveSendNumber } from "@/lib/whatsapp/phone";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant não selecionado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const text: string = (body.text ?? "").toString().trim();

  if (!text) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }
  if (text.length > 4096) {
    return NextResponse.json({ error: "Mensagem muito longa (máx. 4096)" }, { status: 400 });
  }

  const conversation = await prisma.whatsAppConversation.findFirst({
    where: { id, tenantId },
    select: { id: true, phone: true, instanceName: true, remoteJid: true },
  });
  if (!conversation) {
    return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 });
  }

  if (getProviderMode() === "none") {
    return NextResponse.json(
      { error: "Provider WhatsApp QR não configurado. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY." },
      { status: 503 }
    );
  }

  // Descobre a instância (da conversa ou da integração do tenant).
  let instanceName = conversation.instanceName;
  if (!instanceName) {
    const rows = await prisma.$queryRaw<Array<{ external_id: string }>>`
      SELECT external_id FROM tenant_integrations
      WHERE tenant_id = ${tenantId} AND provider = 'whatsapp_qr' AND is_active = true
      ORDER BY created_at DESC LIMIT 1
    `;
    instanceName = rows[0]?.external_id ?? null;
  }
  if (!instanceName) {
    return NextResponse.json({ error: "Nenhuma instância WhatsApp ativa" }, { status: 409 });
  }

  const now = new Date();
  // Prefere o remoteJid original de quem enviou; phone só como fallback.
  const sendNumber = resolveSendNumber({ remoteJid: conversation.remoteJid, phone: conversation.phone });
  const ok = await sendMessage(instanceName, sendNumber, text);

  const message = await prisma.whatsAppMessage.create({
    data: {
      tenantId,
      conversationId: id,
      direction: "OUTBOUND",
      type: "TEXT",
      body: text,
      status: ok ? "SENT" : "FAILED",
      sentAt: now,
    },
    select: { id: true, direction: true, type: true, body: true, status: true, sentAt: true, createdAt: true },
  });

  // Atualiza a conversa apenas quando o envio teve sucesso.
  if (ok) {
    await prisma.whatsAppConversation.update({
      where: { id },
      data: { lastMessage: text.slice(0, 500), lastMessageAt: now, status: "OPEN" },
    });
  }

  if (!ok) {
    return NextResponse.json(
      { error: "Falha ao enviar pelo provider", message },
      { status: 502 }
    );
  }

  return NextResponse.json({ message });
}
