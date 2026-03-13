"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend, LineChart, Line
} from "recharts";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "leads-by-channel", label: "Por Canal" },
  { id: "leads-by-campaign", label: "Por Campanha" },
  { id: "leads-by-attendant", label: "Por Atendente" },
  { id: "conversion-by-channel", label: "Conversão" },
  { id: "loss-reasons", label: "Motivos de Perda" },
  { id: "monthly-comparison", label: "Comparativo Mensal" },
];

const CHART_COLORS = ["#0284c7", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#0891b2", "#ec4899"];

export default function ReportsPage() {
  const [tab, setTab] = useState("leads-by-channel");
  const [data, setData] = useState<any[]>([]);
  const [extra, setExtra] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  });
  const [endDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reports?type=${tab}&startDate=${startDate}&endDate=${endDate}`);
      const json = await res.json();
      setData(json.data ?? []);
      setExtra(json);
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  function exportCSV() {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const rows = [keys, ...data.map((row) => keys.map((k) => row[k] ?? ""))];
    const csv = rows.map((r) => r.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${tab}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Relatórios</h1>
          <p className="text-sm text-slate-500 mt-0.5">Análise detalhada de performance</p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCSV}>
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Data Início</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Data Fim</label>
          <input
            type="date"
            value={endDate}
            readOnly
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              tab === t.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Chart */}
          {(tab === "leads-by-channel" || tab === "leads-by-campaign" || tab === "leads-by-attendant") && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Distribuição de Leads</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} angle={-35} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Bar dataKey="total" name="Total" radius={[4, 4, 0, 0]}>
                    {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {tab === "loss-reasons" && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-1">Motivos de Perda</h3>
              <p className="text-xs text-slate-400 mb-4">Total de leads perdidos: {extra.total ?? 0}</p>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={data} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percentage }) => `${name} (${percentage}%)`}>
                    {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {tab === "monthly-comparison" && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-slate-900 mb-4">Comparativo dos últimos 6 meses</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }} />
                  <Legend />
                  <Line type="monotone" dataKey="total" name="Total" stroke="#0284c7" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="closed" name="Fechados" stroke="#10b981" strokeWidth={2} dot />
                  <Line type="monotone" dataKey="lost" name="Perdidos" stroke="#ef4444" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {data[0] && Object.keys(data[0]).map((k) => (
                      <th key={k} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">
                        {k === "name" ? "Nome" : k === "total" ? "Total" : k === "closed" ? "Fechados" :
                         k === "conversionRate" ? "Conversão %" : k === "percentage" ? "%" :
                         k === "count" ? "Qtd" : k === "avgResponseHours" ? "Tempo Médio (h)" : k}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {Object.entries(row).map(([k, v]: any) => (
                        <td key={k} className="px-4 py-3 text-sm text-slate-700">
                          {typeof v === "number" && k.includes("Rate") ? `${v}%` :
                           typeof v === "number" && k.includes("Pct") ? `${v}%` :
                           v ?? "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr>
                      <td colSpan={99} className="px-4 py-10 text-center text-sm text-slate-400">
                        Nenhum dado encontrado para o período
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
