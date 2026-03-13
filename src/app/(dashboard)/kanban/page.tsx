"use client";

import { useEffect, useState, useCallback } from "react";
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, PointerSensor, useSensor, useSensors, closestCenter } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Plus, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { formatDate, getInitials, avatarColor, cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Lead {
  id: string;
  name: string;
  phone: string;
  procedure?: string;
  slaBreached: boolean;
  createdAt: string;
  funnelStageId: string;
  source?: { id: string; name: string; color: string };
  assignedTo?: { id: string; name: string };
  doctor?: { id: string; name: string };
}

interface FunnelStage {
  id: string;
  name: string;
  color: string;
  order: number;
  isLost: boolean;
  isFinal: boolean;
}

function LeadCard({ lead, isDragging }: { lead: Lead; isDragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: sorting } = useSortable({ id: lead.id });
  const router = useRouter();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: sorting ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "bg-white rounded-xl border p-3 cursor-grab active:cursor-grabbing shadow-sm hover:shadow-md transition-shadow group",
        lead.slaBreached ? "border-red-300 bg-red-50/30" : "border-slate-200",
        isDragging && "shadow-xl rotate-2"
      )}
      onClick={() => router.push(`/leads/${lead.id}`)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0", avatarColor(lead.name))}>
            {getInitials(lead.name)}
          </div>
          <span className="text-sm font-medium text-slate-900 truncate">{lead.name}</span>
        </div>
        {lead.slaBreached && (
          <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" title="SLA vencido" />
        )}
      </div>

      <p className="text-xs text-slate-400 mt-1.5 ml-8">{lead.phone}</p>

      {lead.procedure && (
        <p className="text-xs text-slate-500 mt-1 ml-8 italic truncate">{lead.procedure}</p>
      )}

      <div className="flex items-center justify-between mt-2.5 ml-8">
        <div className="flex items-center gap-1.5">
          {lead.source && (
            <Badge color={lead.source.color} className="text-[10px] py-0.5">
              {lead.source.name}
            </Badge>
          )}
        </div>
        <span className="text-[10px] text-slate-400">{formatDate(lead.createdAt)}</span>
      </div>

      {lead.assignedTo && (
        <div className="flex items-center gap-1 mt-2 ml-8">
          <div className={cn("w-4 h-4 rounded-full flex items-center justify-center text-white text-[8px] font-bold", avatarColor(lead.assignedTo.name))}>
            {getInitials(lead.assignedTo.name)}
          </div>
          <span className="text-[10px] text-slate-400">{lead.assignedTo.name}</span>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({ stage, leads }: { stage: FunnelStage; leads: Lead[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div className="flex-shrink-0 w-72">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
          <h3 className="text-sm font-semibold text-slate-800">{stage.name}</h3>
        </div>
        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      <div
        ref={setNodeRef}
        className={cn(
          "min-h-24 rounded-xl transition-colors p-2",
          isOver ? "bg-primary-50 ring-2 ring-primary-300 ring-dashed" : "bg-slate-100/60"
        )}
      >
        <SortableContext items={leads.map((l) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {leads.map((lead) => (
              <LeadCard key={lead.id} lead={lead} />
            ))}
          </div>
        </SortableContext>
        {leads.length === 0 && (
          <div className="flex items-center justify-center h-16">
            <p className="text-xs text-slate-400">Sem leads</p>
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchData = useCallback(async () => {
    const [stagesRes, leadsRes] = await Promise.all([
      fetch("/api/funnel-stages"),
      fetch("/api/leads?all=true"),
    ]);
    const [stagesData, leadsData] = await Promise.all([stagesRes.json(), leadsRes.json()]);
    setStages(Array.isArray(stagesData) ? stagesData : []);
    setLeads(leadsData.leads ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredLeads = search
    ? leads.filter((l) =>
        l.name.toLowerCase().includes(search.toLowerCase()) ||
        l.phone.includes(search)
      )
    : leads;

  const getStageLeads = (stageId: string) =>
    filteredLeads.filter((l) => l.funnelStageId === stageId);

  const activeLead = activeId ? leads.find((l) => l.id === activeId) : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const targetStageId = over.id as string;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.funnelStageId === targetStageId) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => l.id === leadId ? { ...l, funnelStageId: targetStageId } : l)
    );

    // API call
    await fetch(`/api/leads/${leadId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelStageId: targetStageId }),
    });
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex-shrink-0 w-72 animate-pulse">
              <div className="h-7 bg-slate-200 rounded mb-3" />
              <div className="h-64 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Kanban</h1>
          <p className="text-sm text-slate-500 mt-0.5">{leads.length} leads no funil</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 w-48"
            />
          </div>
          <Button onClick={() => setShowModal(true)}>
            <Plus className="w-4 h-4" /> Novo Lead
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto pb-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4 min-w-max">
            {stages.map((stage) => (
              <KanbanColumn key={stage.id} stage={stage} leads={getStageLeads(stage.id)} />
            ))}
          </div>

          <DragOverlay>
            {activeLead && <LeadCard lead={activeLead} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>

      <LeadFormModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={() => { setShowModal(false); fetchData(); }}
      />
    </div>
  );
}
