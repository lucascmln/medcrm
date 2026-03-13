"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Download, Upload, AlertCircle, ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { formatDate, formatPhone, getInitials, avatarColor, cn } from "@/lib/utils";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  procedure?: string;
  slaBreached: boolean;
  createdAt: string;
  funnelStage: { id: string; name: string; color: string };
  source?: { id: string; name: string; color: string };
  assignedTo?: { id: string; name: string };
  doctor?: { id: string; name: string };
  unit?: { id: string; name: string };
}

interface FunnelStage { id: string; name: string; color: string; }
interface LeadSource { id: string; name: string; }
interface User { id: string; name: string; }

export default function LeadsPage() {
  const router = useRouter();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageId, setStageId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      if (search) params.set("search", search);
      if (stageId) params.set("stageId", stageId);
      if (sourceId) params.set("sourceId", sourceId);
      if (assignedToId) params.set("assignedToId", assignedToId);

      const res = await fetch(`/api/leads?${params}`);
      const json = await res.json();
      setLeads(json.leads ?? []);
      setTotal(json.total ?? 0);
      setTotalPages(json.totalPages ?? 1);
    } finally {
      setLoading(false);
    }
  }, [page, search, stageId, sourceId, assignedToId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    Promise.all([
      fetch("/api/funnel-stages").then((r) => r.json()),
      fetch("/api/lead-sources").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
    ]).then(([s, src, u]) => {
      setStages(s);
      setSources(src);
      setUsers(u);
    });
  }, []);

  function handleSearchChange(v: string) {
    setSearch(v);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setPage(1), 300);
  }

  async function exportCSV() {
    const res = await fetch(`/api/leads?all=true`);
    const json = await res.json();
    const rows = [
      ["Nome", "Telefone", "Email", "Canal", "Etapa", "Atendente", "Médico", "Procedimento", "Data"],
      ...json.leads.map((l: Lead) => [
        l.name, l.phone, l.email ?? "", l.source?.name ?? "", l.funnelStage.name,
        l.assignedTo?.name ?? "", l.doctor?.name ?? "", l.procedure ?? "",
        new Date(l.createdAt).toLocaleDateString("pt-BR"),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} lead{total !== 1 ? "s" : ""} encontrado{total !== 1 ? "s" : ""}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={exportCSV}>
            <Download className="w-3.5 h-3.5" /> Exportar
          </Button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, telefone ou email..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-3.5 h-3.5" /> Filtros
        </Button>
      </div>

      {showFilters && (
        <div className="card p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Etapa</label>
            <select
              value={stageId}
              onChange={(e) => { setStageId(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todas as etapas</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Canal</label>
            <select
              value={sourceId}
              onChange={(e) => { setSourceId(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos os canais</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Atendente</label>
            <select
              value={assignedToId}
              onChange={(e) => { setAssignedToId(e.target.value); setPage(1); }}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">Todos os atendentes</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Lead</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Canal</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Etapa</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Atendente</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Médico</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Data</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-8 bg-slate-100 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-6" /></td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                    Nenhum lead encontrado
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0", avatarColor(lead.name))}>
                          {getInitials(lead.name)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{lead.name}</p>
                          <p className="text-xs text-slate-400">{formatPhone(lead.phone)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.source ? (
                        <span className="text-sm text-slate-600">{lead.source.name}</span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge stage={lead.funnelStage} />
                    </td>
                    <td className="px-4 py-3">
                      {lead.assignedTo ? (
                        <span className="text-sm text-slate-600">{lead.assignedTo.name}</span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {lead.doctor ? (
                        <span className="text-sm text-slate-600">{lead.doctor.name}</span>
                      ) : (
                        <span className="text-sm text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-500">{formatDate(lead.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.slaBreached && (
                        <div title="SLA vencido — sem atendimento em 4h">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              Página {page} de {totalPages} · {total} leads
            </p>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <LeadFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); fetchLeads(); }}
      />
    </div>
  );
}
