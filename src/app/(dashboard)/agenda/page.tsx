"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Calendar, Clock, User, Phone, Edit2, Trash2, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useForm } from "react-hook-form";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

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
  SCHEDULED: { label: "Agendado", color: "text-blue-700", bg: "bg-blue-50" },
  COMPLETED: { label: "Compareceu", color: "text-emerald-700", bg: "bg-emerald-50" },
  CANCELLED: { label: "Cancelado", color: "text-red-600", bg: "bg-red-50" },
  NO_SHOW: { label: "Não compareceu", color: "text-orange-600", bg: "bg-orange-50" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.SCHEDULED;
  return (
    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", cfg.color, cfg.bg)}>
      {cfg.label}
    </span>
  );
}

function formatScheduledAt(dt: string) {
  const d = parseISO(dt);
  if (isToday(d)) return `Hoje às ${format(d, "HH:mm")}`;
  if (isTomorrow(d)) return `Amanhã às ${format(d, "HH:mm")}`;
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
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

    const [apptRes, leadsRes] = await Promise.all([
      fetch(`/api/appointments?${params}`),
      fetch("/api/leads?all=true"),
    ]);
    if (apptRes.ok) setAppointments(await apptRes.json());
    if (leadsRes.ok) {
      const data = await leadsRes.json();
      setLeads(data.leads ?? []);
    }
    setLoading(false);
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

  function openCreate() { setEditingId(null); reset({ duration: 60, title: "", leadId: "", notes: "", scheduledAt: "" }); setShowModal(true); }

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

  const grouped = appointments.reduce<Record<string, Appointment[]>>((acc, a) => {
    const key = format(parseISO(a.scheduledAt), "yyyy-MM-dd");
    if (!acc[key]) acc[key] = [];
    acc[key].push(a);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Agenda</h1>
          <p className="text-sm text-slate-500 mt-0.5">{appointments.length} agendamento{appointments.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo Agendamento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={filterDate}
          onChange={(e) => setFilterDate(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Todos os status</option>
          <option value="SCHEDULED">Agendado</option>
          <option value="COMPLETED">Compareceu</option>
          <option value="NO_SHOW">Não compareceu</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
        {(filterDate || filterStatus) && (
          <button onClick={() => { setFilterDate(""); setFilterStatus(""); }} className="text-sm text-slate-500 hover:text-slate-800 underline">
            Limpar filtros
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse h-20 bg-slate-50" />)}
        </div>
      ) : appointments.length === 0 ? (
        <div className="card p-12 text-center">
          <Calendar className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-500">Nenhum agendamento encontrado</p>
          <p className="text-xs text-slate-400 mt-1">Crie um novo agendamento pelo botão acima</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([dateKey, items]) => {
              const d = parseISO(dateKey);
              const label = isToday(d) ? "Hoje" : isTomorrow(d) ? "Amanhã" : format(d, "EEEE, dd 'de' MMMM", { locale: ptBR });
              return (
                <div key={dateKey}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{label}</span>
                    <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{items.length}</span>
                  </div>
                  <div className="space-y-2">
                    {items.map((appt) => {
                      const overdue = isPast(parseISO(appt.scheduledAt)) && appt.status === "SCHEDULED";
                      return (
                        <div key={appt.id} className={cn("card p-4 flex items-start gap-4", overdue && "border-orange-200 bg-orange-50/30")}>
                          <div className="flex-shrink-0 flex flex-col items-center">
                            <Clock className={cn("w-4 h-4 mb-0.5", overdue ? "text-orange-500" : "text-slate-400")} />
                            <span className="text-xs font-semibold text-slate-700">{format(parseISO(appt.scheduledAt), "HH:mm")}</span>
                            <span className="text-[10px] text-slate-400">{appt.duration}min</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900">{appt.title}</span>
                              <StatusBadge status={appt.status} />
                              {overdue && <span className="text-[10px] text-orange-600 font-medium flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> Atrasado</span>}
                            </div>
                            {appt.lead && (
                              <div className="flex items-center gap-3 mt-1.5">
                                <span className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> {appt.lead.name}</span>
                                <span className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" /> {appt.lead.phone}</span>
                              </div>
                            )}
                            {appt.notes && <p className="text-xs text-slate-400 mt-1 truncate">{appt.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {appt.status === "SCHEDULED" && (
                              <>
                                <button onClick={() => updateStatus(appt.id, "COMPLETED")} title="Compareceu" className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                  <CheckCircle className="w-4 h-4" />
                                </button>
                                <button onClick={() => updateStatus(appt.id, "NO_SHOW")} title="Não compareceu" className="p-1.5 rounded-lg text-slate-400 hover:text-orange-500 hover:bg-orange-50 transition-colors">
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button onClick={() => openEdit(appt)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => deleteAppt(appt.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditingId(null); }} title={editingId ? "Editar Agendamento" : "Novo Agendamento"} size="md">
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
            <textarea {...register("notes")} rows={3} className="input-field resize-none" placeholder="Informações adicionais..." />
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
