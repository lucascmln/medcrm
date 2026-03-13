import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { differenceInHours, format, eachDayOfInterval, parseISO, subDays } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const unitId = searchParams.get("unitId") || undefined;
  const doctorId = searchParams.get("doctorId") || undefined;
  const sourceId = searchParams.get("sourceId") || undefined;
  const assignedToId = searchParams.get("assignedToId") || undefined;

  const startDate = startDateParam ? new Date(startDateParam) : subDays(new Date(), 29);
  const endDate = endDateParam ? new Date(endDateParam + "T23:59:59") : new Date();

  const where: any = {
    tenantId,
    createdAt: { gte: startDate, lte: endDate },
  };
  if (unitId) where.unitId = unitId;
  if (doctorId) where.doctorId = doctorId;
  if (sourceId) where.sourceId = sourceId;
  if (assignedToId) where.assignedToId = assignedToId;

  const [
    leads,
    stages,
    sources,
  ] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: {
        funnelStage: true,
        source: true,
        assignedTo: { select: { id: true, name: true } },
        doctor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.funnelStage.findMany({ where: { tenantId }, orderBy: { order: "asc" } }),
    prisma.leadSource.findMany({ where: { tenantId } }),
  ]);

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
  const days = eachDayOfInterval({ start: startDate, end: endDate });
  const dayMap = new Map<string, { date: string; leads: number; converted: number }>();
  for (const d of days) {
    const key = format(d, "dd/MM");
    dayMap.set(key, { date: key, leads: 0, converted: 0 });
  }
  for (const l of leads) {
    const key = format(new Date(l.createdAt), "dd/MM");
    const d = dayMap.get(key);
    if (d) {
      d.leads++;
      if (l.closedAt) d.converted++;
    }
  }
  const leadsByDay = Array.from(dayMap.values());

  // Conversion metrics
  const scheduled = leads.filter((l) => l.scheduledAt).length;
  const attended = leads.filter((l) => l.attendedAt).length;
  const closed = leads.filter((l) => l.closedAt).length;
  const lost = leads.filter((l) => l.lostAt).length;
  const total = leads.length;
  const conversionRate = total > 0 ? Math.round((closed / total) * 100) : 0;

  // Attendants ranking
  const attendantMap = new Map<string, { userId: string; userName: string; count: number; conversions: number }>();
  for (const l of leads) {
    if (!l.assignedToId) continue;
    const key = l.assignedToId;
    if (!attendantMap.has(key)) {
      attendantMap.set(key, { userId: key, userName: l.assignedTo?.name ?? "—", count: 0, conversions: 0 });
    }
    const a = attendantMap.get(key)!;
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

  // SLA breached
  const slaBreached = leads.filter((l) => l.slaBreached || (!l.firstContactAt && differenceInHours(new Date(), new Date(l.createdAt)) >= 4)).length;

  // Avg response time
  const withContact = leads.filter((l) => l.firstContactAt);
  const avgResponseTime = withContact.length > 0
    ? Math.round(withContact.reduce((acc, l) => acc + differenceInHours(new Date(l.firstContactAt!), new Date(l.createdAt)), 0) / withContact.length)
    : null;

  // Recent leads
  const recentLeads = leads.slice(0, 5).map((l) => ({
    id: l.id,
    name: l.name,
    phone: l.phone,
    sourceName: l.source?.name ?? "—",
    stageName: l.funnelStage.name,
    stageColor: l.funnelStage.color,
    slaBreached: l.slaBreached,
    createdAt: l.createdAt,
  }));

  return NextResponse.json({
    totalLeads: total,
    leadsByStage,
    leadsBySource,
    leadsByDay,
    conversions: { scheduled, attended, closed, lost, conversionRate },
    attendants,
    doctors,
    recentLeads,
    slaBreached,
    avgResponseTime,
  });
}
