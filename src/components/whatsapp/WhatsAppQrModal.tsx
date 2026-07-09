"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2, CheckCircle2, Smartphone, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    const t = await res.text();
    return t.trim() ? (JSON.parse(t) as T) : null;
  } catch {
    return null;
  }
}

interface QrResponse {
  status: string;
  qrCodeBase64?: string | null;
  message?: string;
  error?: string;
}

export function WhatsAppQrModal({
  open,
  onClose,
  onConnected,
}: {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [state, setState] = useState<string>("loading");
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const load = useCallback(async () => {
    setError(null);
    // Cria/garante a instância e busca o QR (o endpoint cria na 1ª chamada).
    await fetch("/api/integrations/whatsapp-qr/create", { method: "POST" }).catch(() => {});
    const res = await fetch("/api/integrations/whatsapp-qr/qrcode");
    const data = await safeJson<QrResponse>(res);
    if (!res.ok || !data) {
      setState("error");
      setError(data?.error ?? "Não foi possível gerar o QR Code.");
      return;
    }
    setState(data.status);
    setQr(data.qrCodeBase64 ?? null);
    if (data.status === "connected") {
      stop();
      onConnected();
    }
  }, [onConnected, stop]);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    setState("loading");
    setQr(null);
    load();
    // Poll de status até conectar (Evolution). Em mock conecta na 1ª chamada.
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/integrations/whatsapp-qr/status");
      const data = await safeJson<{ status: string }>(res);
      if (data?.status === "connected") {
        setState("connected");
        stop();
        onConnected();
      } else if (data?.status === "qr_ready" || data?.status === "disconnected") {
        // Atualiza o QR periodicamente (expira ~ a cada 30s no WhatsApp)
        load();
      }
    }, 6000);
    return stop;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} title="Conectar WhatsApp" size="sm">
      <div className="flex flex-col items-center text-center gap-4 py-2">
        {state === "connected" ? (
          <>
            <CheckCircle2 className="w-14 h-14 text-emerald-500" />
            <p className="text-sm font-medium text-slate-700">WhatsApp conectado com sucesso!</p>
            <Button onClick={onClose}>Concluir</Button>
          </>
        ) : state === "error" ? (
          <>
            <AlertTriangle className="w-12 h-12 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
            <Button variant="secondary" onClick={load}>
              Tentar novamente
            </Button>
          </>
        ) : (
          <>
            <div className="w-56 h-56 flex items-center justify-center rounded-xl border border-slate-200 bg-white">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR Code WhatsApp" className="w-52 h-52" />
              ) : (
                <Loader2 className="w-8 h-8 text-slate-300 animate-spin" />
              )}
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p className="flex items-center justify-center gap-1 font-medium text-slate-700">
                <Smartphone className="w-4 h-4" /> Abra o WhatsApp no celular
              </p>
              <p>Toque em <b>Aparelhos conectados</b> → <b>Conectar aparelho</b></p>
              <p>e aponte a câmera para este QR Code.</p>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
