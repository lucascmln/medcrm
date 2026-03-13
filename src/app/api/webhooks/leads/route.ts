import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return NextResponse.json({ error: "Missing X-API-Key header" }, { status: 401 });
  }

  const keyRecord = await prisma.apiKey.findUnique({ where: { key: apiKey, isActive: true } });
  if (!keyRecord) {
    return NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 });
  }

  // Update lastUsedAt
  await prisma.apiKey.update({ where: { id: keyRecord.id }, data: { lastUsedAt: new Date() } });

  const tenantId = keyRecord.tenantId;

  try {
    const body = await req.json();
    const { name, phone, email, sourceId, subsourceId, campaignId, observations } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "name and phone are required" }, { status: 400 });
    }

    // Get default funnel stage
    const defaultStage = await prisma.funnelStage.findFirst({
      where: { tenantId, isDefault: true },
      orderBy: { order: "asc" },
    }) ?? await prisma.funnelStage.findFirst({
      where: { tenantId },
      orderBy: { order: "asc" },
    });

    if (!defaultStage) {
      return NextResponse.json({ error: "No funnel stages configured" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId,
        name,
        phone,
        email: email || null,
        sourceId: sourceId || null,
        subsourceId: subsourceId || null,
        campaignId: campaignId || null,
        observations: observations || null,
        funnelStageId: defaultStage.id,
      },
    });

    await prisma.leadHistory.create({
      data: {
        leadId: lead.id,
        action: "WEBHOOK_CREATED",
        description: `Lead recebido via webhook (chave: ${keyRecord.name})`,
      },
    });

    return NextResponse.json({ id: lead.id, message: "Lead created successfully" }, { status: 201 });
  } catch (error) {
    console.error("POST /api/webhooks/leads error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
