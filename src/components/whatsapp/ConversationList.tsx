"use client";

import { Search, MessageCircle } from "lucide-react";
import { cn, getInitials, avatarColor, formatPhone, timeAgo } from "@/lib/utils";
import type { WaConversationSummary, WaFilter } from "./types";

const FILTERS: { key: WaFilter; label: string }[] = [
  { key: "open", label: "Abertas" },
  { key: "unread", label: "Não lidas" },
  { key: "all", label: "Todas" },
  { key: "closed", label: "Encerradas" },
];

export function ConversationList({
  conversations,
  selectedId,
  query,
  filter,
  loading,
  onQueryChange,
  onFilterChange,
  onSelect,
}: {
  conversations: WaConversationSummary[];
  selectedId: string | null;
  query: string;
  filter: WaFilter;
  loading: boolean;
  onQueryChange: (q: string) => void;
  onFilterChange: (f: WaFilter) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full min-h-0 w-full sm:w-80 md:w-96 flex-shrink-0 border-r border-slate-200 bg-white">
      {/* Busca */}
      <div className="p-3 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Buscar nome ou telefone…"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40"
          />
        </div>
        {/* Filtros */}
        <div className="flex gap-1 mt-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => onFilterChange(f.key)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors",
                filter === f.key
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {conversations.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center text-center h-full px-6 text-slate-400 gap-2">
            <MessageCircle className="w-8 h-8" />
            <p className="text-sm">Nenhuma conversa ainda.</p>
          </div>
        )}
        {conversations.map((c) => {
          const name = c.contactName || c.lead?.name || formatPhone(c.phone);
          const active = c.id === selectedId;
          return (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "w-full text-left flex gap-3 px-3 py-3 border-b border-slate-50 transition-colors",
                active ? "bg-primary-50" : "hover:bg-slate-50"
              )}
            >
              <div
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0",
                  avatarColor(name)
                )}
              >
                {getInitials(name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">
                    {timeAgo(c.lastMessageAt)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 truncate">{formatPhone(c.phone)}</p>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-slate-500 truncate">
                    {c.lastMessage ?? "—"}
                  </p>
                  {c.unreadCount > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unreadCount}
                    </span>
                  )}
                </div>
                {c.lead?.funnelStage && (
                  <span
                    className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-medium text-white"
                    style={{ backgroundColor: c.lead.funnelStage.color }}
                  >
                    {c.lead.funnelStage.name}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
