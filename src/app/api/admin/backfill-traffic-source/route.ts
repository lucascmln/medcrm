import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveTenantId } from "@/lib/tenant";

/**
 * Maps a LeadSource name to the classified trafficSource value.
 * Used during backfill for leads created before trafficSource was tracked.
 */
function inferTrafficSource(sourceName: string | null | undefined): string {
  if (!sourceName) return "DIRECT";
  const n = sourceName.toLowerCase();
  if (n.includes("meta") || n.includes("facebook")) return "META_ADS";
  if (n.includes("instagram")) return "BIO_LINK";
  if (n.includes("google ads") || n.includes("google_ads")) return "GOOGLE_ADS";
  if (n.includes("google orgânico") || n.includes("google organic") || n.includes("google organico")) return "GOOGLE_ORGANIC";
  if (n.includes("linktree") || n.includes("link na bio") || n.includes("bio")) return "BIO_LINK";
  return "DIRECT";
}

/**
 * POST /api/admin/backfill-traffic-source
 * Fills trafficSource for all leads that have sourceId but no trafficSource.
 * Safe to run multiple times (idempotent).
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ferramenta administrativa perigosa (UPDATE em massa): apenas SUPER_ADMIN.
  if (session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Exige um tenant explícito (impersonação) — nunca roda em TODOS os tenants.
  const tenantId = getEffectiveTenantId(req, session);
  if (!tenantId) {
    return NextResponse.json(
      { error: "Selecione um tenant antes de executar o backfill" },
      { status: 400 }
    );
  }

  // Leads do tenant selecionado com trafficSource nulo.
  const leads = await prisma.lead.findMany({
    where: { tenantId, trafficSource: null },
    select: { id: true, sourceId: true, source: { select: { name: true } } },
  });

  let updated = 0;
  for (const lead of leads) {
    const inferred = inferTrafficSource(lead.source?.name);
    // Escopado por tenant também no UPDATE (defesa em profundidade).
    await prisma.$executeRaw`
      UPDATE leads SET traffic_source = ${inferred}
      WHERE id = ${lead.id} AND "tenantId" = ${tenantId}
    `;
    updated++;
  }

  const skipped = leads.filter((l) => !l.sourceId && !l.source).length;

  // Não retorna ids/nomes de leads — apenas contagens agregadas.
  return NextResponse.json({ message: "Backfill concluído", updated, skipped });
}
