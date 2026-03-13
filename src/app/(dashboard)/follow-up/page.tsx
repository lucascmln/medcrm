"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Bell, CheckCircle, Clock, AlertCircle, Zap, User, ChevronRight } from "lucide-react";
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

interface FormData {
  leadId: string;
  dueAt: string;
  notes: string;
}

function dueLabelColor(dueAt: string, status: string) {
  if (status !== "PENDING") return "text-slate-400";
  const d = parseISO(dueAt);
  if (isPast(d) && !isToday(d)) return "text-red-600";
  if (isToday(d)) return "text-orange-600";
  return "text-slate-600";
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
  const [showModal, setShowModal] = useState(false);
  const [autoLoading, setAutoLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [autoResult, setAutoResult] = useState<string | null>(null);

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterStatus) params.set("status", filterStatus);

    const [fuRes, leadsRes] = await Promise.all([
      fetch(`/api/follow-ups?${params}`),
      fetch("/api/leads?all=true"),
    ]);
    if (fuRes.ok) setFollowUps(await fuRes.json());
    if (leadsRes.ok) { const d = await leadsRes.json(); setLeads(d.leads ?? []); }
    setLoading(false);
  }, [filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function onSubmit(data: FormData) {
    const res = await fetch("/api/follow-ups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) { setShowModal(false); reset(); fetchData(); }
  }

  async function markComplete(id: string) {
    await fetch(`/api/follow-ups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "COMPLETED" }),
    });
    fetchData();
  }

  async function cancelFollowUp(id: string) {
    await fetch(`/api/follow-ups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
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
      setAutoResult(data.created > 0 ? `${data.created} follow-up(s) criados automaticamente` : "Nenhum follow-up novo necessário");
      fetchData();
    }
    setAutoLoading(false);
  }

  const overdue = followUps.filter((f) => f.status === "PENDING" && isPast(parseISO(f.dueAt)) && !isToday(parseISO(f.dueAt)));
  const dueToday = followUps.filter((f) => f.status === "PENDING" && isToday(parseISO(f.dueAt)));
  const upcoming = followUps.filter((f) => f.status === "PENDING" && !isPast(parseISO(f.dueAt)));
  const done = followUps.filter((f) => f.status !== "PENDING");

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Follow-up</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {overdue.length > 0 && <span className="text-red-600 font-medium">{overdue.length} vencido{overdue.length > 1 ? "s" : ""} · </span>}
            {dueToday.length} para hoje · {upcoming.length} próximos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={runAutoGenerate} loading={autoLoading}>
            <Zap className="w-4 h-4" /> Auto-gerar
          </Button>
          <Button onClick={() => { reset(); setShowModal(true); }}>
            <Plus className="w-4 h-4" /> Novo Follow-up
          </Button>
        </div>
      </div>

      {autoResult && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
          <Zap className="w-4 h-4" /> {autoResult}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[{ v: "PENDING", l: "Pendentes" }, { v: "COMPLETED", l: "Concluídos" }, { v: "CANCELLED", l: "Cancelados" }, { v: "", l: "Todos" }].map(({ v, l }) => (
          <button key={v} onClick={() => setFilterStatus(v)}
            className={cn("px-3 py-1.5 rounded-lg text-sm font-medium transition-all", filterStatus === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
            {l}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4].map((i) => <div key={i} className="card p-4 animate-pulse h-16 bg-slate-50" />)}</div>
      ) : followUps.length === 0 ? (
        <div className="card p-12 text-center">
          <Bell className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum follow-up encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Use "Auto-gerar" para criar follow-ups automáticos</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <Section title="Vencidos" icon={<AlertCircle className="w-4 h-4 text-red-500" />} count={overdue.length} accent="border-l-4 border-l-red-400">
              {overdue.map((f) => <FollowUpCard key={f.id} f={f} onComplete={markComplete} onCancel={cancelFollowUp} />)}
            </Section>
          )}
          {dueToday.length > 0 && (
            <Section title="Para hoje" icon={<Clock className="w-4 h-4 text-orange-500" />} count={dueToday.length}>
              {dueToday.map((f) => <FollowUpCard key={f.id} f={f} onComplete={markComplete} onCancel={cancelFollowUp} />)}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="Próximos" icon={<Bell className="w-4 h-4 text-slate-400" />} count={upcoming.length}>
              {upcoming.map((f) => <FollowUpCard key={f.id} f={f} onComplete={markComplete} onCancel={cancelFollowUp} />)}
            </Section>
          )}
          {filterStatus !== "PENDING" && done.length > 0 && (
            <Section title={filterStatus === "COMPLETED" ? "Concluídos" : filterStatus === "CANCELLED" ? "Cancelados" : "Concluídos/Cancelados"} icon={<CheckCircle className="w-4 h-4 text-slate-400" />} count={done.length}>
              {done.map((f) => <FollowUpCard key={f.id} f={f} onComplete={markComplete} onCancel={cancelFollowUp} />)}
            </Section>
          )}
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Novo Follow-up" size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="label">Lead *</label>
            <select {...register("leadId", { required: true })} className="input-field">
              <option value="">Selecionar lead</option>
              {leads.map((l) => <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Data e Hora *</label>
            <input {...register("dueAt", { required: true })} type="datetime-local" className="input-field" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea {...register("notes")} rows={3} className="input-field resize-none" placeholder="O que deve ser feito?" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>Criar Follow-up</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Section({ title, icon, count, accent, children }: { title: string; icon: React.ReactNode; count: number; accent?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{title}</span>
        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{count}</span>
      </div>
      <div className={cn("space-y-2", accent)}>
        {children}
      </div>
    </div>
  );
}

function FollowUpCard({ f, onComplete, onCancel }: { f: FollowUp; onComplete: (id: string) => void; onCancel: (id: string) => void }) {
  const isOverdue = f.status === "PENDING" && isPast(parseISO(f.dueAt)) && !isToday(parseISO(f.dueAt));
  const isCompleted = f.status === "COMPLETED";
  const isCancelled = f.status === "CANCELLED";

  return (
    <div className={cn("card p-4 flex items-start gap-3", isOverdue && "border-red-200 bg-red-50/20", isCompleted && "opacity-60")}>
      <div className="flex-shrink-0 mt-0.5">
        {isCompleted ? <CheckCircle className="w-4 h-4 text-emerald-500" /> :
         isCancelled ? <CheckCircle className="w-4 h-4 text-slate-300" /> :
         isOverdue ? <AlertCircle className="w-4 h-4 text-red-500" /> :
         <Clock className="w-4 h-4 text-slate-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Link href={`/leads/${f.lead.id}`} className="text-sm font-semibold text-slate-900 hover:text-primary-600 transition-colors">
            {f.lead.name}
          </Link>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${f.lead.funnelStage.color}20`, color: f.lead.funnelStage.color }}>
            {f.lead.funnelStage.name}
          </span>
          {f.isAuto && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5"><Zap className="w-2.5 h-2.5" />Auto</span>}
        </div>
        <p className={cn("text-xs mt-0.5 font-medium", dueLabelColor(f.dueAt, f.status))}>{dueLabel(f.dueAt)}</p>
        <p className="text-xs text-slate-400">{f.lead.phone}</p>
        {f.notes && <p className="text-xs text-slate-500 mt-1 italic">{f.notes}</p>}
      </div>
      {f.status === "PENDING" && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onComplete(f.id)} title="Concluir" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
            <CheckCircle className="w-4 h-4" />
          </button>
          <button onClick={() => onCancel(f.id)} title="Cancelar" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
            <XCircle className="w-4 h-4" />
          </button>
          <Link href={`/leads/${f.lead.id}`} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

function XCircle({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
