"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

export function MessageComposer({
  disabled,
  onSend,
}: {
  disabled?: boolean;
  onSend: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  async function submit() {
    const value = text.trim();
    if (!value || sending || disabled) return;
    setSending(true);
    setText("");
    try {
      await onSend(value);
    } finally {
      setSending(false);
      ref.current?.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="border-t border-slate-200 bg-white p-3">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={disabled}
          rows={1}
          placeholder={disabled ? "Conecte o WhatsApp para responder" : "Digite uma mensagem… (Enter envia, Shift+Enter quebra linha)"}
          className={cn(
            "flex-1 resize-none max-h-32 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm",
            "text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 focus:border-primary-400",
            "disabled:opacity-60"
          )}
        />
        <button
          onClick={submit}
          disabled={disabled || sending || !text.trim()}
          className={cn(
            "flex-shrink-0 h-11 w-11 rounded-xl flex items-center justify-center transition-colors",
            "bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed"
          )}
          title="Enviar"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
