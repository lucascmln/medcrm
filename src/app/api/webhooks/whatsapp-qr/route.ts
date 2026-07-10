/**
 * POST /api/webhooks/whatsapp-qr
 *
 * Recebe eventos da Evolution API (ou provider compatível) e do simulador mock.
 *
 * Eventos tratados:
 *   MESSAGES_UPSERT    — nova mensagem recebida → cria/atualiza lead, conversa e mensagem
 *   CONNECTION_UPDATE  — mudança de status da conexão → persiste em tenant_integrations
 *   QRCODE_UPDATED     — novo QR Code gerado → persiste em tenant_integrations
 *
 * Segurança: valida token opcional (WHATSAPP_QR_WEBHOOK_TOKEN) e resolve o tenant
 * exclusivamente pela instância cadastrada — nunca confia num tenantId do corpo.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getIp } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/whatsapp/phone";
import { extractMessageText, deriveMessageType } from "@/lib/whatsapp/messages";
import { processInboundMessage } from "@/lib/whatsapp/inbox";
import { prismaInboxStore } from "@/lib/whatsapp/inbox-store";

// ── Tipos Evolution API ───────────────────────────────────────────────────────

interface EvolutionMessageKey {
  remoteJid: string; // ex: "5511987654321@s.whatsapp.net"
  fromMe: boolean;
  id: string;
}

interface EvolutionMessageData {
  key: EvolutionMessageKey;
  pushName?: string; // nome do contato no WhatsApp
  message?: Record<string, unknown>;
  messageType?: string;
  messageTimestamp?: number;
  status?: string;
}

interface EvolutionWebhookPayload {
  event: string; // "messages.upsert" | "connection.update" | "qrcode.updated"
  instance: string; // instanceName
  data: EvolutionMessageData | Record<string, unknown>;
  apikey?: string;
}

// ── Utilitários de conexão (tenant_integrations) ───────────────────────────────

/** Resolve o tenantId pela instância cadastrada em tenant_integrations. */
async function resolveTenantByInstance(instanceName: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ tenant_id: string }>>`
    SELECT tenant_id FROM tenant_integrations
    WHERE provider = 'whatsapp_qr'
      AND external_id = ${instanceName}
      AND is_active = true
    LIMIT 1
  `;
  return rows[0]?.tenant_id ?? null;
}

/** Persiste mudança de status da conexão no banco. */
async function persistConnectionStatus(instanceName: string, state: string, error?: string) {
  let mappedStatus: string;
  switch (state) {
    case "open":       mappedStatus = "connected";    break;
    case "close":      mappedStatus = "disconnected"; break;
    case "connecting": mappedStatus = "connecting";   break;
    default:           mappedStatus = state;
  }

  const rows = await prisma.$queryRaw<any[]>`
    SELECT id, config FROM tenant_integrations
    WHERE provider = 'whatsapp_qr' AND external_id = ${instanceName}
    LIMIT 1
  `;
  if (!rows.length) return;

  let config: Record<string, any> = {};
  try { config = JSON.parse(rows[0].config ?? "{}"); } catch {}

  const newConfig = JSON.stringify({
    ...config,
    status: mappedStatus,
    ...(mappedStatus === "connected" ? { lastConnectedAt: new Date().toISOString(), lastError: null } : {}),
    ...(error ? { lastError: error.slice(0, 300) } : {}),
  });

  await prisma.$executeRaw`
    UPDATE tenant_integrations
    SET config = ${newConfig}, updated_at = NOW()
    WHERE id = ${rows[0].id}
  `;
}

// ── Handler principal ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Rate limit por IP
  const rl = rateLimit(getIp(req), 120, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ received: false, error: "Too many requests" }, { status: 429 });
  }

  // Validação opcional de token (querystring ?token= ou header). Só exige se configurado.
  const expectedToken = process.env.WHATSAPP_QR_WEBHOOK_TOKEN;
  if (expectedToken) {
    const provided =
      req.nextUrl.searchParams.get("token") ??
      req.headers.get("x-webhook-token") ??
      "";
    if (provided !== expectedToken) {
      return NextResponse.json({ received: false, error: "Invalid token" }, { status: 401 });
    }
  }

  let rawBody: string;
  let payload: EvolutionWebhookPayload;
  try {
    rawBody = await req.text();
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ received: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { event, instance: instanceName, data } = payload;
  console.log(`[whatsapp-qr] evento=${event} instância=${instanceName}`);

  // ── CONNECTION_UPDATE ──────────────────────────────────────────────────────
  if (event === "connection.update") {
    const c = data as { state?: string; lastDisconnect?: any };
    const state = c.state ?? "close";
    const errReason = c.lastDisconnect?.error?.output?.statusCode;
    await persistConnectionStatus(instanceName, state, errReason ? String(errReason) : undefined);
    await prisma.webhookEvent
      .create({ data: { source: "whatsapp-qr", payload: rawBody.slice(0, 2000), status: "PROCESSED" } })
      .catch(() => {});
    return NextResponse.json({ received: true, type: "connection_update" });
  }

  // ── QRCODE_UPDATED ─────────────────────────────────────────────────────────
  if (event === "qrcode.updated") {
    const qrData = data as { qrcode?: { base64?: string } };
    const base64 = qrData.qrcode?.base64 ?? null;
    if (base64 && instanceName) {
      const rows = await prisma.$queryRaw<any[]>`
        SELECT id, config FROM tenant_integrations
        WHERE provider = 'whatsapp_qr' AND external_id = ${instanceName} LIMIT 1
      `;
      if (rows.length) {
        let config: Record<string, any> = {};
        try { config = JSON.parse(rows[0].config ?? "{}"); } catch {}
        const newConfig = JSON.stringify({ ...config, status: "qr_ready", lastQRCode: base64 });
        await prisma.$executeRaw`
          UPDATE tenant_integrations SET config = ${newConfig}, updated_at = NOW()
          WHERE id = ${rows[0].id}
        `;
      }
    }
    return NextResponse.json({ received: true, type: "qrcode_updated" });
  }

  // ── MESSAGES_UPSERT ────────────────────────────────────────────────────────
  if (event !== "messages.upsert") {
    return NextResponse.json({ received: true, skipped: true, event });
  }

  const msgData = data as EvolutionMessageData;

  // Ignora mensagens enviadas pelo próprio número (echo) e grupos/broadcast.
  if (msgData.key?.fromMe === true) {
    return NextResponse.json({ received: true, skipped: true, reason: "fromMe" });
  }
  const remoteJid = msgData.key?.remoteJid ?? "";
  if (remoteJid.includes("@g.us") || remoteJid.includes("@broadcast")) {
    return NextResponse.json({ received: true, skipped: true, reason: "group_or_broadcast" });
  }

  // Auditoria: salva evento bruto.
  let webhookEvent: { id: string } | null = null;
  try {
    webhookEvent = await prisma.webhookEvent.create({
      data: { source: "whatsapp-qr", payload: rawBody.slice(0, 5000), status: "RECEIVED" },
      select: { id: true },
    });
  } catch {}

  // Resolve tenant SOMENTE pela instância cadastrada.
  const tenantId = await resolveTenantByInstance(instanceName);
  if (!tenantId) {
    console.warn(`[whatsapp-qr] Tenant não encontrado para instância "${instanceName}"`);
    if (webhookEvent) {
      await prisma.$executeRaw`UPDATE webhook_events SET status = 'PENDING_TENANT' WHERE id = ${webhookEvent.id}`;
    }
    return NextResponse.json({ received: true, warning: "tenant_not_found" });
  }

  try {
    const phone = normalizePhone(remoteJid);
    const text = extractMessageText(msgData.message);
    const type = deriveMessageType(msgData.message);
    const sentAt = msgData.messageTimestamp
      ? new Date(Number(msgData.messageTimestamp) * 1000)
      : new Date();

    const result = await processInboundMessage(prismaInboxStore, {
      tenantId,
      instanceName,
      phone,
      remoteJid,
      contactName: msgData.pushName,
      text,
      type,
      externalMessageId: msgData.key?.id ?? null,
      sentAt,
    });

    if (webhookEvent) {
      await prisma.$executeRaw`
        UPDATE webhook_events
        SET tenant_id = ${tenantId}, status = 'PROCESSED', processed_at = NOW()
        WHERE id = ${webhookEvent.id}
      `;
    }

    console.log(
      `[whatsapp-qr] ${result.status} | lead=${result.leadId} (criado=${result.leadCreated}) ` +
        `conversa=${result.conversationId} | tenant=${tenantId}`
    );

    return NextResponse.json({ received: true, ...result });
  } catch (err: any) {
    console.error("[whatsapp-qr] Erro ao processar mensagem:", err?.message);
    if (webhookEvent) {
      await prisma.$executeRaw`
        UPDATE webhook_events SET status = 'ERROR', error = ${String(err?.message).slice(0, 300)}
        WHERE id = ${webhookEvent.id}
      `;
    }
    // 200 para evitar reenvio em loop pelo provider.
    return NextResponse.json({ received: true, error: "Processamento falhou — ver logs" }, { status: 200 });
  }
}
