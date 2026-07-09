"use client";

import { useEffect, useRef } from "react";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { getInitials, avatarColor, formatPhone, cn } from "@/lib/utils";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import type { WaConversationDetail, WaMessage } from "./types";

export function ConversationThread({
  conversation,
  messages,
  canReply,
  onSend,
  onClose,
  onReopen,
}: {
  conversation: WaConversationDetail;
  messages: WaMessage[];
  canReply: boolean;
  onSend: (text: string) => void | Promise<void>;
  onClose: () => void;
  onReopen: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const name = conversation.contactName || conversation.lead?.name || formatPhone(conversation.phone);
  const stage = conversation.lead?.funnelStage;
  const isClosed = conversation.status === "CLOSED";

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="flex flex-col h-full min-h-0 flex-1 bg-slate-50">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 bg-white">
        <div
          className={cn(
            "w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0",
            avatarColor(name)
          )}
        >
          {getInitials(name)}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate">{name}</p>
          <p className="text-[11px] text-slate-400">{formatPhone(conversation.phone)}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {stage && (
            <span
              className="px-2 py-1 rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: stage.color }}
            >
              {stage.name}
            </span>
          )}
          {isClosed ? (
            <button
              onClick={onReopen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reabrir conversa
            </button>
          ) : (
            <button
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Fechar conversa
            </button>
          )}
        </div>
      </div>
      {isClosed && (
        <div className="px-4 py-1.5 text-center text-[11px] font-medium text-slate-500 bg-slate-100 border-b border-slate-200">
          Conversa encerrada — reabre automaticamente se o contato enviar nova mensagem.
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-slate-400">
            Nenhuma mensagem nesta conversa ainda.
          </div>
        ) : (
          messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <MessageComposer disabled={!canReply} onSend={onSend} />
    </div>
  );
}
