"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, Calendar, UserCheck, TrendingUp, AlertTriangle, Target,
  Clock, Award
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LeadsByChannelChart } from "@/components/dashboard/LeadsByChannelChart";
import { LeadsOverTimeChart } from "@/components/dashboard/LeadsOverTimeChart";
import { FunnelStatusChart } from "@/components/dashboard/FunnelStatusChart";
import { formatDate, formatDateTime, getInitials, avatarColor } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DashboardData {
  totalLeads: number;
  leadsByStage: Array<{ stageId: string; stageName: string; stageColor: string; count: number }>;
  leadsBySource: Array<{ sourceId: string; sourceName: string; sourceColor: string; count: number }>;
  leadsByDay: Array<{ date: string; leads: number; converted: number }>;
  conversions: { scheduled: number; attended: number; closed: number; lost: number; conversionRate: number };
  attendants: Array<{ userId: string; userName: string; count: number; conversions: number }>;
  doctors: Array<{ doctorId: string; doctorName: string; count: number }>;
  recentLeads: Array<{ id: string; name: string; phone: string; sourceName: string; stageName: string; stageColor: string; slaBreached: boolean; createdAt: string }>;
  slaBreached: number;
  avgResponseTime: number | null;
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { startDate, endDate } = getDateRange(period);
      const res = await fetch(`/api/dashboard?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const channelChartData = data?.leadsBySource?.map((s) => ({
    name: s.sourceName,
    value: s.count,
    color: s.sourceColor,
  })) ?? [];

  const funnelChartData = data?.leadsByStage?.map((s) => ({
    name: s.stageName,
    count: s.count,
    color: s.stageColor,
  })) ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral dos seus leads e conversões</p>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              onClick={() => setPeriod(p.days)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                period === p.days
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total de Leads"
          value={loading ? "—" : data?.totalLeads ?? 0}
          icon={Users}
          iconColor="text-primary-600"
          subtitle={`Últimos ${period} dias`}
        />
        <MetricCard
          title="Agendamentos"
          value={loading ? "—" : data?.conversions.scheduled ?? 0}
          icon={Calendar}
          iconColor="text-emerald-600"
        />
        <MetricCard
          title="Comparecimentos"
          value={loading ? "—" : data?.conversions.attended ?? 0}
          icon={UserCheck}
          iconColor="text-violet-600"
        />
        <MetricCard
          title="Fechamentos"
          value={loading ? "—" : data?.conversions.closed ?? 0}
          icon={Award}
          iconColor="text-amber-600"
        />
        <MetricCard
          title="Taxa de Conversão"
          value={loading ? "—" : `${data?.conversions.conversionRate ?? 0}%`}
          icon={TrendingUp}
          iconColor="text-primary-600"
        />
        <MetricCard
          title="Leads Perdidos"
          value={loading ? "—" : data?.conversions.lost ?? 0}
          icon={Target}
          iconColor="text-rose-600"
        />
        <MetricCard
          title="SLA Vencido"
          value={loading ? "—" : data?.slaBreached ?? 0}
          icon={AlertTriangle}
          iconColor="text-rose-600"
          subtitle="Sem atendimento em 4h"
        />
        <MetricCard
          title="Tempo Médio Resposta"
          value={loading ? "—" : data?.avgResponseTime != null ? `${data.avgResponseTime}h` : "—"}
          icon={Clock}
          iconColor="text-cyan-600"
          subtitle="Da entrada ao 1º contato"
        />
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
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
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
                    <p className="text-[10px] text-slate-400">{a.conversions} conversões</p>
                  </div>
                </div>
              ))}
              {(data?.attendants ?? []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum dado disponível</p>
              )}
            </div>
          )}
        </div>

        {/* Recent Leads */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Leads Recentes</h3>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="animate-pulse h-10 bg-slate-100 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(data?.recentLeads ?? []).map((lead) => (
                <a key={lead.id} href={`/leads/${lead.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
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
                </a>
              ))}
              {(data?.recentLeads ?? []).length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Nenhum lead encontrado</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
