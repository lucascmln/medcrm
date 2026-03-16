/**
 * /api/webhooks/whatsapp
 *
 * Endpoint de webhook para WhatsApp Cloud API (Meta Business).
 *
 * GET  — verificação de callback (Meta envia hub.challenge)
 * POST — recebimento de mensagens, status de entrega e outros eventos
 *
 * Variável necessária: WHATSAPP_VERIFY_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWhatsAppWebhook } from "@/lib/webhook-processors";
import { rateLimit, getIp } from "@/lib/rate-limit";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// GET — Verificação de callback (WhatsApp/Meta Webhook Verification Challenge)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[whatsapp] GET verify →", { mode, tokenProvided: !!token });

  if (!VERIFY_TOKEN) {
    console.error("[whatsapp] WHATSAPP_VERIFY_TOKEN não configurado");
    return new Response(
      JSON.stringify({ error: "Webhook not configured — set WHATSAPP_VERIFY_TOKEN" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[whatsapp] Verificação bem-sucedida — retornando challenge");
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[whatsapp] Verificação falhou — token inválido ou modo incorreto", {
    modeOk: mode === "subscribe",
    tokenMatch: token === VERIFY_TOKEN,
  });
  return new Response(
    JSON.stringify({ error: "Forbidden — invalid verify_token" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Recebimento de eventos do WhatsApp
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Rate limit: 30 requests per minute per IP
  const rl = rateLimit(getIp(req), 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json({ received: false, error: "Too many requests" }, { status: 429 });
  }

  let rawBody: string;
  let body: any;

  // 1. Lê e valida o corpo
  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch {
    console.error("[whatsapp] POST — corpo inválido (não é JSON)");
    return NextResponse.json(
      { received: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  console.log("[whatsapp] POST recebido →", {
    object: body?.object,
    entryCount: body?.entry?.length ?? 0,
  });

  // 2. Valida que é um evento WhatsApp Business Account
  if (body?.object !== "whatsapp_business_account") {
    console.warn("[whatsapp] object inesperado:", body?.object, "— ignorando mas confirmando");
    return NextResponse.json({ received: true, skipped: true, reason: "not a whatsapp_business_account object" });
  }

  // 3. Detecta se há mensagens reais ou apenas status de entrega
  const hasMessages = body?.entry?.some((e: any) =>
    e?.changes?.some((c: any) => c?.field === "messages" && c?.value?.messages?.length > 0)
  );
  const hasStatuses = body?.entry?.some((e: any) =>
    e?.changes?.some((c: any) => c?.field === "messages" && c?.value?.statuses?.length > 0)
  );

  // Status de entrega não precisam ser salvos como evento completo
  if (!hasMessages && hasStatuses) {
    console.log("[whatsapp] Evento de status de entrega — confirmando sem salvar");
    return NextResponse.json({ received: true, type: "delivery_status" }, { status: 200 });
  }

  // 4. Salva o evento bruto no banco
  let event: { id: string } | null = null;
  try {
    event = await prisma.webhookEvent.create({
      data: {
        source:  "whatsapp",
        payload: rawBody,
        status:  "RECEIVED",
      },
      select: { id: true },
    });
    console.log("[whatsapp] Evento salvo:", event.id);
  } catch (err: any) {
    console.error("[whatsapp] Falha ao salvar evento:", err.message);
    // Retorna 200 para evitar reenvio em loop
    return NextResponse.json({ received: true, eventSaved: false }, { status: 200 });
  }

  // 5. Dispara processamento assíncrono
  processWhatsAppWebhook(event.id, body).catch((err) => {
    console.error("[whatsapp] processWhatsAppWebhook falhou:", err.message);
  });

  // 6. Confirma recebimento ao Meta (obrigatório — deve ser < 20s)
  return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
}
