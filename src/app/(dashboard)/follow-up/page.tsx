"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Bell, CheckCircle, XCircle, Clock, AlertCircle, Zap, ChevronRight, RotateCcw, Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useForm } from "react-hook-form";
import { format, isPast, isToday, isTomorrow, parseISO, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface FollowUp {
  id: string;
  dueAt: string;
  notes?: string;
  status: string;
  isAuto: boolean;
  completedAt?: string;
  lead: { id: string; name: string; phone: string; funnelStage: { name: string; color: string } };
  user?: { id: string; name: string };
}

interface Lead {
  id: string;
  name: string;
  phone: string;
}

interface CreateFormData {
  leadId: string;
  dueAt: string;
  notes: string;
}

interface RescheduleFormData {
  dueAt: string;
  notes: string;
}

function dueLabelColor(dueAt: string, status: string) {
  if (status !== "PENDING") return "text-slate-400";
  const d = parseISO(dueAt);
  if (isPast(d) && !isToday(d)) return "text-red-600";
  if (isToday(d)) return "text-orange-600";
  return "text-slate-500";
}

function dueLabel(dueAt: string) {
  const d = parseISO(dueAt);
  if (isToday(d)) return `Hoje às ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Amanhã às ${format(d, "HH:mm")}`;
  if (isPast(d)) return `Vencido ${formatDistanceToNow(d, { addSuffix: true, locale: ptBR })}`;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
}

export default function FollowUpPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [reschedulingId, setReschedulingId] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [autoResult, setAutoResult] = useState<string | null>(null);

  const createForm = useForm<CreateFormData>();
  const rescheduleForm = useForm<RescheduleFormData>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);

    try {
      const [fuRes, leadsRes] = await Promise.all([
        fetch(`/api/follow-ups?${params}`),
        fetch("/api/leads?all=true"),
      ]);
      if (fuRes.ok) {
        const d = await fuRes.json();
        setFollowUps(Array.isArray(d) ? d : []);
      }
      if (leadsRes.ok) {
        const d = await leadsRes.json();
        setLeads(Array.isArray(d.leads) ? d.leads : []);
      }
    } catch {
      // network error — keep empty state
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function onCreate(data: CreateFormData) {
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowCreateModal(false); createForm.reset(); fetchData(); }
  }

  async function onReschedule(data: RescheduleFormData) {
    if (!reschedulingId) return;
    const res = await fetch(`/api/follow-ups/${reschedulingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dueAt: data.dueAt, notes: data.notes, status: "PENDING" }),
    });
    if (res.ok) { setReschedulingId(null); rescheduleForm.reset(); fetchData(); }
  }

  function openReschedule(f: FollowUp) {
    setReschedulingId(f.id);
    rescheduleForm.reset({
      dueAt: format(parseISO(f.dueAt), "yyyy-MM-dd'T'HH:mm"),
      notes: f.notes ?? "",
    });
  }

  async function markComplete(id: string) {
    await fetch(`/api/follow-ups/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    fetchData();
  }

  async function cancelFollowUp(id: string) {
    await fetch(`/api/follow-ups/${id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "CANCELLED" }),
    });
    fetchData();
  }

  async function runAutoGenerate() {
    setAutoLoading(true);
    setAutoResult(null);
    const res = await fetch("/api/follow-ups", { method: "PATCH" });
    if (res.ok) {
      const data = await res.json();
      setAutoResult(data.created > 0
        ? `${data.created} follow-up(s) criados automaticamente`
        : "Nenhum follow-up novo necessário");
      fetchData();
    }
    setAutoLoading(false);
  }

  const overdue   = followUps.filter((f) => f.status === "PENDING" && isPast(parseISO(f.dueAt)) && !isToday(parseISO(f.dueAt)));
  const dueToday  = followUps.filter((f) => f.status === "PENDING" && isToday(parseISO(f.dueAt)));
  const upcoming  = followUps.filter((f) => f.status === "PENDING" && !isPast(parseISO(f.dueAt)));
  const done      = followUps.filter((f) => f.status !== "PENDING");

  const pendingCount  = overdue.length + dueToday.length + upcoming.length;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Follow-up</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {overdue.length > 0 && <span className="text-red-600 font-semibold">{overdue.length} vencido{overdue.length > 1 ? "s" : ""} · </span>}
            {dueToday.length > 0 && <span className="text-orange-600 font-medium">{dueToday.length} para hoje · </span>}
            {upcoming.length} próximo{upcoming.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={runAutoGenerate} loading={autoLoading}>
            <Zap className="w-4 h-4" /> Auto-gerar
          </Button>
          <Button onClick={() => { createForm.reset(); setShowCreateModal(true); }}>
            <Plus className="w-4 h-4" /> Novo Follow-up
          </Button>
        </div>
      </div>

      {autoResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
          <Zap className="w-4 h-4" /> {autoResult}
          <button onClick={() => setAutoResult(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">×</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { v: "PENDING",   l: "Pendentes",  count: pendingCount },
          { v: "COMPLETED", l: "Concluídos", count: null },
          { v: "CANCELLED", l: "Cancelados", count: null },
          { v: "",          l: "Todos",      count: null },
        ].map(({ v, l, count }) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              filterStatus === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {l}
            {count !== null && count > 0 && (
              <span className={cn("text-xs font-bold px-1.5 py-0.5 rounded-full",
                filterStatus === v ? "bg-red-100 text-red-600" : "bg-slate-200 text-slate-500")}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : followUps.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum follow-up encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Use "Auto-gerar" para criar follow-ups automáticos</p>
        </div>
      ) : (
        <div className="space-y-5">
          {overdue.length > 0 && (
            <Section
              title="Vencidos"
              icon={<AlertCircle className="w-4 h-4 text-red-500" />}
              count={overdue.length}
              headerClass="text-red-600"
            >
              {overdue.map((f) => (
                <FollowUpRow key={f.id} f={f} variant="overdue"
                  onComplete={markComplete} onCancel={cancelFollowUp} onReschedule={openReschedule} />
              ))}
            </Section>
          )}

          {dueToday.length > 0 && (
            <Section
              title="Para hoje"
              icon={<Clock className="w-4 h-4 text-orange-500" />}
              count={dueToday.length}
              headerClass="text-orange-600"
            >
              {dueToday.map((f) => (
                <FollowUpRow key={f.id} f={f} variant="today"
                  onComplete={markComplete} onCancel={cancelFollowUp} onReschedule={openReschedule} />
              ))}
            </Section>
          )}

          {upcoming.length > 0 && (
            <Section title="Próximos" icon={<Bell className="w-4 h-4 text-slate-400" />} count={upcoming.length}>
              {upcoming.map((f) => (
                <FollowUpRow key={f.id} f={f} variant="upcoming"
                  onComplete={markComplete} onCancel={cancelFollowUp} onReschedule={openReschedule} />
              ))}
            </Section>
          )}

          {filterStatus !== "PENDING" && done.length > 0 && (
            <Section
              title={filterStatus === "COMPLETED" ? "Concluídos" : filterStatus === "CANCELLED" ? "Cancelados" : "Concluídos / Cancelados"}
              icon={<CheckCircle className="w-4 h-4 text-slate-400" />}
              count={done.length}
            >
              {done.map((f) => (
                <FollowUpRow key={f.id} f={f} variant="done"
                  onComplete={markComplete} onCancel={cancelFollowUp} onReschedule={openReschedule} />
              ))}
            </Section>
          )}
        </div>
      )}

      {/* Create Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Novo Follow-up" size="sm">
        <form onSubmit={createForm.handleSubmit(onCreate)} className="p-5 space-y-4">
          <div>
            <label className="label">Lead *</label>
            <select {...createForm.register("leadId", { required: true })} className="input-field">
              <option value="">Selecionar lead</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data e Hora *</label>
            <input {...createForm.register("dueAt", { required: true })} type="datetime-local" className="input-field" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea {...createForm.register("notes")} rows={2} className="input-field resize-none" placeholder="O que deve ser feito?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button type="submit" loading={createForm.formState.isSubmitting}>Criar</Button>
          </div>
        </form>
      </Modal>

      {/* Reschedule Modal */}
      <Modal open={!!reschedulingId} onClose={() => setReschedulingId(null)} title="Remarcar Follow-up" size="sm">
        <form onSubmit={rescheduleForm.handleSubmit(onReschedule)} className="p-5 space-y-4">
          <div>
            <label className="label">Nova data e hora *</label>
            <input {...rescheduleForm.register("dueAt", { required: true })} type="datetime-local" className="input-field" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea {...rescheduleForm.register("notes")} rows={2} className="input-field resize-none" placeholder="Atualizar observações..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setReschedulingId(null)}>Cancelar</Button>
            <Button type="submit" loading={rescheduleForm.formState.isSubmitting}>Remarcar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Section({
  title, icon, count, headerClass, children,
}: {
  title: string; icon: React.ReactNode; count: number;
  headerClass?: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className={cn("text-xs font-bold uppercase tracking-wide", headerClass ?? "text-slate-500")}>
          {title}
        </span>
        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-medium">{count}</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function FollowUpRow({
  f, variant, onComplete, onCancel, onReschedule,
}: {
  f: FollowUp;
  variant: "overdue" | "today" | "upcoming" | "done";
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
  onReschedule: (f: FollowUp) => void;
}) {
  const isCompleted = f.status === "COMPLETED";
  const isCancelled = f.status === "CANCELLED";

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-xl border transition-colors",
      variant === "overdue" ? "border-red-200 bg-red-50/30 hover:bg-red-50/60" :
      variant === "today"   ? "border-orange-200 bg-orange-50/20 hover:bg-orange-50/40" :
      variant === "done"    ? "border-slate-100 opacity-60" :
      "border-slate-200 bg-white hover:border-slate-300",
    )}>
      {/* Left accent */}
      <div className={cn("w-1 self-stretch rounded-full flex-shrink-0",
        variant === "overdue" ? "bg-red-400" :
        variant === "today"   ? "bg-orange-400" :
        variant === "done"    ? "bg-slate-200" :
        "bg-slate-300",
      )} />

      {/* Icon */}
      <div className="flex-shrink-0">
        {isCompleted  ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
         isCancelled  ? <CheckCircle className="w-4 h-4 text-slate-300" /> :
         variant === "overdue" ? <AlertCircle className="w-4 h-4 text-red-500" /> :
         variant === "today"   ? <Clock className="w-4 h-4 text-orange-500" /> :
         <Clock className="w-4 h-4 text-slate-400" />}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-900 truncate">{f.lead.name}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: `${f.lead.funnelStage.color}20`, color: f.lead.funnelStage.color }}>
            {f.lead.funnelStage.name}
          </span>
          {f.isAuto && (
            <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" /> Auto
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className={cn("text-xs font-medium", dueLabelColor(f.dueAt, f.status))}>
            {dueLabel(f.dueAt)}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-0.5">
            <Phone className="w-3 h-3" /> {f.lead.phone}
          </span>
        </div>
        {f.notes && <p className="text-xs text-slate-400 mt-0.5 truncate italic">{f.notes}</p>}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {f.status === "PENDING" && (
          <>
            <button onClick={() => onComplete(f.id)} title="Concluir"
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
              <CheckCircle className="w-4 h-4" />
            </button>
            <button onClick={() => onReschedule(f)} title="Remarcar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onCancel(f.id)} title="Cancelar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <XCircle className="w-4 h-4" />
            </button>
          </>
        )}
        <Link href={`/leads/${f.lead.id}`} title="Abrir lead"
          className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

