import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { differenceInHours } from "date-fns";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenantId = session.user.tenantId;
  if (!tenantId) return NextResponse.json({ error: "No tenant" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "leads-by-channel";
  const startDateParam = searchParams.get("startDate");
  const endDateParam = searchParams.get("endDate");
  const unitId = searchParams.get("unitId") || undefined;

  const startDate = startDateParam ? new Date(startDateParam) : subMonths(new Date(), 1);
  const endDate = endDateParam ? new Date(endDateParam + "T23:59:59") : new Date();

  const where: any = {
    tenantId,
    createdAt: { gte: startDate, lte: endDate },
  };
  if (unitId) where.unitId = unitId;

  const leads = await prisma.lead.findMany({
    where,
    include: {
      source: true,
      campaign: true,
      assignedTo: { select: { id: true, name: true } },
      doctor: { select: { id: true, name: true } },
      lossReason: { select: { id: true, name: true } },
      funnelStage: true,
    },
  });

  if (type === "leads-by-channel") {
    const map = new Map<string, { name: string; color: string; total: number; closed: number; lost: number }>();
    for (const l of leads) {
      const key = l.sourceId ?? "unknown";
      const name = l.source?.name ?? "Sem canal";
      const color = l.source?.color ?? "#94a3b8";
      if (!map.has(key)) map.set(key, { name, color, total: 0, closed: 0, lost: 0 });
      const v = map.get(key)!;
      v.total++;
      if (l.closedAt) v.closed++;
      if (l.lostAt) v.lost++;
    }
    const data = Array.from(map.values()).map((v) => ({
      ...v,
      conversionRate: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
    return NextResponse.json({ data });
  }

  if (type === "leads-by-campaign") {
    const map = new Map<string, { name: string; total: number; closed: number }>();
    for (const l of leads) {
      const key = l.campaignId ?? "none";
      const name = l.campaign?.name ?? "Sem campanha";
      if (!map.has(key)) map.set(key, { name, total: 0, closed: 0 });
      const v = map.get(key)!;
      v.total++;
      if (l.closedAt) v.closed++;
    }
    const data = Array.from(map.values()).map((v) => ({
      ...v,
      conversionRate: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
    return NextResponse.json({ data });
  }

  if (type === "leads-by-attendant") {
    const map = new Map<string, { name: string; total: number; closed: number; avgResponse: number; responseCount: number }>();
    for (const l of leads) {
      const key = l.assignedToId ?? "unassigned";
      const name = l.assignedTo?.name ?? "Não atribuído";
      if (!map.has(key)) map.set(key, { name, total: 0, closed: 0, avgResponse: 0, responseCount: 0 });
      const v = map.get(key)!;
      v.total++;
      if (l.closedAt) v.closed++;
      if (l.firstContactAt) {
        v.avgResponse += differenceInHours(new Date(l.firstContactAt), new Date(l.createdAt));
        v.responseCount++;
      }
    }
    const data = Array.from(map.values()).map((v) => ({
      name: v.name,
      total: v.total,
      closed: v.closed,
      conversionRate: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0,
      avgResponseHours: v.responseCount > 0 ? Math.round(v.avgResponse / v.responseCount) : null,
    })).sort((a, b) => b.total - a.total);
    return NextResponse.json({ data });
  }

  if (type === "conversion-by-channel") {
    const map = new Map<string, { name: string; color: string; total: number; scheduled: number; attended: number; closed: number; lost: number }>();
    for (const l of leads) {
      const key = l.sourceId ?? "unknown";
      const name = l.source?.name ?? "Sem canal";
      const color = l.source?.color ?? "#94a3b8";
      if (!map.has(key)) map.set(key, { name, color, total: 0, scheduled: 0, attended: 0, closed: 0, lost: 0 });
      const v = map.get(key)!;
      v.total++;
      if (l.scheduledAt) v.scheduled++;
      if (l.attendedAt) v.attended++;
      if (l.closedAt) v.closed++;
      if (l.lostAt) v.lost++;
    }
    const data = Array.from(map.values()).map((v) => ({
      ...v,
      scheduledPct: v.total > 0 ? Math.round((v.scheduled / v.total) * 100) : 0,
      attendedPct: v.total > 0 ? Math.round((v.attended / v.total) * 100) : 0,
      closedPct: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0,
      lostPct: v.total > 0 ? Math.round((v.lost / v.total) * 100) : 0,
    })).sort((a, b) => b.total - a.total);
    return NextResponse.json({ data });
  }

  if (type === "loss-reasons") {
    const map = new Map<string, { name: string; count: number }>();
    const total = leads.filter((l) => l.lostAt).length;
    for (const l of leads) {
      if (!l.lostAt) continue;
      const key = l.lossReasonId ?? "unknown";
      const name = l.lossReason?.name ?? "Não informado";
      if (!map.has(key)) map.set(key, { name, count: 0 });
      map.get(key)!.count++;
    }
    const data = Array.from(map.values()).map((v) => ({
      ...v,
      percentage: total > 0 ? Math.round((v.count / total) * 100) : 0,
    })).sort((a, b) => b.count - a.count);
    return NextResponse.json({ data, total });
  }

  if (type === "monthly-comparison") {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const start = startOfMonth(date);
      const end = endOfMonth(date);
      const monthLeads = await prisma.lead.findMany({
        where: { tenantId, createdAt: { gte: start, lte: end } },
        select: { closedAt: true, lostAt: true, scheduledAt: true },
      });
      months.push({
        month: format(date, "MMM/yy"),
        total: monthLeads.length,
        closed: monthLeads.filter((l) => l.closedAt).length,
        lost: monthLeads.filter((l) => l.lostAt).length,
        scheduled: monthLeads.filter((l) => l.scheduledAt).length,
      });
    }
    return NextResponse.json({ data: months });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
