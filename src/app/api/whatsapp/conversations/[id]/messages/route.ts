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
import { resolveWhatsAppSendTarget } from "@/lib/whatsapp/phone";

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
    select: { id: true, phone: true, instanceName: true, remoteJid: true, sendTargetJid: true },
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

  // Resolve o destino discável. NUNCA envia @lid/identificador opaco.
  // Prioridade: sendTargetJid discável → remoteJid discável → phone real.
  const target = resolveWhatsAppSendTarget({
    sendTargetJid: conversation.sendTargetJid,
    remoteJid: conversation.remoteJid,
    phone: conversation.phone,
  });

  // Sem destino discável (ex.: conversa só com @lid): não tenta enviar.
  if (!target.ok) {
    const message = await prisma.whatsAppMessage.create({
      data: {
        tenantId,
        conversationId: id,
        direction: "OUTBOUND",
        type: "TEXT",
        body: text,
        status: "FAILED",
        providerError: target.error,
        sentAt: now,
      },
      select: { id: true, direction: true, type: true, body: true, status: true, sentAt: true, createdAt: true },
    });
    return NextResponse.json({ error: target.error, message }, { status: 422 });
  }

  const send = await sendMessage(instanceName, target.number, text);

  const message = await prisma.whatsAppMessage.create({
    data: {
      tenantId,
      conversationId: id,
      direction: "OUTBOUND",
      type: "TEXT",
      body: text,
      status: send.ok ? "SENT" : "FAILED",
      providerError: send.ok ? null : (send.providerError ?? "Falha ao enviar pelo provider"),
      sentAt: now,
    },
    select: { id: true, direction: true, type: true, body: true, status: true, sentAt: true, createdAt: true },
  });

  // Atualiza a conversa apenas quando o envio teve sucesso.
  if (send.ok) {
    await prisma.whatsAppConversation.update({
      where: { id },
      data: { lastMessage: text.slice(0, 500), lastMessageAt: now, status: "OPEN" },
    });
    return NextResponse.json({ message });
  }

  return NextResponse.json(
    {
      error: "Falha ao enviar pelo provider",
      providerError: send.providerError,
      message,
    },
    { status: 502 }
  );
}
