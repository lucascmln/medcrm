"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line,
} from "recharts";
import { Download, BarChart2, Calendar, Bell, TrendingUp, Radio, Zap, Link } from "lucide-react";
import { getTrafficSourceConfig } from "@/lib/traffic-source-ui";
import { classifyTrafficSource } from "@/lib/tracking";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "leads-by-channel", label: "Por Origem", icon: Radio },
  { id: "traffic-source", label: "Tráfego", icon: Zap },
  { id: "leads-by-status", label: "Por Status", icon: BarChart2 },
  { id: "appointments", label: "Agendamentos", icon: Calendar },
  { id: "follow-ups", label: "Follow-ups", icon: Bell },
  { id: "volume-by-day", label: "Volume por Dia", icon: TrendingUp },
];

const COLORS = ["#0284c7", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#0891b2", "#ec4899", "#84cc16"];

const COL_LABELS: Record<string, string> = {
  name: "Nome", total: "Total", closed: "Fechados", lost: "Perdidos",
  conversionRate: "Conversão %", color: "", percentage: "%", count: "Qtd",
  avgResponseHours: "Tempo Méd. (h)", date: "Data", leads: "Leads",
  converted: "Convertidos", lead: "Lead", status: "Status",
  duration: "Duração", tipo: "Tipo", dueAt: "Data", etapa: "Etapa",
  scheduled: "Agendados",
};

export default function ReportsPage() {
  const [tab, setTab] = useState("leads-by-channel");
  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  // URL classifier tester state
  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState<{ label: string; bg: string; text: string } | null>(null);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/reports?type=${tab}&startDate=${startDate}&endDate=${endDate}`);
      if (!res.ok) { setData([]); return; }
      const json = await res.json();
      setData(json.data ?? []);
      setSummary(json.summary ?? json.total ?? null);
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function exportCSV() {
    if (!data.length) return;
    const keys = Object.keys(data[0]).filter((k) => k !== "color");
    const rows = [keys.map((k) => COL_LABELS[k] ?? k), ...data.map((r) => keys.map((k) => r[k] ?? ""))];
    // \uFEFF = UTF-8 BOM so Excel opens accented chars correctly
    const csv  = rows.map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    // Filename includes the active tab and date range so files don't collide
    a.download = `relatorio-${tab}-${startDate}-${endDate}.csv`;
    a.click();
  }

  const showBar = ["leads-by-channel", "traffic-source", "leads-by-status", "volume-by-day"].includes(tab);
  const showPie = tab === "leads-by-status";
  const showLine = tab === "volume-by-day";
  const showTable = ["appointments", "follow-ups"].includes(tab);

  const visibleCols = data.length > 0
    ? Object.keys(data[0]).filter((k) => k !== "color" && k !== "id")
    : [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Performance e análise do CRM</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCSV} disabled={!data.length}>
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* Date filter */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">De</label>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-500 block mb-1">Até</label>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-slate-100 rounded-xl p-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={cn("flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
              <Icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* URL classifier tester — visible only on Tráfego tab */}
      {tab === "traffic-source" && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-1 flex items-center gap-2">
            <Link className="w-4 h-4 text-slate-400" /> Testar Classificação de Origem
          </h3>
          <p className="text-xs text-slate-400 mb-3">Cole uma URL com parâmetros UTM para ver como ela seria classificada.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testUrl}
              onChange={(e) => {
                setTestUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder="https://site.com/?utm_source=facebook&utm_medium=paid_social&fbclid=..."
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={() => {
                if (!testUrl) return;
                try {
                  const url = new URL(testUrl);
                  const params = Object.fromEntries(url.searchParams.entries());
                  const classified = classifyTrafficSource({
                    utmSource: params.utm_source ?? null,
                    utmMedium: params.utm_medium ?? null,
                    utmCampaign: params.utm_campaign ?? null,
                    utmContent: params.utm_content ?? null,
                    utmTerm: params.utm_term ?? null,
                    landingPage: testUrl,
                    referrer: null,
                    gclid: params.gclid ?? null,
                    fbclid: params.fbclid ?? null,
                    fbc: params.fbc ?? null,
                    fbp: params.fbp ?? null,
                    rawUrlParams: url.search.slice(1) || null,
                  });
                  setTestResult(getTrafficSourceConfig(classified));
                } catch {
                  setTestResult(getTrafficSourceConfig("DIRECT"));
                }
              }}
              className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Classificar
            </button>
          </div>
          {testResult && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-slate-500">Resultado:</span>
              <span className={cn("text-sm font-semibold px-3 py-1 rounded-full", testResult.bg, testResult.text)}>
                {testResult.label}
              </span>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="card p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : data.length === 0 ? (
        <div className="card p-12 text-center">
          <BarChart2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Nenhum dado para o período selecionado</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards for appointments/follow-ups */}
          {tab === "appointments" && summary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { l: "Agendados", v: summary.SCHEDULED, c: "text-blue-700 bg-blue-50" },
                { l: "Compareceram", v: summary.COMPLETED, c: "text-emerald-700 bg-emerald-50" },
                { l: "Cancelados", v: summary.CANCELLED, c: "text-red-600 bg-red-50" },
                { l: "Não compareceram", v: summary.NO_SHOW, c: "text-orange-600 bg-orange-50" },
              ].map(({ l, v, c }) => (
                <div key={l} className={cn("rounded-xl p-4 text-center", c.split(" ")[1])}>
                  <p className={cn("text-2xl font-bold", c.split(" ")[0])}>{v ?? 0}</p>
                  <p className="text-xs mt-0.5 text-slate-600">{l}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "follow-ups" && summary && (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { l: "Total", v: summary.total },
                { l: "Pendentes", v: summary.pending, c: "text-orange-600" },
                { l: "Concluídos", v: summary.completed, c: "text-emerald-600" },
                { l: "Vencidos", v: summary.overdue, c: "text-red-600" },
                { l: "Automáticos", v: summary.auto, c: "text-violet-600" },
              ].map(({ l, v, c }) => (
                <div key={l} className="card p-3 text-center">
                  <p className={cn("text-xl font-bold", c ?? "text-slate-900")}>{v ?? 0}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{l}</p>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          {showLine && tab === "volume-by-day" ? (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Volume de Leads por Dia</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Leads" stroke="#0284c7" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="closed" name="Fechados" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : showPie && tab === "leads-by-status" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Distribuição por Etapa</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={data} dataKey="total" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, total }) => `${name}: ${total}`}>
                      {data.map((d, i) => <Cell key={i} fill={d.color ?? COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Total por Etapa</h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: "#64748b" }} width={110} />
                    <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                    <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                      {data.map((d, i) => <Cell key={i} fill={d.color ?? COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : showBar && !showLine && !showPie ? (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">
                {tab === "leads-by-channel" ? "Leads por Canal de Origem" :
                 tab === "traffic-source" ? "Leads por Origem de Tráfego" : "Volume"}
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-30} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                    {data.map((d, i) => <Cell key={i} fill={d.color ?? COLORS[i % COLORS.length]} />)}
                  </Bar>
                  {(tab === "leads-by-channel" || tab === "traffic-source") && <Bar dataKey="closed" name="Fechados" fill="#10b981" radius={[4, 4, 0, 0]} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {visibleCols.map((k) => (
                      <th key={k} className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5">
                        {COL_LABELS[k] ?? k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {visibleCols.map((k) => (
                        <td key={k} className="px-4 py-3 text-sm text-slate-700">
                          {k === "conversionRate" || k === "percentage" ? `${row[k] ?? 0}%` :
                           k === "avgResponseHours" && row[k] != null ? `${row[k]}h` :
                           row[k] ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
