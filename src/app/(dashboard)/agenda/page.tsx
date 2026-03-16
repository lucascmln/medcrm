"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Calendar, Clock, User, Phone, Edit2, Trash2,
  CheckCircle, XCircle, AlertCircle, ExternalLink, RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useForm } from "react-hook-form";
import { format, isToday, isTomorrow, isPast, parseISO, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface Appointment {
  id: string;
  title: string;
  notes?: string;
  scheduledAt: string;
  duration: number;
  status: string;
  lead?: { id: string; name: string; phone: string };
  user?: { id: string; name: string };
}

interface Lead {
  id: string;
  name: string;
  phone: string;
}

interface FormData {
  title: string;
  leadId: string;
  scheduledAt: string;
  duration: number;
  notes: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  SCHEDULED:  { label: "Agendado",       color: "text-blue-700",    bg: "bg-blue-50"   },
  COMPLETED:  { label: "Compareceu",     color: "text-emerald-700", bg: "bg-emerald-50"},
  CANCELLED:  { label: "Cancelado",      color: "text-slate-500",   bg: "bg-slate-100" },
  NO_SHOW:    { label: "Não compareceu", color: "text-orange-600",  bg: "bg-orange-50" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.SCHEDULED;
  return (
    <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full", cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  );
}

function dayLabel(dateKey: string) {
  const d = parseISO(dateKey);
  if (isToday(d)) return "Hoje";
  if (isTomorrow(d)) return "Amanhã";
  if (isBefore(d, startOfDay(new Date()))) return `${format(d, "EEE, dd/MM", { locale: ptBR })} (passado)`;
  return format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<FormData>({
    defaultValues: { duration: 60 },
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filterDate) { params.set("startDate", filterDate); params.set("endDate", filterDate); }
    if (filterStatus) params.set("status", filterStatus);

    try {
      const [apptRes, leadsRes] = await Promise.all([
        fetch(`/api/appointments?${params}`),
        fetch("/api/leads?all=true"),
      ]);
      if (apptRes.ok) {
        const d = await apptRes.json();
        setAppointments(Array.isArray(d) ? d : []);
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
  }, [filterDate, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function onSubmit(data: FormData) {
    const url = editingId ? `/api/appointments/${editingId}` : "/api/appointments";
    const method = editingId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, leadId: data.leadId || null }),
    });
    if (res.ok) { setShowModal(false); reset(); setEditingId(null); fetchData(); }
  }

  function openCreate() {
    setEditingId(null);
    reset({ duration: 60, title: "", leadId: "", notes: "", scheduledAt: "" });
    setShowModal(true);
  }

  function openEdit(a: Appointment) {
    setEditingId(a.id);
    reset({
      title: a.title,
      leadId: a.lead?.id ?? "",
      scheduledAt: format(parseISO(a.scheduledAt), "yyyy-MM-dd'T'HH:mm"),
      duration: a.duration,
      notes: a.notes ?? "",
    });
    setShowModal(true);
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchData();
  }

  async function deleteAppt(id: string) {
    if (!confirm("Excluir agendamento?")) return;
    await fetch(`/api/appointments/${id}`, { method: "DELETE" });
    fetchData();
  }

  // Group by date and sort
  const grouped = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = format(parseISO(a.scheduledAt), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  const sortedDays = Object.keys(grouped).sort();

  // Summary counts
  const today = appointments.filter((a) => isToday(parseISO(a.scheduledAt)));
  const scheduled = appointments.filter((a) => a.status === "SCHEDULED");
  const overdue = appointments.filter((a) => a.status === "SCHEDULED" && isPast(parseISO(a.scheduledAt)));

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}
            {overdue.length > 0 && <span className="text-red-500 font-medium"> · {overdue.length} atrasado{overdue.length > 1 ? "s" : ""}</span>}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo Agendamento
        </Button>
      </div>

      {/* Summary bar */}
      {!loading && appointments.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {[
            { label: "Hoje", value: today.length, color: "text-blue-700 bg-blue-50 border-blue-100" },
            { label: "Agendados", value: scheduled.length, color: "text-slate-700 bg-slate-50 border-slate-200" },
            { label: "Compareceram", value: appointments.filter((a) => a.status === "COMPLETED").length, color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
            { label: "Não compareceram", value: appointments.filter((a) => a.status === "NO_SHOW").length, color: "text-orange-600 bg-orange-50 border-orange-100" },
          ].map(({ label, value, color }) => (
            <div key={label} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border", color)}>
              <span className="font-bold text-sm">{value}</span> {label}
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <option value="">Todos os status</option>
          <option value="SCHEDULED">Agendado</option>
          <option value="COMPLETED">Compareceu</option>
          <option value="NO_SHOW">Não compareceu</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
        {(filterDate || filterStatus) && (
          <button onClick={() => { setFilterDate(""); setFilterStatus(""); }}
            className="text-sm text-slate-500 hover:text-slate-800 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            × Limpar filtros
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-16 bg-slate-50" />)}
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum agendamento encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Crie um novo agendamento pelo botão acima</p>
        </div>
      ) : (
        <div className="space-y-5">
          {sortedDays.map((dateKey) => {
            const items = grouped[dateKey].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
            const isPastDay = isBefore(parseISO(dateKey), startOfDay(new Date())) && !isToday(parseISO(dateKey));
            return (
              <div key={dateKey}>
                {/* Day header */}
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-xs font-bold uppercase tracking-wide",
                    isToday(parseISO(dateKey)) ? "text-blue-600" : isPastDay ? "text-slate-400" : "text-slate-600")}>
                    {dayLabel(dateKey)}
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs text-slate-400">{items.length}</span>
                </div>

                {/* Appointments */}
                <div className="space-y-1.5">
                  {items.map((appt) => {
                    const isOverdueAppt = isPast(parseISO(appt.scheduledAt)) && appt.status === "SCHEDULED";
                    const cfg = STATUS_CONFIG[appt.status] ?? STATUS_CONFIG.SCHEDULED;
                    return (
                      <div key={appt.id} className={cn(
                        "flex items-center gap-3 p-3 rounded-xl border transition-colors",
                        isOverdueAppt ? "border-orange-200 bg-orange-50/40" :
                        appt.status === "COMPLETED" ? "border-emerald-100 bg-emerald-50/20 opacity-75" :
                        appt.status === "CANCELLED" ? "border-slate-100 opacity-60" :
                        "border-slate-200 bg-white hover:border-slate-300",
                      )}>
                        {/* Time */}
                        <div className="flex-shrink-0 text-center w-12">
                          <p className={cn("text-sm font-bold leading-tight", isOverdueAppt ? "text-orange-600" : "text-slate-800")}>
                            {format(parseISO(appt.scheduledAt), "HH:mm")}
                          </p>
                          <p className="text-[10px] text-slate-400">{appt.duration}min</p>
                        </div>

                        {/* Divider */}
                        <div className={cn("w-0.5 self-stretch rounded-full flex-shrink-0", cfg.bg.replace("bg-", "bg-"))} style={{ backgroundColor: "currentColor" }} />
                        <div className={cn("w-1 self-stretch rounded-full flex-shrink-0", isOverdueAppt ? "bg-orange-400" : appt.status === "COMPLETED" ? "bg-emerald-400" : appt.status === "CANCELLED" ? "bg-slate-300" : "bg-blue-400")} />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900">{appt.title}</span>
                            <StatusBadge status={appt.status} />
                            {isOverdueAppt && (
                              <span className="text-[10px] text-orange-600 font-medium flex items-center gap-0.5">
                                <AlertCircle className="w-3 h-3" /> Atrasado
                              </span>
                            )}
                          </div>
                          {appt.lead && (
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-slate-500 flex items-center gap-1">
                                <User className="w-3 h-3" /> {appt.lead.name}
                              </span>
                              <span className="text-xs text-slate-400 flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {appt.lead.phone}
                              </span>
                            </div>
                          )}
                          {appt.notes && <p className="text-xs text-slate-400 mt-0.5 truncate">{appt.notes}</p>}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          {appt.status === "SCHEDULED" && (
                            <>
                              <button onClick={() => updateStatus(appt.id, "COMPLETED")} title="Compareceu"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => updateStatus(appt.id, "NO_SHOW")} title="Não compareceu"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                                <XCircle className="w-4 h-4" />
                              </button>
                              <button onClick={() => updateStatus(appt.id, "CANCELLED")} title="Cancelar"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          <button onClick={() => openEdit(appt)} title="Remarcar / Editar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          {appt.lead && (
                            <Link href={`/leads/${appt.lead.id}`} title="Abrir lead"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditingId(null); }}
        title={editingId ? "Remarcar / Editar Agendamento" : "Novo Agendamento"} size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="label">Título *</label>
            <input {...register("title", { required: true })} className="input-field" placeholder="Ex: Consulta Rinoplastia" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data e Hora *</label>
              <input {...register("scheduledAt", { required: true })} type="datetime-local" className="input-field" />
            </div>
            <div>
              <label className="label">Duração (min)</label>
              <input {...register("duration", { valueAsNumber: true })} type="number" min={15} step={15} className="input-field" />
            </div>
          </div>
          <div>
            <label className="label">Lead vinculado</label>
            <select {...register("leadId")} className="input-field">
              <option value="">Selecionar lead (opcional)</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>{l.name} — {l.phone}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea {...register("notes")} rows={2} className="input-field resize-none" placeholder="Informações adicionais..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={isSubmitting}>{editingId ? "Salvar" : "Criar Agendamento"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

