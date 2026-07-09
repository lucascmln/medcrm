"use client";

import { Check, CheckCheck, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WaMessage } from "./types";

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function StatusIcon({ status, failed, optimistic }: { status: string | null; failed?: boolean; optimistic?: boolean }) {
  if (failed) return <AlertCircle className="w-3 h-3 text-red-300" />;
  if (optimistic || status === "PENDING") return <Clock className="w-3 h-3 opacity-70" />;
  if (status === "READ") return <CheckCheck className="w-3 h-3 text-sky-200" />;
  if (status === "DELIVERED") return <CheckCheck className="w-3 h-3 opacity-80" />;
  return <Check className="w-3 h-3 opacity-80" />; // SENT
}

export function MessageBubble({ message }: { message: WaMessage }) {
  const outbound = message.direction === "OUTBOUND";
  return (
    <div className={cn("flex w-full", outbound ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm shadow-sm break-words whitespace-pre-wrap",
          outbound
            ? "bg-primary-600 text-white rounded-br-sm"
            : "bg-white text-slate-800 border border-slate-200 rounded-bl-sm"
        )}
      >
        <p className="leading-relaxed">{message.body}</p>
        <div
          className={cn(
            "mt-1 flex items-center gap-1 justify-end text-[10px]",
            outbound ? "text-white/80" : "text-slate-400"
          )}
        >
          <span>{formatTime(message.sentAt ?? message.createdAt)}</span>
          {outbound && (
            <StatusIcon status={message.status} failed={message.failed} optimistic={message.optimistic} />
          )}
        </div>
      </div>
    </div>
  );
}
