"use client";

import { Wifi, WifiOff, QrCode, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { cn, formatPhone } from "@/lib/utils";
import type { WaConnectionStatus } from "./types";

export function WhatsAppConnectionBanner({
  status,
  onConnect,
  onRefresh,
}: {
  status: WaConnectionStatus | null;
  onConnect: () => void;
  onRefresh: () => void;
}) {
  // Provider ausente (nem Evolution nem mock)
  if (status && !status.providerConfigured) {
    return (
      <Bar tone="amber" icon={<AlertTriangle className="w-4 h-4" />}>
        <span>
          Provider WhatsApp QR não configurado. Configure{" "}
          <code className="font-mono text-[11px]">EVOLUTION_API_URL</code> e{" "}
          <code className="font-mono text-[11px]">EVOLUTION_API_KEY</code> (ou{" "}
          <code className="font-mono text-[11px]">WHATSAPP_QR_PROVIDER=mock</code> para testar).
        </span>
      </Bar>
    );
  }

  const s = status?.status ?? "disconnected";

  if (s === "connected") {
    return (
      <Bar tone="emerald" icon={<Wifi className="w-4 h-4" />}>
        <span>
          WhatsApp conectado
          {status?.phoneNumber ? ` — ${formatPhone(status.phoneNumber)}` : ""}
        </span>
        <RefreshButton onRefresh={onRefresh} />
      </Bar>
    );
  }

  if (s === "connecting" || s === "qr_ready") {
    return (
      <Bar tone="sky" icon={<Loader2 className="w-4 h-4 animate-spin" />}>
        <span>Aguardando conexão do WhatsApp…</span>
        <button onClick={onConnect} className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold underline">
          <QrCode className="w-3.5 h-3.5" /> Ver QR Code
        </button>
      </Bar>
    );
  }

  if (s === "error") {
    return (
      <Bar tone="red" icon={<AlertTriangle className="w-4 h-4" />}>
        <span>Erro na conexão{status?.lastError ? `: ${status.lastError}` : ""}.</span>
        <button onClick={onConnect} className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold underline">
          <QrCode className="w-3.5 h-3.5" /> Reconectar
        </button>
      </Bar>
    );
  }

  // disconnected / not_configured (mas provider disponível)
  return (
    <Bar tone="slate" icon={<WifiOff className="w-4 h-4" />}>
      <span>WhatsApp desconectado.</span>
      <button
        onClick={onConnect}
        className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1 text-xs font-semibold text-white hover:bg-primary-700"
      >
        <QrCode className="w-3.5 h-3.5" /> Conectar WhatsApp
      </button>
    </Bar>
  );
}

function RefreshButton({ onRefresh }: { onRefresh: () => void }) {
  return (
    <button onClick={onRefresh} className="ml-auto p-1 rounded hover:bg-black/5" title="Atualizar">
      <RefreshCw className="w-3.5 h-3.5" />
    </button>
  );
}

function Bar({
  tone,
  icon,
  children,
}: {
  tone: "emerald" | "sky" | "red" | "amber" | "slate";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const tones: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
    red: "bg-red-50 text-red-700 border-red-100",
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    slate: "bg-slate-50 text-slate-600 border-slate-200",
  };
  return (
    <div className={cn("flex items-center gap-2 px-4 py-2 text-sm border-b", tones[tone])}>
      {icon}
      <div className="flex-1 flex items-center gap-2">{children}</div>
    </div>
  );
}
