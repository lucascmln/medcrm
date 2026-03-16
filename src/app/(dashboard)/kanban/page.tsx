"use client";

import { useEffect, useState, useCallback } from "react";
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors, closestCenter,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, AlertCircle, Search, Phone, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { formatDate, getInitials, avatarColor, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/** Safe fetch → always resolves, never throws. Returns null on any failure. */
async function safeJson<T>(res: Response): Promise<T | null> {
  if (!res.ok) return null;
  const text = await res.text();
  if (!text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

interface Lead {
  id: string; name: string; phone: string; procedure?: string;
  slaBreached: boolean; createdAt: string; funnelStageId: string;
  source?: { id: string; name: string; color: string };
  assignedTo?: { id: string; name: string };
}

interface FunnelStage {
  id: string; name: string; color: string; order: number;
  isLost: boolean; isFinal: boolean;
}

function LeadCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sorting } = useSortable({ id: lead.id });
  const router = useRouter();

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: sorting ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      onClick={() => router.push(`/leads/${lead.id}`)}
      className={cn(
        "bg-white rounded-xl border p-3 cursor-grab active:cursor-grabbing select-none",
        "hover:shadow-md transition-all hover:-translate-y-0.5",
        lead.slaBreached ? "border-red-200" : "border-slate-200/80",
        isDragging && "shadow-2xl rotate-1 scale-105",
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0", avatarColor(lead.name))}>
            {getInitials(lead.name)}
          </div>
          <span className="text-sm font-semibold text-slate-800 truncate">{lead.name}</span>
        </div>
        {lead.slaBreached && <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" aria-label="SLA vencido" />}
      </div>

      <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
        <Phone className="w-3 h-3" />
        <span>{lead.phone}</span>
      </div>

      {lead.procedure && (
        <p className="text-[11px] text-slate-500 italic mb-2 truncate">{lead.procedure}</p>
      )}

      <div className="flex items-center justify-between mt-1">
        {lead.source ? (
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${lead.source.color}20`, color: lead.source.color }}>
            {lead.source.name}
          </span>
        ) : <span />}
        <span className="text-[10px] text-slate-300">{formatDate(lead.createdAt)}</span>
      </div>
    </div>
  );
}

function KanbanColumn({ stage, leads }: { stage: FunnelStage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex-shrink-0 w-64">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{stage.name}</span>
        </div>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
          {leads.length}
        </span>
      </div>

      {/* Drop area */}
      <div ref={setNodeRef}
        className={cn(
          "min-h-32 rounded-xl p-2 transition-colors",
          isOver ? "bg-primary-50 ring-2 ring-primary-300 ring-dashed" : "bg-slate-100/70",
        )}>
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {leads.map((lead) => <LeadCard key={lead.id} lead={lead} />)}
          </div>
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-16">
            <p className="text-[11px] text-slate-400">Sem leads</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");
  const [hideLost, setHideLost] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const fetchData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [stagesRes, leadsRes] = await Promise.all([
        fetch("/api/funnel-stages"),
        fetch("/api/leads?all=true"),
      ]);

      const [stagesData, leadsData] = await Promise.all([
        safeJson<FunnelStage[] | { error: string }>(stagesRes),
        safeJson<{ leads: Lead[] } | { error: string }>(leadsRes),
      ]);

      if (!stagesRes.ok || stagesData === null) {
        const msg = stagesData && "error" in stagesData ? stagesData.error : `HTTP ${stagesRes.status}`;
        setFetchError(`Erro ao carregar etapas do funil: ${msg}`);
        setStages([]);
      } else {
        setStages(Array.isArray(stagesData) ? stagesData : []);
      }

      if (!leadsRes.ok || leadsData === null) {
        const msg = leadsData && "error" in leadsData ? leadsData.error : `HTTP ${leadsRes.status}`;
        // Only set error if stages also failed; otherwise show partial data with empty leads
        if (!stagesRes.ok) {
          setFetchError(`Erro ao carregar funil. Verifique sua sessão e tente novamente.`);
        }
        setLeads([]);
      } else {
        setLeads("leads" in leadsData ? leadsData.leads : []);
      }
    } catch (err) {
      console.error("Kanban fetchData error:", err);
      setFetchError("Erro de conexão. Verifique sua rede e tente novamente.");
      setStages([]);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const visibleStages = hideLost ? stages.filter((s) => !s.isLost) : stages;

  const filteredLeads = search
    ? leads.filter((l) => l.name.toLowerCase().includes(search.toLowerCase()) || l.phone.includes(search))
    : leads;

  const getStageLeads = (stageId: string) => filteredLeads.filter((l) => l.funnelStageId === stageId);
  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) { setActiveId(event.active.id as string); }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const targetStageId = over.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.funnelStageId === targetStageId) return;

    const previousStageId = lead.funnelStageId;

    // Optimistic update
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, funnelStageId: targetStageId } : l));

    const res = await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelStageId: targetStageId }),
    });

    // Rollback if the server rejected the update
    if (!res.ok) {
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, funnelStageId: previousStageId } : l));
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-64 animate-pulse">
              <div className="h-6 bg-slate-200 rounded mb-3" />
              <div className="h-64 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (fetchError && stages.length === 0) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-64 gap-4">
        <AlertCircle className="w-10 h-10 text-red-400" />
        <div className="text-center">
          <p className="text-sm font-medium text-slate-700">{fetchError}</p>
          <p className="text-xs text-slate-400 mt-1">O funil não pôde ser carregado.</p>
        </div>
        <button onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors">
          <RefreshCw className="w-4 h-4" /> Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Funil / Kanban</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {leads.length} lead{leads.length !== 1 ? "s" : ""} no funil · {visibleStages.length} etapas
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input type="text" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-44" />
          </div>
          <button onClick={() => setHideLost(!hideLost)}
            className={cn("px-3 py-1.5 text-sm border rounded-lg transition-colors",
              hideLost ? "border-slate-200 text-slate-500 hover:bg-slate-50" : "border-primary-300 bg-primary-50 text-primary-700")}>
            {hideLost ? "Mostrar Perdidos" : "Ocultar Perdidos"}
          </button>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Non-fatal error banner */}
      {fetchError && stages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{fetchError}</span>
          <button onClick={fetchData} className="flex items-center gap-1 text-xs font-medium underline hover:no-underline">
            <RefreshCw className="w-3 h-3" /> Recarregar
          </button>
        </div>
      )}

      {/* Stats bar */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {visibleStages.map((stage) => {
          const count = getStageLeads(stage.id).length;
          return (
            <div key={stage.id} className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stage.color }} />
              <span className="text-xs text-slate-600">{stage.name}</span>
              <span className="text-xs font-bold text-slate-800">{count}</span>
            </div>
          );
        })}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-6">
        <DndContext sensors={sensors} collisionDetection={closestCenter}
          onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 min-w-max pb-2">
            {visibleStages.map((stage) => (
              <KanbanColumn key={stage.id} stage={stage} leads={getStageLeads(stage.id)} />
            ))}
          </div>
          <DragOverlay>{activeLead && <LeadCard lead={activeLead} isDragging />}</DragOverlay>
        </DndContext>
      </div>

      <LeadFormModal open={showModal} onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); fetchData(); }} />
    </div>
  );
}
