import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  differenceInHours,
  format,
  eachDayOfInterval,
  subDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { getEffectiveTenantId } from "@/lib/tenant";

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = getEffectiveTenantId(req, session);
  console.log("[dashboard] tenantId resolved:", tenantId, "| role:", session.user.role);
  if (!tenantId) {
    return NextResponse.json({ error: "No tenant" }, { status: 403 });
  }

  // ── Date range ────────────────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam   = searchParams.get("endDate");
  const now            = new Date();
  const startDate      = startDateParam ? new Date(startDateParam) : subDays(now, 29);
  const endDate        = endDateParam ? new Date(endDateParam + "T23:59:59") : now;

  // Safety: swap if inverted (prevents eachDayOfInterval from throwing)
  const safeStart = startDate <= endDate ? startDate : endDate;
  const safeEnd   = startDate <= endDate ? endDate   : startDate;

  const periodWhere: any = { tenantId, createdAt: { gte: safeStart, lte: safeEnd } };

  // ── Queries ───────────────────────────────────────────────────────────────
  let leads: any[], stages: any[], sources: any[];
  let pendingFollowUps: number, upcomingAppointments: number;
  let todayLeads: number, weekLeads: number, monthLeads: number;

  try {
    [leads, stages, sources, pendingFollowUps, upcomingAppointments, todayLeads, weekLeads, monthLeads] =
      await Promise.all([
        prisma.lead.findMany({
          where: periodWhere,
          include: {
            funnelStage: true,
            source: true,
            assignedTo: { select: { id: true, name: true } },
            doctor:     { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.funnelStage.findMany({ where: { tenantId }, orderBy: { order: "asc" } }),
        prisma.leadSource.findMany({ where: { tenantId } }),
        prisma.followUp.count({ where: { tenantId, status: "PENDING" } }),
        prisma.appointment.count({
          where: { tenantId, status: "SCHEDULED", scheduledAt: { gte: startOfDay(now) } },
        }),
        // Fixed calendar ranges — independent of the selected period filter
        prisma.lead.count({ where: { tenantId, createdAt: { gte: startOfDay(now),          lte: endOfDay(now) } } }),
        prisma.lead.count({ where: { tenantId, createdAt: { gte: startOfWeek(now, { weekStartsOn: 1 }), lte: endOfWeek(now, { weekStartsOn: 1 }) } } }),
        prisma.lead.count({ where: { tenantId, createdAt: { gte: startOfMonth(now),         lte: endOfMonth(now) } } }),
      ]);
  } catch (err) {
    console.error("[dashboard] Prisma query error for tenantId", tenantId, ":", err);
    return NextResponse.json({ error: "Database query failed" }, { status: 500 });
  }

  console.log("[dashboard] query ok — leads:", leads.length, "stages:", stages.length, "today:", todayLeads, "week:", weekLeads, "month:", monthLeads);

  // ── Build response ────────────────────────────────────────────────────────
  try {
    // Leads by stage
    const stageMap = new Map<string, { stageId: string; stageName: string; stageColor: string; count: number }>();
    for (const s of stages) {
      stageMap.set(s.id, { stageId: s.id, stageName: s.name, stageColor: s.color, count: 0 });
    }
    for (const l of leads) {
      const s = stageMap.get(l.funnelStageId);
      if (s) s.count++;
    }
    const leadsByStage = Array.from(stageMap.values());

    // Leads by source
    const sourceMap = new Map<string, { sourceId: string; sourceName: string; sourceColor: string; count: number }>();
    for (const s of sources) {
      sourceMap.set(s.id, { sourceId: s.id, sourceName: s.name, sourceColor: s.color ?? "#64748b", count: 0 });
    }
    sourceMap.set("unknown", { sourceId: "unknown", sourceName: "Sem canal", sourceColor: "#94a3b8", count: 0 });
    for (const l of leads) {
      const key = l.sourceId ?? "unknown";
      const s = sourceMap.get(key);
      if (s) s.count++;
    }
    const leadsBySource = Array.from(sourceMap.values()).filter((s) => s.count > 0);

    // Leads by day
    const days = eachDayOfInterval({ start: safeStart, end: safeEnd });
    const dayMap = new Map<string, { date: string; leads: number; converted: number }>();
    for (const d of days) {
      const key = format(d, "dd/MM");
      dayMap.set(key, { date: key, leads: 0, converted: 0 });
    }
    for (const l of leads) {
      const key = format(new Date(l.createdAt), "dd/MM");
      const d = dayMap.get(key);
      if (d) { d.leads++; if (l.closedAt) d.converted++; }
    }
    const leadsByDay = Array.from(dayMap.values());

    // Conversion metrics
    const scheduled      = leads.filter((l) => l.scheduledAt).length;
    const attended       = leads.filter((l) => l.attendedAt).length;
    const closed         = leads.filter((l) => l.closedAt).length;
    const lost           = leads.filter((l) => l.lostAt).length;
    const total          = leads.length;
    const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

    // Attendants ranking
    const attendantMap = new Map<string, { userId: string; userName: string; count: number; conversions: number }>();
    for (const l of leads) {
      if (!l.assignedToId) continue;
      if (!attendantMap.has(l.assignedToId)) {
        attendantMap.set(l.assignedToId, { userId: l.assignedToId, userName: l.assignedTo?.name ?? "—", count: 0, conversions: 0 });
      }
      const a = attendantMap.get(l.assignedToId)!;
      a.count++;
      if (l.closedAt) a.conversions++;
    }
    const attendants = Array.from(attendantMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);

    // Doctors ranking
    const doctorMap = new Map<string, { doctorId: string; doctorName: string; count: number }>();
    for (const l of leads) {
      if (!l.doctorId) continue;
      if (!doctorMap.has(l.doctorId)) {
        doctorMap.set(l.doctorId, { doctorId: l.doctorId, doctorName: l.doctor?.name ?? "—", count: 0 });
      }
      doctorMap.get(l.doctorId)!.count++;
    }
    const doctors = Array.from(doctorMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);

    // SLA
    const slaBreached = leads.filter(
      (l) => l.slaBreached || (!l.firstContactAt && differenceInHours(now, new Date(l.createdAt)) >= 4)
    ).length;

    // Avg response time
    const withContact   = leads.filter((l) => l.firstContactAt);
    const avgResponseTime =
      withContact.length > 0
        ? Math.round(
            withContact.reduce(
              (acc, l) => acc + differenceInHours(new Date(l.firstContactAt!), new Date(l.createdAt)),
              0
            ) / withContact.length
          )
        : null;

    // Leads by traffic source
    const trafficSourceOrder = ["META_ADS", "GOOGLE_ADS", "BIO_LINK", "GOOGLE_ORGANIC", "DIRECT"];
    const trafficSourceLabels: Record<string, string> = {
      META_ADS: "Meta Ads", GOOGLE_ADS: "Google Ads", BIO_LINK: "Link na Bio",
      GOOGLE_ORGANIC: "Google Orgânico", DIRECT: "Direto",
    };
    const trafficSourceColors: Record<string, string> = {
      META_ADS: "#1877F2", GOOGLE_ADS: "#EA4335", BIO_LINK: "#8B5CF6",
      GOOGLE_ORGANIC: "#10B981", DIRECT: "#94A3B8",
    };
    const tsMap = new Map<string, number>();
    for (const l of leads) {
      const key = (l as any).trafficSource ?? "DIRECT";
      tsMap.set(key, (tsMap.get(key) ?? 0) + 1);
    }
    const leadsByTrafficSource = trafficSourceOrder
      .filter((k) => tsMap.has(k))
      .map((k) => ({ source: k, name: trafficSourceLabels[k], value: tsMap.get(k)!, color: trafficSourceColors[k] }));

    // Recent leads — guard against null funnelStage (SQLite may not enforce FK)
    const recentLeads = leads.slice(0, 8).map((l) => ({
      id:          l.id,
      name:        l.name,
      phone:       l.phone,
      sourceName:  l.source?.name ?? "—",
      stageName:   l.funnelStage?.name  ?? "—",
      stageColor:  l.funnelStage?.color ?? "#64748b",
      slaBreached: l.slaBreached,
      createdAt:   l.createdAt,
    }));

    return NextResponse.json({
      totalLeads: total,
      todayLeads,
      weekLeads,
      monthLeads,
      leadsByStage,
      leadsBySource,
      leadsByTrafficSource,
      leadsByDay,
      conversions: { scheduled, attended, closed, lost, conversionRate },
      attendants,
      doctors,
      recentLeads,
      slaBreached,
      avgResponseTime,
      pendingFollowUps,
      upcomingAppointments,
    });
  } catch (err) {
    console.error("[dashboard] response-build error for tenantId", tenantId, ":", err);
    return NextResponse.json({ error: "Data processing failed" }, { status: 500 });
  }
}
