import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { format, subMonths, eachDayOfInterval } from "date-fns";
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

  const startDate = startDateParam ? new Date(startDateParam) : subMonths(new Date(), 1);
  const endDate = endDateParam ? new Date(endDateParam + "T23:59:59") : new Date();

  const where: any = { tenantId, createdAt: { gte: startDate, lte: endDate } };

  // ──────────────────────────────
  // POR ORIGEM
  // ──────────────────────────────
  if (type === "leads-by-channel") {
    const leads = await prisma.lead.findMany({
      where,
      include: { source: true },
    });
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
    const data = Array.from(map.values())
      .map((v) => ({ ...v, conversionRate: v.total > 0 ? Math.round((v.closed / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
    return NextResponse.json({ data });
  }

  // ──────────────────────────────
  // POR STATUS (ETAPA)
  // ──────────────────────────────
  if (type === "leads-by-status") {
    const stages = await prisma.funnelStage.findMany({ where: { tenantId }, orderBy: { order: "asc" } });
    const counts = await prisma.lead.groupBy({
      by: ["funnelStageId"],
      where: { tenantId },
      _count: true,
    });
    const countMap = new Map(counts.map((c) => [c.funnelStageId, c._count]));
    const data = stages.map((s) => ({
      name: s.name,
      color: s.color,
      total: countMap.get(s.id) ?? 0,
    })).filter((s) => s.total > 0);
    return NextResponse.json({ data });
  }

  // ──────────────────────────────
  // AGENDAMENTOS
  // ──────────────────────────────
  if (type === "appointments") {
    const appointments = await prisma.appointment.findMany({
      where: { tenantId, scheduledAt: { gte: startDate, lte: endDate } },
      include: { lead: { select: { name: true } }, user: { select: { name: true } } },
      orderBy: { scheduledAt: "desc" },
    });

    const byStatus = {
      SCHEDULED: appointments.filter((a) => a.status === "SCHEDULED").length,
      COMPLETED: appointments.filter((a) => a.status === "COMPLETED").length,
      CANCELLED: appointments.filter((a) => a.status === "CANCELLED").length,
      NO_SHOW: appointments.filter((a) => a.status === "NO_SHOW").length,
    };

    const data = appointments.map((a) => ({
      name: a.title,
      lead: a.lead?.name ?? "—",
      date: format(new Date(a.scheduledAt), "dd/MM/yyyy HH:mm"),
      status: a.status === "SCHEDULED" ? "Agendado" : a.status === "COMPLETED" ? "Compareceu" : a.status === "CANCELLED" ? "Cancelado" : "Não compareceu",
      duration: `${a.duration}min`,
    }));

    return NextResponse.json({ data, summary: byStatus, total: appointments.length });
  }

  // ──────────────────────────────
  // FOLLOW-UPS
  // ──────────────────────────────
  if (type === "follow-ups") {
    const now = new Date();
    const followUps = await prisma.followUp.findMany({
      where: { tenantId, createdAt: { gte: startDate, lte: endDate } },
      include: {
        lead: { select: { name: true, funnelStage: { select: { name: true } } } },
      },
      orderBy: { dueAt: "asc" },
    });

    const summary = {
      total: followUps.length,
      pending: followUps.filter((f) => f.status === "PENDING").length,
      completed: followUps.filter((f) => f.status === "COMPLETED").length,
      overdue: followUps.filter((f) => f.status === "PENDING" && new Date(f.dueAt) < now).length,
      auto: followUps.filter((f) => f.isAuto).length,
    };

    const data = followUps.map((f) => ({
      name: f.lead.name,
      etapa: f.lead.funnelStage?.name ?? "—",
      dueAt: format(new Date(f.dueAt), "dd/MM/yyyy HH:mm"),
      status: f.status === "PENDING" ? "Pendente" : f.status === "COMPLETED" ? "Concluído" : "Cancelado",
      tipo: f.isAuto ? "Automático" : "Manual",
    }));

    return NextResponse.json({ data, summary });
  }

  // ──────────────────────────────
  // VOLUME POR DIA
  // ──────────────────────────────
  if (type === "volume-by-day") {
    const leads = await prisma.lead.findMany({ where, select: { createdAt: true, closedAt: true, lostAt: true } });

    const days = eachDayOfInterval({ start: startDate, end: endDate });
    const dayMap = new Map<string, { date: string; total: number; closed: number; lost: number }>();
    for (const d of days) {
      const key = format(d, "dd/MM");
      dayMap.set(key, { date: key, total: 0, closed: 0, lost: 0 });
    }
    for (const l of leads) {
      const key = format(new Date(l.createdAt), "dd/MM");
      const d = dayMap.get(key);
      if (d) { d.total++; if (l.closedAt) d.closed++; if (l.lostAt) d.lost++; }
    }

    const data = Array.from(dayMap.values());
    return NextResponse.json({ data });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
