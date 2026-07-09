"use client";

import { useEffect, useRef } from "react";
import { getInitials, avatarColor, formatPhone, cn } from "@/lib/utils";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";
import type { WaConversationDetail, WaMessage } from "./types";

export function ConversationThread({
  conversation,
  messages,
  canReply,
  onSend,
}: {
  conversation: WaConversationDetail;
  messages: WaMessage[];
  canReply: boolean;
  onSend: (text: string) => void | Promise<void>;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const name = conversation.contactName || conversation.lead?.name || formatPhone(conversation.phone);
  const stage = conversation.lead?.funnelStage;

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
        {stage && (
          <span
            className="ml-auto px-2 py-1 rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: stage.color }}
          >
            {stage.name}
          </span>
        )}
      </div>

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
