"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Calendar, UserCheck, TrendingUp, AlertTriangle, Target,
  Clock, Award, Bell, CalendarDays, ChevronRight,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LeadsByChannelChart } from "@/components/dashboard/LeadsByChannelChart";
import { LeadsOverTimeChart } from "@/components/dashboard/LeadsOverTimeChart";
import { FunnelStatusChart } from "@/components/dashboard/FunnelStatusChart";
import { formatDate, getInitials, avatarColor } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import Link from "next/link";

interface DashboardData {
  totalLeads: number;
  todayLeads: number;
  weekLeads: number;
  monthLeads: number;
  leadsByStage: Array<{ stageId: string; stageName: string; stageColor: string; count: number }>;
  leadsBySource: Array<{ sourceId: string; sourceName: string; sourceColor: string; count: number }>;
  leadsByDay: Array<{ date: string; leads: number; converted: number }>;
  conversions: { scheduled: number; attended: number; closed: number; lost: number; conversionRate: number };
  attendants: Array<{ userId: string; userName: string; count: number; conversions: number }>;
  doctors: Array<{ doctorId: string; doctorName: string; count: number }>;
  recentLeads: Array<{ id: string; name: string; phone: string; sourceName: string; stageName: string; stageColor: string; slaBreached: boolean; createdAt: string }>;
  slaBreached: number;
  avgResponseTime: number | null;
  pendingFollowUps: number;
  upcomingAppointments: number;
}

const PERIODS = [
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let startDate: string, endDate: string;
      if (useCustom && customStart && customEnd) {
        startDate = customStart;
        endDate = customEnd;
      } else {
        ({ startDate, endDate } = getDateRange(period));
      }
      const res = await fetch(`/api/dashboard?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) return;
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [period, useCustom, customStart, customEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const channelChartData = data?.leadsBySource?.map((s) => ({ name: s.sourceName, value: s.count, color: s.sourceColor })) ?? [];
  const funnelChartData = data?.leadsByStage?.map((s) => ({ name: s.stageName, count: s.count, color: s.stageColor })) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral dos seus leads e conversões</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!useCustom && (
            <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
              {PERIODS.map((p) => (
                <button key={p.days} onClick={() => setPeriod(p.days)}
                  className={cn("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                    period === p.days ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => { setUseCustom(!useCustom); }}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium border transition-all",
              useCustom ? "border-primary-500 text-primary-700 bg-primary-50" : "border-slate-200 text-slate-500 hover:text-slate-700")}>
            Período personalizado
          </button>
          {useCustom && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              <span className="text-slate-400 text-sm">até</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
          )}
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{loading ? "—" : data?.todayLeads ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Hoje</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{loading ? "—" : data?.weekLeads ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Esta semana</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-slate-900">{loading ? "—" : data?.monthLeads ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">Este mês</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-primary-600">{loading ? "—" : data?.totalLeads ?? 0}</p>
          <p className="text-xs text-slate-500 mt-0.5">No período</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Agendamentos" value={loading ? "—" : data?.conversions.scheduled ?? 0} icon={Calendar} iconColor="text-emerald-600" />
        <MetricCard title="Comparecimentos" value={loading ? "—" : data?.conversions.attended ?? 0} icon={UserCheck} iconColor="text-violet-600" />
        <MetricCard title="Fechamentos" value={loading ? "—" : data?.conversions.closed ?? 0} icon={Award} iconColor="text-amber-600" />
        <MetricCard title="Taxa de Conversão" value={loading ? "—" : `${data?.conversions.conversionRate ?? 0}%`} icon={TrendingUp} iconColor="text-primary-600" />
        <MetricCard title="Leads Perdidos" value={loading ? "—" : data?.conversions.lost ?? 0} icon={Target} iconColor="text-rose-600" />
        <MetricCard title="SLA Vencido" value={loading ? "—" : data?.slaBreached ?? 0} icon={AlertTriangle} iconColor="text-rose-600" subtitle="Sem atendimento em 4h" />
        <Link href="/follow-up" className="block">
          <MetricCard title="Follow-ups Pendentes" value={loading ? "—" : data?.pendingFollowUps ?? 0} icon={Bell} iconColor="text-orange-500" subtitle="Clique para ver" />
        </Link>
        <Link href="/agenda" className="block">
          <MetricCard title="Próx. Agendamentos" value={loading ? "—" : data?.upcomingAppointments ?? 0} icon={CalendarDays} iconColor="text-cyan-600" subtitle="A partir de hoje" />
        </Link>
      </div>

      {/* Leads Over Time */}
      {loading ? (
        <div className="card p-5 animate-pulse h-64 bg-slate-50" />
      ) : (
        <LeadsOverTimeChart data={data?.leadsByDay ?? []} />
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <>
            <div className="card p-5 animate-pulse h-80 bg-slate-50" />
            <div className="card p-5 animate-pulse h-80 bg-slate-50" />
          </>
        ) : (
          <>
            <LeadsByChannelChart data={channelChartData} />
            <FunnelStatusChart data={funnelChartData} />
          </>
        )}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Attendants */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Ranking de Atendentes</h3>
          {loading ? (
            <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="animate-pulse h-10 bg-slate-100 rounded-lg" />)}</div>
          ) : (
            <div className="space-y-2">
              {(data?.attendants ?? []).map((a, i) => (
                <div key={a.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <span className="text-xs font-bold text-slate-400 w-5">#{i + 1}</span>
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColor(a.userName))}>
                    {getInitials(a.userName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{a.userName}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900">{a.count}</p>
                    <p className="text-[10px] text-slate-400">{a.conversions} conv.</p>
                  </div>
                </div>
              ))}
              {(data?.attendants ?? []).length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum dado disponível</p>}
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-900">Leads Recentes</h3>
            <Link href="/leads" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-0.5">
              Ver todos <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[1,2,3,4,5].map((i) => <div key={i} className="animate-pulse h-10 bg-slate-100 rounded-lg" />)}</div>
          ) : (
            <div className="space-y-2">
              {(data?.recentLeads ?? []).map((lead) => (
                <Link key={lead.id} href={`/leads/${lead.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0", avatarColor(lead.name))}>
                    {getInitials(lead.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium text-slate-900 truncate">{lead.name}</p>
                      {lead.slaBreached && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" title="SLA vencido" />}
                    </div>
                    <p className="text-[11px] text-slate-400">{lead.sourceName} · {formatDate(lead.createdAt)}</p>
                  </div>
                  <StatusBadge stage={{ name: lead.stageName, color: lead.stageColor }} />
                </Link>
              ))}
              {(data?.recentLeads ?? []).length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhum lead encontrado</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
