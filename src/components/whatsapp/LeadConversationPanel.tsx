"use client";

import Link from "next/link";
import { ExternalLink, Bell, CalendarPlus, Mail, Phone, Tag, MessageSquare } from "lucide-react";
import { cn, getInitials, avatarColor, formatPhone, timeAgo } from "@/lib/utils";
import type { WaConversationDetail, WaStageRef } from "./types";

export function LeadConversationPanel({
  conversation,
  stages,
  changingStage,
  onChangeStage,
}: {
  conversation: WaConversationDetail;
  stages: WaStageRef[];
  changingStage: boolean;
  onChangeStage: (stageId: string) => void;
}) {
  const lead = conversation.lead;
  const name = conversation.contactName || lead?.name || formatPhone(conversation.phone);

  return (
    <div className="hidden lg:flex flex-col h-full min-h-0 w-80 flex-shrink-0 border-l border-slate-200 bg-white overflow-y-auto">
      {/* Cabeçalho do lead */}
      <div className="p-5 border-b border-slate-100 flex flex-col items-center text-center">
        <div
          className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-lg font-semibold text-white",
            avatarColor(name)
          )}
        >
          {getInitials(name)}
        </div>
        <p className="mt-3 text-base font-semibold text-slate-800">{name}</p>
        <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
          <Phone className="w-3 h-3" /> {formatPhone(conversation.phone)}
        </p>
        {lead?.email && (
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Mail className="w-3 h-3" /> {lead.email}
          </p>
        )}
        <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          <MessageSquare className="w-3 h-3" /> Origem: WhatsApp
        </span>
      </div>

      {/* Etapa do funil */}
      <div className="p-4 border-b border-slate-100">
        <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1">
          <Tag className="w-3 h-3" /> Etapa do funil
        </label>
        <select
          value={lead?.funnelStageId ?? ""}
          disabled={!lead || changingStage}
          onChange={(e) => onChangeStage(e.target.value)}
          className="mt-1.5 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/40 disabled:opacity-50"
        >
          {!lead && <option value="">Sem lead vinculado</option>}
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Ações */}
      {lead && (
        <div className="p-4 border-b border-slate-100 space-y-2">
          <Link
            href={`/leads?lead=${lead.id}`}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" /> Abrir lead completo
          </Link>
          <Link
            href={`/follow-up?leadId=${lead.id}`}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Bell className="w-4 h-4" /> Criar follow-up
          </Link>
          <Link
            href={`/agenda?leadId=${lead.id}`}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <CalendarPlus className="w-4 h-4" /> Criar agendamento
          </Link>
        </div>
      )}

      {/* Últimas atividades */}
      <div className="p-4">
        <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
          Últimas atividades
        </p>
        {lead?.history && lead.history.length > 0 ? (
          <ul className="space-y-2.5">
            {lead.history.map((h) => (
              <li key={h.id} className="text-xs">
                <p className="text-slate-600">{h.description ?? h.action}</p>
                <p className="text-[10px] text-slate-400">{timeAgo(h.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-slate-400">Nenhuma atividade registrada.</p>
        )}
      </div>
    </div>
  );
}
