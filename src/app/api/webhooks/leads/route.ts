import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { mergeTracking, type TrackingData } from "@/lib/tracking";

/**
 * Writes tracking fields via raw SQL so it works regardless of whether the
 * Prisma client was regenerated after the schema migration.
 */
async function applyTracking(leadId: string, t: TrackingData) {
  await prisma.$executeRaw`
    UPDATE leads SET
      utm_source     = ${t.utmSource},
      utm_medium     = ${t.utmMedium},
      utm_campaign   = ${t.utmCampaign},
      utm_content    = ${t.utmContent},
      utm_term       = ${t.utmTerm},
      landing_page   = ${t.landingPage},
      referrer       = ${t.referrer},
      gclid          = ${t.gclid},
      fbclid         = ${t.fbclid},
      fbc            = ${t.fbc},
      fbp            = ${t.fbp},
      raw_url_params = ${t.rawUrlParams},
      traffic_source = ${t.trafficSource}
    WHERE id = ${leadId}
  `;
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing X-API-Key header" }, { status: 401 });
  }

  const keyRecord = await prisma.apiKey.findUnique({ where: { key: apiKey, isActive: true } });
  if (!keyRecord) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
  }

  await prisma.apiKey.update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } });

  const tenantId = keyRecord.tenantId;

  try {
    const body = await req.json();
    const { name, phone, email, sourceId, subsourceId, campaignId, observations } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
    }

    // Get default funnel stage
    const defaultStage =
      (await prisma.funnelStage.findFirst({
        where: { tenantId, isDefault: true },
        orderBy: { order: "asc" },
      })) ??
      (await prisma.funnelStage.findFirst({
        where: { tenantId },
        orderBy: { order: "asc" },
      }));

    if (!defaultStage) {
      return NextResponse.json({ error: "No funnel stages configured" }, { status: 400 });
    }

    // Extract tracking from body — webhook senders can pass UTM fields + landing_page + referrer
    const tracking = mergeTracking(body.landing_page ?? body.landingPage ?? null, body, body.referrer);

    // Step 1 — create lead with stable Prisma fields only
    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name,
        phone,
        email:        email        || null,
        sourceId:     sourceId     || null,
        subsourceId:  subsourceId  || null,
        campaignId:   campaignId   || null,
        observations: observations || null,
        funnelStageId: defaultStage.id,
      },
    });

    // Step 2 — write tracking via raw SQL (schema-agnostic, never blocks lead creation)
    await applyTracking(lead.id, tracking).catch((err) => {
      console.warn("[webhook leads] tracking update skipped:", err.message);
    });

    // Step 3 — history
    await prisma.leadHistory.create({
      data: {
        leadId:      lead.id,
        action:      "WEBHOOK_CREATED",
        description: `Lead recebido via webhook (chave: ${keyRecord.name})${tracking.trafficSource ? ` | origem: ${tracking.trafficSource}` : ""}`,
      },
    });

    return NextResponse.json(
      { id: lead.id, message: "Lead created successfully", trafficSource: tracking.trafficSource },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("[webhook leads] error:", error?.message ?? error);
    if (error?.code) console.error("[webhook leads] code:", error.code, "meta:", JSON.stringify(error?.meta));
    return NextResponse.json(
      { error: "Internal server error", detail: error?.message ?? "unknown" },
      { status: 500 }
    );
  }
}
