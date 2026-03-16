"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Search, Download, AlertCircle, ChevronLeft, ChevronRight,
  Filter, Bell, CalendarDays, ExternalLink, Clock, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { Modal } from "@/components/ui/modal";
import { useForm } from "react-hook-form";
import { formatDate, formatPhone, getInitials, avatarColor, cn } from "@/lib/utils";
import { format, parseISO, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { getTrafficSourceConfig, TRAFFIC_SOURCE_CONFIG, type TrafficSourceKey } from "@/lib/traffic-source-ui";

interface FollowUpItem { id: string; dueAt: string; status: string }
interface Lead {
  id: string; name: string; phone: string; email?: string;
  procedure?: string; slaBreached: boolean; createdAt: string;
  lastInteractionAt?: string;
  funnelStage: { id: string; name: string; color: string };
  source?: { id: string; name: string; color: string };
  trafficSource?: string | null;
  followUps?: FollowUpItem[];
}

interface FunnelStage { id: string; name: string; color: string }

function nextFollowUpLabel(followUps?: FollowUpItem[]) {
  const next = followUps?.[0];
  if (!next) return null;
  const d = parseISO(next.dueAt);
  const overdue = isPast(d) && !isToday(d);
  const today = isToday(d);
  const label = today ? `Hoje ${format(d, "HH:mm")}` : format(d, "dd/MM HH:mm", { locale: ptBR });
  return { label, overdue, today };
}

interface QuickFUForm { dueAt: string; notes: string }
interface QuickApptForm { title: string; scheduledAt: string; duration: number }

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageId, setStageId] = useState("");
  const [trafficSource, setTrafficSource] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [stages, setStages] = useState<FunnelStage[]>([]);

  // Quick action modals
  const [quickFULead, setQuickFULead] = useState<Lead | null>(null);
  const [quickApptLead, setQuickApptLead] = useState<Lead | null>(null);

  const fuForm = useForm<QuickFUForm>();
  const apptForm = useForm<QuickApptForm>({ defaultValues: { duration: 60 } });

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "25" });
      if (search) params.set("search", search);
      if (stageId) params.set("stageId", stageId);
      if (trafficSource) params.set("trafficSource", trafficSource);
      const res = await fetch(`/api/leads?${params}`);
      if (!res.ok) {
        console.error("[leads] API error", res.status, await res.text().catch(() => ""));
        return;
      }
      const json = await res.json();
      setLeads(json.leads ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, stageId, trafficSource]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    fetch("/api/funnel-stages").then((r) => r.json()).then((s) => {
      setStages(Array.isArray(s) ? s : []);
    });
  }, []);

  function handleSearchChange(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 400);
  }

  async function exportCSV() {
    // Pass all active filters so the export matches exactly what's on screen
    const params = new URLSearchParams({ all: "true" });
    if (search)        params.set("search", search);
    if (stageId)       params.set("stageId", stageId);
    if (trafficSource) params.set("trafficSource", trafficSource);

    const res  = await fetch(`/api/leads?${params}`);
    const json = await res.json();
    const list: Lead[] = json.leads ?? [];

    if (!list.length) {
      alert("Nenhum lead encontrado com os filtros atuais. Ajuste os filtros e tente novamente.");
      return;
    }

    const rows = [
      ["Nome", "Telefone", "E-mail", "Canal", "Etapa", "Procedimento", "Entrada"],
      ...list.map((l) => [
        l.name,
        l.phone,
        l.email ?? "",
        l.trafficSource ? getTrafficSourceConfig(l.trafficSource).label : (l.source?.name ?? ""),
        l.funnelStage.name,
        l.procedure ?? "",
        new Date(l.createdAt).toLocaleDateString("pt-BR"),
      ]),
    ];

    // Build a descriptive filename reflecting active filters
    const parts = ["leads"];
    if (stageId) {
      const stageName = stages.find((s) => s.id === stageId)?.name;
      if (stageName) parts.push(stageName.toLowerCase().replace(/[\s/]+/g, "-"));
    }
    if (trafficSource) {
      parts.push(trafficSource.toLowerCase().replace(/_/g, "-"));
    }
    parts.push(new Date().toISOString().split("T")[0]);

    // \uFEFF = UTF-8 BOM so Excel opens accented chars correctly
    const csv  = rows.map((r) => r.map((c: unknown) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `${parts.join("-")}.csv`;
    a.click();
  }

  async function submitQuickFollowUp(data: QuickFUForm) {
    if (!quickFULead) return;
    await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: quickFULead.id, dueAt: data.dueAt, notes: data.notes }),
    });
    setQuickFULead(null);
    fuForm.reset();
    fetchLeads();
  }

  async function submitQuickAppt(data: QuickApptForm) {
    if (!quickApptLead) return;
    await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, leadId: quickApptLead.id, title: data.title || `Consulta — ${quickApptLead.name}` }),
    });
    setQuickApptLead(null);
    apptForm.reset();
    fetchLeads();
  }

  const activeFilters = [stageId, trafficSource].filter(Boolean).length;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} lead{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCSV} disabled={total === 0}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Search + Filter bar */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Buscar por nome ou telefone..." value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500" />
          {search && <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={cn("flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors",
            showFilters || activeFilters > 0 ? "border-primary-300 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
          <Filter className="w-3.5 h-3.5" />
          Filtros
          {activeFilters > 0 && <span className="w-4 h-4 bg-primary-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{activeFilters}</span>}
        </button>
      </div>

      {showFilters && (
        <div className="card p-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Etapa</label>
            <select value={stageId} onChange={(e) => { setStageId(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Todas</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Canal</label>
            <select value={trafficSource} onChange={(e) => { setTrafficSource(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500">
              <option value="">Todos</option>
              {(Object.entries(TRAFFIC_SOURCE_CONFIG) as [TrafficSourceKey, typeof TRAFFIC_SOURCE_CONFIG[TrafficSourceKey]][]).map(([key, cfg]) => (
                <option key={key} value={key}>{cfg.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            {activeFilters > 0 && (
              <button onClick={() => { setStageId(""); setTrafficSource(""); setPage(1); }}
                className="text-xs text-slate-500 hover:text-red-500 underline">Limpar filtros</button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5">Lead</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5">Canal</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5">Etapa</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5">Follow-up</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wide px-4 py-2.5">Entrada</th>
                <th className="w-24 px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-slate-100 rounded-full" /><div className="h-4 bg-slate-100 rounded w-28" /></div></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="px-4 py-3" />
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Search className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Nenhum lead encontrado</p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const fu = nextFollowUpLabel(lead.followUps);
                  return (
                    <tr key={lead.id} onClick={() => router.push(`/leads/${lead.id}`)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0", avatarColor(lead.name))}>
                            {getInitials(lead.name)}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-medium text-slate-900">{lead.name}</p>
                              {lead.slaBreached && <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-slate-400">{formatPhone(lead.phone)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          {lead.trafficSource ? (() => {
                            const ts = getTrafficSourceConfig(lead.trafficSource);
                            return (
                              <span className={cn("block text-xs font-medium px-1.5 py-0.5 rounded w-fit", ts.bg, ts.text)}>
                                {ts.label}
                              </span>
                            );
                          })() : lead.source ? (
                            <span className="text-sm text-slate-600">{lead.source.name}</span>
                          ) : <span className="text-slate-300 text-sm">—</span>}
                          {lead.trafficSource && lead.source && (
                            <span className="block text-[10px] text-slate-400">{lead.source.name}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3"><StatusBadge stage={lead.funnelStage} /></td>
                      <td className="px-4 py-3">
                        {fu ? (
                          <span className={cn("text-xs font-medium flex items-center gap-1", fu.overdue ? "text-red-600" : fu.today ? "text-orange-600" : "text-slate-600")}>
                            <Clock className="w-3 h-3" />{fu.label}
                          </span>
                        ) : <span className="text-slate-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-400">{formatDate(lead.createdAt)}</span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                          <button onClick={() => { fuForm.reset(); setQuickFULead(lead); }}
                            title="Criar follow-up"
                            className="p-1.5 rounded text-slate-400 hover:text-orange-600 hover:bg-orange-50 transition-colors">
                            <Bell className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => { apptForm.reset({ duration: 60, title: `Consulta — ${lead.name}` }); setQuickApptLead(lead); }}
                            title="Agendar"
                            className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                            <CalendarDays className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => router.push(`/leads/${lead.id}`)}
                            title="Abrir lead"
                            className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100">
          <p className="text-xs text-slate-400">
            {total > 0 ? `${(page - 1) * 25 + 1}–${Math.min(page * 25, total)} de ${total}` : "0 resultados"}
          </p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-500 px-2">p. {page}/{totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Lead create/edit modal */}
      <LeadFormModal open={showModal} onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); fetchLeads(); }} />

      {/* Quick Follow-up Modal */}
      <Modal open={!!quickFULead} onClose={() => setQuickFULead(null)} title={`Follow-up — ${quickFULead?.name}`} size="sm">
        <form onSubmit={fuForm.handleSubmit(submitQuickFollowUp)} className="p-5 space-y-4">
          <div>
            <label className="label">Data e hora *</label>
            <input {...fuForm.register("dueAt", { required: true })} type="datetime-local" className="input-field" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea {...fuForm.register("notes")} rows={3} className="input-field resize-none" placeholder="O que precisa ser feito?" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setQuickFULead(null)}>Cancelar</Button>
            <Button type="submit" loading={fuForm.formState.isSubmitting}>Criar Follow-up</Button>
          </div>
        </form>
      </Modal>

      {/* Quick Appointment Modal */}
      <Modal open={!!quickApptLead} onClose={() => setQuickApptLead(null)} title={`Agendar — ${quickApptLead?.name}`} size="sm">
        <form onSubmit={apptForm.handleSubmit(submitQuickAppt)} className="p-5 space-y-4">
          <div>
            <label className="label">Título</label>
            <input {...apptForm.register("title")} className="input-field" placeholder="Consulta inicial" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data e hora *</label>
              <input {...apptForm.register("scheduledAt", { required: true })} type="datetime-local" className="input-field" />
            </div>
            <div>
              <label className="label">Duração (min)</label>
              <input {...apptForm.register("duration", { valueAsNumber: true })} type="number" min={15} step={15} className="input-field" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setQuickApptLead(null)}>Cancelar</Button>
            <Button type="submit" loading={apptForm.formState.isSubmitting}>Agendar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
