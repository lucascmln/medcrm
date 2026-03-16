"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Phone, Mail, MapPin, User, Stethoscope,
  MessageSquare, Clock, Edit2, AlertCircle, Tag, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { LeadFormModal } from "@/components/leads/LeadFormModal";
import { Modal } from "@/components/ui/modal";
import { formatDate, formatDateTime, formatPhone, formatCurrency, timeAgo, getInitials, avatarColor, cn } from "@/lib/utils";
import { getTrafficSourceConfig } from "@/lib/traffic-source-ui";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Lead criado",
  IMPORTED: "Lead importado",
  WEBHOOK_CREATED: "Lead recebido via webhook",
  STAGE_CHANGED: "Etapa alterada",
  NOTE_ADDED: "Observação adicionada",
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [stages, setStages] = useState<any[]>([]);
  const [lossReasons, setLossReasons] = useState<any[]>([]);
  const [newStageId, setNewStageId] = useState("");
  const [changingStage, setChangingStage] = useState(false);
  const [showLostModal, setShowLostModal] = useState(false);
  const [lossReasonId, setLossReasonId] = useState("");
  const [markingLost, setMarkingLost] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function fetchLead() {
    try {
      const res = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      if (!res.ok || data?.error) {
        setLead(null);
      } else {
        setLead(data);
        setNewStageId(data.funnelStageId ?? "");
      }
    } catch {
      setLead(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLead();
    fetch("/api/funnel-stages")
      .then((r) => r.json())
      .then((d) => setStages(Array.isArray(d) ? d : []))
      .catch(() => {});
    fetch("/api/loss-reasons")
      .then((r) => r.json())
      .then((d) => setLossReasons(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [id]);

  async function submitNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    await fetch(`/api/leads/${id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote }),
    });
    setNewNote("");
    setAddingNote(false);
    fetchLead();
  }

  async function changeStage() {
    if (!newStageId || newStageId === lead?.funnelStageId) return;
    const stage = stages.find((s) => s.id === newStageId);
    if (stage?.isLost) { setShowLostModal(true); return; }

    setChangingStage(true);
    await fetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelStageId: newStageId }),
    });
    setChangingStage(false);
    fetchLead();
  }

  async function markLost() {
    setMarkingLost(true);
    await fetch(`/api/leads/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ funnelStageId: newStageId, lossReasonId: lossReasonId || null }),
    });
    setMarkingLost(false);
    setShowLostModal(false);
    fetchLead();
  }

  async function deleteLead() {
    setDeleting(true);
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    router.push("/leads");
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 h-96 bg-slate-100 rounded-xl" />
            <div className="h-96 bg-slate-100 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!lead || lead.error) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-400">Lead não encontrado</p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.push("/leads")}>
          Voltar para Leads
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/leads")} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
            <ArrowLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div>
            <h1 className="page-title">{lead.name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">Lead desde {formatDate(lead.createdAt)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>
            <Edit2 className="w-3.5 h-3.5" /> Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteModal(true)}>
            <Trash2 className="w-3.5 h-3.5" /> Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-5">
          {/* Lead Info Card */}
          <div className="card p-5">
            <div className="flex items-start gap-4">
              <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0", avatarColor(lead.name))}>
                {getInitials(lead.name)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-semibold text-slate-900">{lead.name}</h2>
                  {lead.slaBreached && (
                    <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                      <AlertCircle className="w-3 h-3" /> SLA vencido
                    </span>
                  )}
                  {lead.trafficSource && (() => {
                    const ts = getTrafficSourceConfig(lead.trafficSource);
                    return (
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", ts.bg, ts.text)}>
                        {ts.label}
                      </span>
                    );
                  })()}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{formatPhone(lead.phone)}</span>
                  {lead.email && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />{lead.email}</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  <StatusBadge stage={lead.funnelStage} />
                  {lead.tags?.map((lt: any) => (
                    <Badge key={lt.tagId} color={lt.tag.color}>{lt.tag.name}</Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-slate-100">
              <InfoItem icon={<MapPin className="w-3.5 h-3.5" />} label="Canal" value={lead.source?.name} />
              <InfoItem icon={<Tag className="w-3.5 h-3.5" />} label="Suborigem" value={lead.subsource?.name} />
              <InfoItem icon={<Tag className="w-3.5 h-3.5" />} label="Campanha" value={lead.campaign?.name} />
              <InfoItem icon={<Stethoscope className="w-3.5 h-3.5" />} label="Médico" value={lead.doctor?.name} />
              <InfoItem icon={<MapPin className="w-3.5 h-3.5" />} label="Unidade" value={lead.unit?.name} />
              <InfoItem icon={<User className="w-3.5 h-3.5" />} label="Atendente" value={lead.assignedTo?.name} />
              <InfoItem icon={<Stethoscope className="w-3.5 h-3.5" />} label="Procedimento" value={lead.procedure} />
              <InfoItem icon={<Tag className="w-3.5 h-3.5" />} label="Valor Potencial" value={lead.potentialValue ? formatCurrency(lead.potentialValue) : null} />
              {lead.lossReason && (
                <InfoItem icon={<AlertCircle className="w-3.5 h-3.5" />} label="Motivo da Perda" value={lead.lossReason.name} />
              )}
            </div>

            {lead.observations && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <p className="text-xs font-medium text-slate-500 mb-1">Observações</p>
                <p className="text-sm text-slate-700">{lead.observations}</p>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-400" /> Observações & Contatos
            </h3>

            <div className="flex gap-3 mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Adicionar observação sobre o atendimento..."
                rows={2}
                className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <Button size="sm" onClick={submitNote} loading={addingNote} disabled={!newNote.trim()}>
                Adicionar
              </Button>
            </div>

            <div className="space-y-3">
              {lead.notes?.map((note: any) => (
                <div key={note.id} className="flex gap-3">
                  <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5", avatarColor(note.user?.name ?? "?"))}>
                    {getInitials(note.user?.name ?? "?")}
                  </div>
                  <div className="flex-1 bg-slate-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-slate-700">{note.user?.name ?? "Sistema"}</span>
                      <span className="text-[10px] text-slate-400">{formatDateTime(note.createdAt)}</span>
                    </div>
                    <p className="text-sm text-slate-600">{note.content}</p>
                  </div>
                </div>
              ))}
              {lead.notes?.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Nenhuma observação registrada</p>
              )}
            </div>
          </div>

          {/* History */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" /> Histórico
            </h3>
            <div className="relative">
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-slate-200" />
              <div className="space-y-4">
                {lead.history?.map((h: any) => (
                  <div key={h.id} className="flex gap-4 relative">
                    <div className="w-7 h-7 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center flex-shrink-0 z-10">
                      <div className="w-2 h-2 rounded-full bg-primary-500" />
                    </div>
                    <div className="flex-1 pb-2">
                      <p className="text-sm font-medium text-slate-700">
                        {ACTION_LABELS[h.action] ?? h.action}
                      </p>
                      {h.description && <p className="text-xs text-slate-400 mt-0.5">{h.description}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-slate-400">{formatDateTime(h.createdAt)}</span>
                        {h.user && <span className="text-[11px] text-slate-400">· {h.user.name}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Stage Change */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-slate-900 mb-3">Mover Etapa</h3>
            <select
              value={newStageId}
              onChange={(e) => setNewStageId(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
            >
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <Button
              className="w-full"
              onClick={changeStage}
              loading={changingStage}
              disabled={newStageId === lead.funnelStageId}
            >
              Confirmar Mudança
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="card p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900">Linha do Tempo</h3>
            <StatRow label="Entrada" value={formatDate(lead.createdAt)} />
            <StatRow label="1º Contato" value={lead.firstContactAt ? formatDateTime(lead.firstContactAt) : "Não realizado"} warn={!lead.firstContactAt} />
            <StatRow label="Agendamento" value={lead.scheduledAt ? formatDateTime(lead.scheduledAt) : "—"} />
            <StatRow label="Comparecimento" value={lead.attendedAt ? formatDateTime(lead.attendedAt) : "—"} />
            <StatRow label="Fechamento" value={lead.closedAt ? formatDateTime(lead.closedAt) : "—"} />
            {lead.lostAt && <StatRow label="Perda" value={formatDateTime(lead.lostAt)} warn />}
          </div>

          {/* Tracking */}
          {(lead.trafficSource || lead.utmSource || lead.gclid || lead.fbclid || lead.landingPage) && (
            <div className="card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900">Rastreamento Digital</h3>
              {lead.trafficSource && (() => {
                const ts = getTrafficSourceConfig(lead.trafficSource);
                return (
                  <div>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-1">Origem Classificada</p>
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", ts.bg, ts.text)}>{ts.label}</span>
                  </div>
                );
              })()}
              <div className="space-y-1.5 pt-1">
                {[
                  ["utm_source",   lead.utmSource],
                  ["utm_medium",   lead.utmMedium],
                  ["utm_campaign", lead.utmCampaign],
                  ["utm_content",  lead.utmContent],
                  ["utm_term",     lead.utmTerm],
                  ["gclid",        lead.gclid],
                  ["fbclid",       lead.fbclid],
                  ["fbc",          lead.fbc],
                  ["fbp",          lead.fbp],
                  ["referrer",     lead.referrer],
                ].filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="flex gap-2 items-start">
                    <span className="text-[10px] font-mono text-slate-400 flex-shrink-0 mt-0.5">{k}</span>
                    <span className="text-[11px] text-slate-600 break-all">{v}</span>
                  </div>
                ))}
                {lead.landingPage && (
                  <div className="pt-1 border-t border-slate-100">
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-0.5">Landing Page</p>
                    <p className="text-[11px] text-slate-600 break-all">{lead.landingPage}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <LeadFormModal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        onSuccess={() => { setShowEdit(false); fetchLead(); }}
        leadId={id}
      />

      <Modal open={showLostModal} onClose={() => setShowLostModal(false)} title="Marcar como Perdido" size="sm">
        <div className="p-5">
          <p className="text-sm text-slate-600 mb-4">Selecione o motivo da perda deste lead:</p>
          <select
            value={lossReasonId}
            onChange={(e) => setLossReasonId(e.target.value)}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 mb-4"
          >
            <option value="">Não informar motivo</option>
            {lossReasons.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowLostModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={markLost} loading={markingLost}>Confirmar Perda</Button>
          </div>
        </div>
      </Modal>

      <Modal open={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Excluir Lead" size="sm">
        <div className="p-5">
          <p className="text-sm text-slate-600 mb-4">
            Tem certeza que deseja excluir o lead <strong>{lead.name}</strong>? Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancelar</Button>
            <Button variant="danger" onClick={deleteLead} loading={deleting}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mb-0.5 flex items-center gap-1">
        {icon} {label}
      </p>
      <p className="text-sm text-slate-700 font-medium">{value}</p>
    </div>
  );
}

function StatRow({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-2">
      <span className="text-xs text-slate-500 flex-shrink-0">{label}</span>
      <span className={cn("text-xs font-medium text-right", warn ? "text-amber-600" : "text-slate-700")}>
        {value}
      </span>
    </div>
  );
}
