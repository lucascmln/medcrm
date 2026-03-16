"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Calendar, UserCheck, TrendingUp, AlertTriangle, Target,
  Award, Bell, CalendarDays, ChevronRight, Phone,
} from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { LeadsOverTimeChart } from "@/components/dashboard/LeadsOverTimeChart";
import { LeadsByChannelChart } from "@/components/dashboard/LeadsByChannelChart";
import { FunnelStatusChart } from "@/components/dashboard/FunnelStatusChart";
import { formatDate, getInitials, avatarColor } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { format } from "date-fns";

interface DashboardData {
  totalLeads: number; todayLeads: number; weekLeads: number; monthLeads: number;
  leadsByStage: Array<{ stageId: string; stageName: string; stageColor: string; count: number }>;
  leadsBySource: Array<{ sourceId: string; sourceName: string; sourceColor: string; count: number }>;
  leadsByTrafficSource: Array<{ source: string; name: string; value: number; color: string }>;
  leadsByDay: Array<{ date: string; leads: number; converted: number }>;
  conversions: { scheduled: number; attended: number; closed: number; lost: number; conversionRate: number };
  attendants: Array<{ userId: string; userName: string; count: number; conversions: number }>;
  recentLeads: Array<{ id: string; name: string; phone: string; sourceName: string; stageName: string; stageColor: string; slaBreached: boolean; createdAt: string }>;
  slaBreached: number; avgResponseTime: number | null;
  pendingFollowUps: number; upcomingAppointments: number;
}

const PERIODS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
];

function getDateRange(days: number) {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { startDate: start.toISOString().split("T")[0], endDate: end.toISOString().split("T")[0] };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [period, setPeriod] = useState(30);
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  // Date-specific leads panel
  const [selectedDate, setSelectedDate] = useState("");
  const [dateLeads, setDateLeads] = useState<any[]>([]);
  const [dateLeadsLoading, setDateLeadsLoading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      let startDate: string, endDate: string;
      if (useCustom && customStart && customEnd) { startDate = customStart; endDate = customEnd; }
      else { ({ startDate, endDate } = getDateRange(period)); }
      const res = await fetch(`/api/dashboard?startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error("[dashboard] API error", res.status, body);
        setFetchError(`Erro ao carregar dados (${res.status}). Verifique o console do servidor.`);
        return;
      }
      setData(await res.json());
    } catch (err) {
      console.error("[dashboard] fetch threw:", err);
      setFetchError("Erro de rede ao conectar com a API.");
    } finally {
      setLoading(false);
    }
  }, [period, useCustom, customStart, customEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function fetchDateLeads(date: string) {
    setSelectedDate(date);
    setDateLeadsLoading(true);
    const res = await fetch(`/api/leads?startDate=${date}&endDate=${date}&all=true`);
    if (res.ok) { const j = await res.json(); setDateLeads(j.leads ?? []); }
    setDateLeadsLoading(false);
  }

  const trafficChartData = data?.leadsByTrafficSource ?? [];
  const channelChartData = data?.leadsBySource?.map((s) => ({ name: s.sourceName, value: s.count, color: s.sourceColor })) ?? [];
  const funnelChartData = data?.leadsByStage?.map((s) => ({ name: s.stageName, count: s.count, color: s.stageColor })) ?? [];

  return (
    <div className="p-6 space-y-5">
      {/* Error banner */}
      {fetchError && (
        <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{fetchError}</span>
          <button onClick={fetchData} className="text-xs font-semibold underline hover:no-underline">Tentar novamente</button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">Visão geral dos seus leads</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!useCustom && (
            <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
              {PERIODS.map((p) => (
                <button key={p.days} onClick={() => setPeriod(p.days)}
                  className={cn("px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                    period === p.days ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                  {p.label}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => setUseCustom(!useCustom)}
            className={cn("px-3 py-1.5 rounded-lg text-sm border transition-all",
              useCustom ? "border-primary-400 text-primary-700 bg-primary-50" : "border-slate-200 text-slate-500 hover:bg-slate-50")}>
            {useCustom ? "× Período" : "Personalizar"}
          </button>
          {useCustom && (
            <div className="flex items-center gap-2">
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
              <span className="text-slate-400 text-xs">—</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="text-sm border border-slate-200 rounded-lg px-2.5 py-1.5" />
            </div>
          )}
        </div>
      </div>

      {/* Today / Week / Month / Period */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Hoje", value: data?.todayLeads ?? 0, accent: false },
          { label: "Esta semana", value: data?.weekLeads ?? 0, accent: false },
          { label: "Este mês", value: data?.monthLeads ?? 0, accent: false },
          { label: `No período (${useCustom ? "custom" : `${period}d`})`, value: data?.totalLeads ?? 0, accent: true },
        ].map(({ label, value, accent }) => (
          <div key={label} className="card p-4">
            <p className={cn("text-2xl font-bold", accent ? "text-primary-600" : "text-slate-900")}>
              {loading ? <span className="inline-block w-8 h-6 bg-slate-100 rounded animate-pulse" /> : value}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Agendamentos" value={loading ? "—" : data?.conversions.scheduled ?? 0} icon={Calendar} iconColor="text-emerald-600" />
        <MetricCard title="Comparecimentos" value={loading ? "—" : data?.conversions.attended ?? 0} icon={UserCheck} iconColor="text-violet-600" />
        <MetricCard title="Fechamentos" value={loading ? "—" : data?.conversions.closed ?? 0} icon={Award} iconColor="text-amber-600" />
        <MetricCard title="Conversão" value={loading ? "—" : `${data?.conversions.conversionRate ?? 0}%`} icon={TrendingUp} iconColor="text-primary-600" />
        <MetricCard title="Leads Perdidos" value={loading ? "—" : data?.conversions.lost ?? 0} icon={Target} iconColor="text-rose-600" />
        <MetricCard title="SLA Vencido" value={loading ? "—" : data?.slaBreached ?? 0} icon={AlertTriangle} iconColor="text-rose-600" subtitle="> 4h sem contato" />
        <Link href="/follow-up" className="block hover:scale-[1.01] transition-transform">
          <MetricCard title="Follow-ups" value={loading ? "—" : data?.pendingFollowUps ?? 0} icon={Bell} iconColor="text-orange-500" subtitle="Pendentes" />
        </Link>
        <Link href="/agenda" className="block hover:scale-[1.01] transition-transform">
          <MetricCard title="Agenda" value={loading ? "—" : data?.upcomingAppointments ?? 0} icon={CalendarDays} iconColor="text-cyan-600" subtitle="A partir de hoje" />
        </Link>
      </div>

      {/* Leads Over Time Chart + date click */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-slate-900">Leads por Dia</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Ver data:</label>
            <input type="date" value={selectedDate}
              onChange={(e) => e.target.value ? fetchDateLeads(e.target.value) : setSelectedDate("")}
              className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

        {loading ? (
          <div className="h-48 bg-slate-50 rounded-lg animate-pulse" />
        ) : (
          <LeadsOverTimeChart data={data?.leadsByDay ?? []} />
        )}

        {/* Date-specific leads panel */}
        {selectedDate && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-slate-800">
                Leads de {format(new Date(selectedDate + "T12:00:00"), "dd/MM/yyyy")}
                <span className="ml-2 text-xs font-normal text-slate-400">({dateLeads.length} {dateLeads.length === 1 ? "lead" : "leads"})</span>
              </h4>
              <button onClick={() => { setSelectedDate(""); setDateLeads([]); }} className="text-xs text-slate-400 hover:text-slate-600">× fechar</button>
            </div>

            {dateLeadsLoading ? (
              <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />)}</div>
            ) : dateLeads.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nenhum lead nesta data</p>
            ) : (
              <div className="space-y-1.5">
                {dateLeads.map((lead: any) => (
                  <Link key={lead.id} href={`/leads/${lead.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0", avatarColor(lead.name))}>
                      {getInitials(lead.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{lead.name}</p>
                      <p className="text-xs text-slate-400">{lead.source?.name ?? "Sem canal"} · <Phone className="w-2.5 h-2.5 inline" /> {lead.phone}</p>
                    </div>
                    <StatusBadge stage={lead.funnelStage} />
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {loading ? (
          <>
            <div className="card p-5 animate-pulse h-72 bg-slate-50" />
            <div className="card p-5 animate-pulse h-72 bg-slate-50" />
          </>
        ) : (
          <>
            <LeadsByChannelChart data={trafficChartData.length > 0 ? trafficChartData : channelChartData} />
            <FunnelStatusChart data={funnelChartData} />
          </>
        )}
      </div>

      {/* Recent Leads — full width */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-900">Leads Recentes</h3>
          <Link href="/leads" className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-0.5">
            Ver todos <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[1,2,3,4,5,6].map((i) => <div key={i} className="animate-pulse h-10 bg-slate-100 rounded-lg" />)}
          </div>
        ) : (data?.recentLeads ?? []).length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Nenhum lead no período</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
            {(data?.recentLeads ?? []).map((lead) => (
              <Link key={lead.id} href={`/leads/${lead.id}`}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0", avatarColor(lead.name))}>
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
          </div>
        )}
      </div>
    </div>
  );
}
