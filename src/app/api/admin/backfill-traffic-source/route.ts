import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Load all leads with null trafficSource that have a sourceId
  const leads = await prisma.lead.findMany({
    where: { trafficSource: null },
    select: { id: true, sourceId: true, source: { select: { name: true } } },
  });

  let updated = 0;
  let skipped = 0;

  for (const lead of leads) {
    const inferred = inferTrafficSource(lead.source?.name);
    await prisma.$executeRaw`
      UPDATE leads SET traffic_source = ${inferred} WHERE id = ${lead.id}
    `;
    updated++;
  }

  // Count leads that still have no source at all (can't infer)
  skipped = leads.filter((l) => !l.sourceId && !l.source).length;

  return NextResponse.json({
    message: `Backfill concluído`,
    updated,
    skipped,
    details: leads.map((l) => ({
      id: l.id,
      source: l.source?.name ?? null,
      inferredTrafficSource: inferTrafficSource(l.source?.name),
    })),
  });
}
