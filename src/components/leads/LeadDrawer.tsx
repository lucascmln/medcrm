"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  X, ExternalLink, Phone, Mail, Stethoscope, Clock, Bell, CalendarDays,
  Plus, Loader2, MessageSquare, MessageCircle, AlertCircle, Trash2,
} from "lucide-react";
import { cn, formatPhone, formatDate, formatDateTime, timeAgo, getInitials, avatarColor } from "@/lib/utils";
import { getTrafficSourceConfig } from "@/lib/traffic-source-ui";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";

interface LeadDrawerProps {
  leadId: string | null;
  onClose: () => void;
  /** Called after a mutation (note/follow-up/appointment) so parents can refresh. */
  onChanged?: () => void;
}

type PanelForm = null | "note" | "followup" | "appointment";

export function LeadDrawer({ leadId, onClose, onChanged }: LeadDrawerProps) {
  const [lead, setLead] = useState<any>(null);
  const [followUps, setFollowUps] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [waConversationId, setWaConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<PanelForm>(null);
  const [note, setNote] = useState("");
  const [fuDate, setFuDate] = useState("");
  const [fuNotes, setFuNotes] = useState("");
  const [apptTitle, setApptTitle] = useState("");
  const [apptDate, setApptDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const [lRes, fRes, aRes, wRes] = await Promise.all([
        fetch(`/api/leads/${leadId}`),
        fetch(`/api/follow-ups?leadId=${leadId}`),
        fetch(`/api/appointments?leadId=${leadId}`),
        fetch(`/api/whatsapp/lead-conversation?leadId=${leadId}`),
      ]);
      if (!lRes.ok) {
        setError(lRes.status === 404 ? "Lead não encontrado." : "Não foi possível carregar o lead.");
        setLead(null);
        return;
      }
      setLead(await lRes.json());
      setFollowUps(fRes.ok ? await fRes.json() : []);
      setAppointments(aRes.ok ? await aRes.json() : []);
      setWaConversationId(wRes.ok ? (await wRes.json())?.conversationId ?? null : null);
    } catch {
      setError("Erro de conexão ao carregar o lead.");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (leadId) {
      setForm(null); setNote(""); setFuDate(""); setFuNotes(""); setApptTitle(""); setApptDate("");
      fetchAll();
    }
  }, [leadId, fetchAll]);

  // Close on Esc
  useEffect(() => {
    if (!leadId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [leadId, onClose]);

  async function saveNote() {
    if (!leadId || !note.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/leads/${leadId}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: note }),
    });
    setBusy(false);
    if (res.ok) { setNote(""); setForm(null); fetchAll(); onChanged?.(); toast.success("Observação salva"); }
    else toast.error("Erro ao salvar observação");
  }

  async function createFollowUp() {
    if (!leadId || !fuDate) return;
    setBusy(true);
    const res = await fetch(`/api/follow-ups`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, dueAt: fuDate, notes: fuNotes }),
    });
    setBusy(false);
    if (res.ok) { setFuDate(""); setFuNotes(""); setForm(null); fetchAll(); onChanged?.(); toast.success("Follow-up criado"); }
    else toast.error("Erro ao criar follow-up");
  }

  async function createAppointment() {
    if (!leadId || !apptDate) return;
    setBusy(true);
    const res = await fetch(`/api/appointments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId, scheduledAt: apptDate, duration: 60, title: apptTitle || `Consulta — ${lead?.name ?? ""}` }),
    });
    setBusy(false);
    if (res.ok) { setApptTitle(""); setApptDate(""); setForm(null); fetchAll(); onChanged?.(); toast.success("Agendamento criado"); }
    else toast.error("Erro ao criar agendamento");
  }

  async function deleteLead() {
    if (!leadId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Lead excluído com sucesso.");
      setConfirmDelete(false);
      onChanged?.();
      onClose();
    } catch {
      toast.error("Não foi possível excluir o lead.");
    } finally {
      setDeleting(false);
    }
  }

  if (!leadId) return null;

  const ts = lead?.trafficSource ? getTrafficSourceConfig(lead.trafficSource) : null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200">
          {loading || !lead ? (
            <div className="h-10 flex-1 bg-slate-100 rounded animate-pulse" />
          ) : (
            <div className="flex items-center gap-3 min-w-0">
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0", avatarColor(lead.name))}>
                {getInitials(lead.name)}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 truncate">{lead.name}</p>
                <div className="mt-0.5"><StatusBadge stage={lead.funnelStage} /></div>
              </div>
            </div>
          )}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Link href={`/leads/${leadId}`} title="Abrir página completa"
              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 transition-colors">
              <ExternalLink className="w-4 h-4" />
            </Link>
            <button onClick={() => setConfirmDelete(true)} title="Excluir lead" disabled={!lead}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-40">
              <Trash2 className="w-4 h-4" />
            </button>
            <button onClick={onClose} title="Fechar (Esc)"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Confirmação de exclusão */}
        <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Excluir lead" size="sm">
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600">
              Tem certeza que deseja excluir este lead? Essa ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancelar</Button>
              <Button variant="danger" onClick={deleteLead} loading={deleting}>
                <Trash2 className="w-4 h-4" /> Excluir lead
              </Button>
            </div>
          </div>
        </Modal>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && !lead ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-9 h-9 text-red-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">{error}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={fetchAll}>Tentar novamente</Button>
            </div>
          ) : lead ? (
            <div className="p-4 space-y-5">
              {/* Contact + details */}
              <div className="grid grid-cols-1 gap-2">
                <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Telefone" value={formatPhone(lead.phone)} />
                {lead.email && <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="E-mail" value={lead.email} />}
                <InfoRow icon={<span className="w-3.5 h-3.5 inline-flex items-center justify-center">◎</span>} label="Origem"
                  value={ts ? ts.label : (lead.source?.name ?? "—")} />
                {lead.procedure && <InfoRow icon={<Stethoscope className="w-3.5 h-3.5" />} label="Procedimento" value={lead.procedure} />}
                {lead.doctor?.name && <InfoRow icon={<Stethoscope className="w-3.5 h-3.5" />} label="Médico" value={lead.doctor.name} />}
                <InfoRow icon={<Clock className="w-3.5 h-3.5" />} label="Entrada" value={formatDate(lead.createdAt)} />
              </div>

              {/* Quick actions */}
              <div className="flex flex-wrap gap-2">
                <ActionChip active={form === "note"} onClick={() => setForm(form === "note" ? null : "note")} icon={<MessageSquare className="w-3.5 h-3.5" />} label="Observação" />
                <ActionChip active={form === "followup"} onClick={() => setForm(form === "followup" ? null : "followup")} icon={<Bell className="w-3.5 h-3.5" />} label="Follow-up" />
                <ActionChip active={form === "appointment"} onClick={() => setForm(form === "appointment" ? null : "appointment")} icon={<CalendarDays className="w-3.5 h-3.5" />} label="Agendar" />
              </div>

              {/* Conversa WhatsApp vinculada */}
              {waConversationId ? (
                <Link
                  href={`/whatsapp?conversation=${waConversationId}`}
                  className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm font-medium rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" /> Abrir conversa WhatsApp
                </Link>
              ) : (
                <div className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                  <MessageCircle className="w-3.5 h-3.5" /> Nenhuma conversa WhatsApp vinculada
                </div>
              )}

              {form === "note" && (
                <div className="space-y-2">
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Escreva uma observação…"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none" />
                  <div className="flex justify-end"><Button size="sm" onClick={saveNote} loading={busy} disabled={!note.trim()}>Salvar</Button></div>
                </div>
              )}
              {form === "followup" && (
                <div className="space-y-2">
                  <input type="datetime-local" value={fuDate} onChange={(e) => setFuDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input value={fuNotes} onChange={(e) => setFuNotes(e.target.value)} placeholder="O que precisa ser feito?"
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <div className="flex justify-end"><Button size="sm" onClick={createFollowUp} loading={busy} disabled={!fuDate}>Criar follow-up</Button></div>
                </div>
              )}
              {form === "appointment" && (
                <div className="space-y-2">
                  <input value={apptTitle} onChange={(e) => setApptTitle(e.target.value)} placeholder={`Consulta — ${lead.name}`}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <input type="datetime-local" value={apptDate} onChange={(e) => setApptDate(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  <div className="flex justify-end"><Button size="sm" onClick={createAppointment} loading={busy} disabled={!apptDate}>Agendar</Button></div>
                </div>
              )}

              {/* Follow-ups */}
              <Section title="Follow-ups" count={followUps.length} icon={<Bell className="w-3.5 h-3.5 text-orange-400" />}>
                {followUps.length === 0 ? <Empty text="Nenhum follow-up" /> : followUps.slice(0, 5).map((f) => (
                  <div key={f.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600">{formatDateTime(f.dueAt)}</span>
                    <span className={cn("font-medium px-1.5 py-0.5 rounded",
                      f.status === "PENDING" ? "text-orange-600 bg-orange-50" : f.status === "COMPLETED" ? "text-emerald-600 bg-emerald-50" : "text-slate-400 bg-slate-50")}>
                      {f.status === "PENDING" ? "Pendente" : f.status === "COMPLETED" ? "Concluído" : "Cancelado"}
                    </span>
                  </div>
                ))}
              </Section>

              {/* Appointments */}
              <Section title="Agendamentos" count={appointments.length} icon={<CalendarDays className="w-3.5 h-3.5 text-blue-400" />}>
                {appointments.length === 0 ? <Empty text="Nenhum agendamento" /> : appointments.slice(0, 5).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 last:border-0">
                    <span className="text-slate-600 truncate mr-2">{a.title}</span>
                    <span className="text-slate-400 flex-shrink-0">{formatDateTime(a.scheduledAt)}</span>
                  </div>
                ))}
              </Section>

              {/* Timeline */}
              <Section title="Histórico" count={lead.history?.length ?? 0} icon={<Clock className="w-3.5 h-3.5 text-slate-400" />}>
                {(!lead.history || lead.history.length === 0) ? <Empty text="Sem histórico" /> : lead.history.slice(0, 8).map((h: any) => (
                  <div key={h.id} className="flex gap-2 py-1.5 border-b border-slate-50 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-300 mt-1.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-600">{h.description}</p>
                      <p className="text-[10px] text-slate-400">{timeAgo(h.createdAt)}{h.user?.name ? ` · ${h.user.name}` : ""}</p>
                    </div>
                  </div>
                ))}
              </Section>

              {/* Notes */}
              <Section title="Observações" count={lead.notes?.length ?? 0} icon={<MessageSquare className="w-3.5 h-3.5 text-slate-400" />}>
                {(!lead.notes || lead.notes.length === 0) ? <Empty text="Nenhuma observação" /> : lead.notes.slice(0, 6).map((n: any) => (
                  <div key={n.id} className="py-1.5 border-b border-slate-50 last:border-0">
                    <p className="text-xs text-slate-600">{n.content}</p>
                    <p className="text-[10px] text-slate-400">{timeAgo(n.createdAt)}{n.user?.name ? ` · ${n.user.name}` : ""}</p>
                  </div>
                ))}
              </Section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-slate-400 flex-shrink-0">{icon}</span>
      <span className="text-slate-400 w-24 flex-shrink-0 text-xs">{label}</span>
      <span className="text-slate-700 font-medium truncate">{value}</span>
    </div>
  );
}

function ActionChip({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={cn("inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors",
        active ? "border-primary-300 bg-primary-50 text-primary-700" : "border-slate-200 text-slate-600 hover:bg-slate-50")}>
      {icon} {label}
    </button>
  );
}

function Section({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{title}</span>
        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{count}</span>
      </div>
      <div className="pl-1">{children}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-slate-400 py-1">{text}</p>;
}
