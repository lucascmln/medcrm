/**
 * /api/webhooks/meta-leads
 *
 * Endpoint de webhook para Meta Lead Ads.
 *
 * GET  — verificação de callback (Meta envia hub.challenge)
 * POST — recebimento de notificações de leadgen
 *
 * Variável necessária: META_VERIFY_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processMetaLeadWebhook } from "@/lib/webhook-processors";
import { rateLimit, getIp } from "@/lib/rate-limit";

const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN ?? "";

// ─────────────────────────────────────────────────────────────────────────────
// GET — Verificação de callback (Meta Webhook Verification Challenge)
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get("hub.mode");
  const token     = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  console.log("[meta-leads] GET verify →", { mode, tokenProvided: !!token });

  if (!VERIFY_TOKEN) {
    console.error("[meta-leads] META_VERIFY_TOKEN não configurado");
    return new Response(
      JSON.stringify({ error: "Webhook not configured — set META_VERIFY_TOKEN" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("[meta-leads] Verificação bem-sucedida — retornando challenge");
    // Meta espera o challenge como plain text, não JSON
    return new Response(challenge ?? "", { status: 200 });
  }

  console.warn("[meta-leads] Verificação falhou — token inválido ou modo incorreto", {
    modeOk: mode === "subscribe",
    tokenMatch: token === VERIFY_TOKEN,
  });
  return new Response(
    JSON.stringify({ error: "Forbidden — invalid verify_token" }),
    { status: 403, headers: { "Content-Type": "application/json" } }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// POST — Recebimento de notificações do Meta
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
    console.error("[meta-leads] POST — corpo inválido (não é JSON)");
    return NextResponse.json(
      { received: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  console.log("[meta-leads] POST recebido →", {
    object: body?.object,
    entryCount: body?.entry?.length ?? 0,
  });

  // 2. Valida que é um evento de página (Meta Lead Ads envia object="page")
  if (body?.object !== "page") {
    console.warn("[meta-leads] object inesperado:", body?.object, "— ignorando mas confirmando");
    // Sempre retorna 200 para evitar que o Meta marque o endpoint como inativo
    return NextResponse.json({ received: true, skipped: true, reason: "not a page object" });
  }

  // 3. Salva o evento bruto no banco (sempre, mesmo que o processamento falhe depois)
  let event: { id: string } | null = null;
  try {
    event = await prisma.webhookEvent.create({
      data: {
        source:  "meta-leads",
        payload: rawBody,
        status:  "RECEIVED",
      },
      select: { id: true },
    });
    console.log("[meta-leads] Evento salvo:", event.id);
  } catch (err: any) {
    // Falha ao salvar não pode bloquear o 200 para o Meta
    console.error("[meta-leads] Falha ao salvar evento:", err.message);
    return NextResponse.json({ received: true, eventSaved: false }, { status: 200 });
  }

  // 4. Dispara processamento assíncrono — não aguarda para responder rápido
  //    Meta exige resposta em < 20s, o processamento pode demorar mais
  processMetaLeadWebhook(event.id, body).catch((err) => {
    console.error("[meta-leads] processMetaLeadWebhook falhou:", err.message);
  });

  // 5. Confirma recebimento ao Meta (obrigatório)
  return NextResponse.json({ received: true, eventId: event.id }, { status: 200 });
}
