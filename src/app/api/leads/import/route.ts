import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const tenantId = getEffectiveTenantId(req, session);
    if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

    const body = await req.json();
    const rows: any[] = body.rows ?? [];

    // Get default funnel stage
    const defaultStage = await prisma.funnelStage.findFirst({
      where: { tenantId, isDefault: true },
      orderBy: { order: "asc" },
    });
    const fallbackStage = defaultStage ?? await prisma.funnelStage.findFirst({
      where: { tenantId },
      orderBy: { order: "asc" },
    });

    if (!fallbackStage) {
      return NextResponse.json({ error: "No funnel stages found" }, { status: 400 });
    }

    let created = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        if (!row.name || !row.phone) {
          errors.push(`Linha inválida: nome e telefone são obrigatórios`);
          continue;
        }

        const lead = await prisma.lead.create({
          data: {
            tenantId,
            name:          row.name,
            phone:         row.phone,
            email:         row.email         || null,
            observations:  row.observations  || null,
            sourceId:      row.sourceId      || null,
            funnelStageId: row.funnelStageId || fallbackStage.id,
          },
        });

        await prisma.leadHistory.create({
          data: {
            leadId:      lead.id,
            userId:      session.user.id,
            action:      "IMPORTED",
            description: "Lead importado via CSV",
          },
        });

        created++;
      } catch (err) {
        errors.push(`Erro ao importar "${row.name}": ${err}`);
      }
    }

    return NextResponse.json({ created, errors, total: rows.length });
  } catch (error) {
    console.error("POST /api/leads/import error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
