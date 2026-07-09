"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Smartphone, Wifi, WifiOff, RefreshCw, LogOut,
  CheckCircle2, AlertTriangle, Clock, Loader2,
  QrCode, Info, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Tipos ─────────────────────────────────────────────────────────────────────

type ConnectionStatus =
  | "disconnected"
  | "qr_ready"
  | "connecting"
  | "connected"
  | "error"
  | "not_configured";

interface StatusResponse {
  configured: boolean;
  providerConfigured: boolean;
  providerMode?: "evolution" | "mock" | "none";
  instanceName?: string;
  label?: string;
  status: ConnectionStatus;
  phoneNumber?: string | null;
  lastConnectedAt?: string | null;
  lastError?: string | null;
}

interface QrResponse {
  status: ConnectionStatus;
  qrCodeBase64?: string | null;
  qrCodeText?: string | null;
  instanceName?: string;
  phoneNumber?: string | null;
  message?: string;
  error?: string;
}

// ── Helpers visuais ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const cfg: Record<
    ConnectionStatus,
    { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }
  > = {
    connected:      { label: "Conectado",         color: "text-emerald-700 bg-emerald-50 border-emerald-200", Icon: CheckCircle2 },
    connecting:     { label: "Conectando...",      color: "text-blue-700 bg-blue-50 border-blue-200",         Icon: Loader2 },
    qr_ready:       { label: "Aguardando QR",      color: "text-amber-700 bg-amber-50 border-amber-200",      Icon: QrCode },
    disconnected:   { label: "Desconectado",       color: "text-slate-600 bg-slate-50 border-slate-200",      Icon: WifiOff },
    error:          { label: "Erro",               color: "text-red-700 bg-red-50 border-red-200",            Icon: AlertTriangle },
    not_configured: { label: "Não configurado",    color: "text-slate-500 bg-slate-50 border-slate-200",      Icon: AlertTriangle },
  };
  const { label, color, Icon } = cfg[status] ?? cfg.disconnected;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border", color)}>
      <Icon className={cn("w-3.5 h-3.5", status === "connecting" && "animate-spin")} />
      {label}
    </span>
  );
}

function formatDate(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch { return null; }
}

// ── Componente principal ──────────────────────────────────────────────────────

export function WhatsAppQrSettings() {
  const [statusData, setStatusData]   = useState<StatusResponse | null>(null);
  const [qrData, setQrData]           = useState<QrResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingQr, setLoadingQr]     = useState(false);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [loadingDisconnect, setLoadingDisconnect] = useState(false);
  const [error, setError]             = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showLogs, setShowLogs]       = useState(false);
  const [logs, setLogs]               = useState<string[]>([]);
  const [loadingSimulate, setLoadingSimulate] = useState(false);

  const addLog = (msg: string) =>
    setLogs((prev) => [`[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`, ...prev].slice(0, 50));

  // ── Carregar status ─────────────────────────────────────────────────────────
  const loadStatus = useCallback(async (silent = false) => {
    if (!silent) setLoadingStatus(true);
    setError(null);
    try {
      const res = await fetch("/api/integrations/whatsapp-qr/status");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StatusResponse = await res.json();
      setStatusData(data);
      if (!silent) addLog(`Status carregado: ${data.status}`);
    } catch (err: any) {
      setError("Não foi possível carregar o status da integração.");
      addLog(`Erro ao carregar status: ${err.message}`);
    } finally {
      if (!silent) setLoadingStatus(false);
    }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  // Auto-refresh quando aguardando QR ou conectando
  useEffect(() => {
    const status = statusData?.status;
    if (status !== "qr_ready" && status !== "connecting") return;
    const interval = setInterval(() => loadStatus(true), 5000);
    return () => clearInterval(interval);
  }, [statusData?.status, loadStatus]);

  // ── Criar instância ─────────────────────────────────────────────────────────
  async function handleCreate() {
    setLoadingCreate(true);
    setError(null);
    setQrData(null);
    addLog("Criando instância WhatsApp...");
    try {
      const res = await fetch("/api/integrations/whatsapp-qr/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "WhatsApp Principal" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      addLog(`Instância criada: ${data.instanceName} (${data.status})`);
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
      addLog(`Erro ao criar instância: ${err.message}`);
    } finally {
      setLoadingCreate(false);
    }
  }

  // ── Gerar QR Code ───────────────────────────────────────────────────────────
  async function handleGetQr() {
    setLoadingQr(true);
    setError(null);
    setQrData(null);
    addLog("Gerando QR Code...");
    try {
      const res = await fetch("/api/integrations/whatsapp-qr/qrcode");
      const data: QrResponse = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setQrData(data);
      addLog(`QR Code: status=${data.status} qr=${data.qrCodeBase64 ? "recebido" : "não recebido"}`);
      await loadStatus(true);
    } catch (err: any) {
      setError(err.message);
      addLog(`Erro ao gerar QR: ${err.message}`);
    } finally {
      setLoadingQr(false);
    }
  }

  // ── Desconectar ─────────────────────────────────────────────────────────────
  async function handleDisconnect() {
    if (!confirm("Deseja desconectar o WhatsApp? Você precisará escanear o QR Code novamente.")) return;
    setLoadingDisconnect(true);
    setError(null);
    setQrData(null);
    addLog("Desconectando WhatsApp...");
    try {
      const res = await fetch("/api/integrations/whatsapp-qr/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      addLog("WhatsApp desconectado com sucesso.");
      await loadStatus();
    } catch (err: any) {
      setError(err.message);
      addLog(`Erro ao desconectar: ${err.message}`);
    } finally {
      setLoadingDisconnect(false);
    }
  }

  // ── Teste (simulação de mensagem) ───────────────────────────────────────────
  async function handleTest() {
    addLog("Enviando mensagem de teste...");
    try {
      const res = await fetch("/api/webhooks/whatsapp-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "messages.upsert",
          instance: statusData?.instanceName ?? "test",
          data: {
            key: {
              remoteJid: "5511999887766@s.whatsapp.net",
              fromMe: false,
              id: `TEST_${Date.now()}`,
            },
            pushName: "Paciente Teste QR",
            message: { conversation: "Olá, vim pelo WhatsApp! Quero saber sobre harmonização facial." },
            messageType: "conversation",
            messageTimestamp: Math.floor(Date.now() / 1000),
          },
        }),
      });
      const data = await res.json();
      addLog(`Teste: leadId=${data.leadId ?? "?"} created=${data.created ?? "?"} phone=${data.phone ?? "?"}`);
    } catch (err: any) {
      addLog(`Erro no teste: ${err.message}`);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (loadingStatus) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const status = statusData?.status ?? "disconnected";
  const isConnected    = status === "connected";
  const isQrReady      = status === "qr_ready";
  const isConnecting   = status === "connecting";
  const isConfigured   = statusData?.configured;
  const providerOk     = statusData?.providerConfigured;

  return (
    <div className="space-y-4 max-w-lg">

      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-emerald-600" />
          WhatsApp QR
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Conecte um WhatsApp escaneando o QR Code. Mensagens recebidas viram leads automaticamente no funil.
        </p>
      </div>

      {/* Modo mock — teste sem WhatsApp real */}
      {statusData?.providerMode === "mock" && (
        <div className="rounded-xl border border-primary-200 bg-primary-50 p-4 text-xs text-primary-800 space-y-2">
          <p className="font-semibold flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Modo mock ativo (WHATSAPP_QR_PROVIDER=mock)
          </p>
          <p>
            Simule uma mensagem recebida para testar o fluxo completo: criação de lead,
            entrada no funil e conversa na aba <b>Mensagens WhatsApp</b>.
          </p>
          <Button
            size="sm"
            loading={loadingSimulate}
            onClick={async () => {
              setLoadingSimulate(true);
              try {
                const res = await fetch("/api/whatsapp/simulate", { method: "POST" });
                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                  addLog(`Mensagem simulada: lead ${data?.result?.leadId ?? "?"} (${data?.simulated?.phone ?? "?"})`);
                } else {
                  addLog(`Falha na simulação: ${data?.error ?? res.status}`);
                }
              } finally {
                setLoadingSimulate(false);
              }
            }}
          >
            <QrCode className="w-3.5 h-3.5" /> Simular mensagem recebida
          </Button>
        </div>
      )}

      {/* Aviso provider não configurado */}
      {!providerOk && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Provider não configurado
          </p>
          <p>
            Defina <code className="bg-amber-100 px-1 rounded">EVOLUTION_API_URL</code> e{" "}
            <code className="bg-amber-100 px-1 rounded">EVOLUTION_API_KEY</code> no servidor.
          </p>
          <p>
            Você pode registrar a integração agora e configurar o provider depois.
            O teste de mensagem funciona mesmo sem o provider.
          </p>
        </div>
      )}

      {/* Card de status */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              isConnected  ? "bg-emerald-50" :
              isQrReady    ? "bg-amber-50" :
              isConnecting ? "bg-blue-50" : "bg-slate-100"
            )}>
              {isConnected  ? <Wifi className="w-5 h-5 text-emerald-600" /> :
               isConnecting ? <Loader2 className="w-5 h-5 text-blue-500 animate-spin" /> :
                              <WifiOff className="w-5 h-5 text-slate-400" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                {statusData?.label ?? "WhatsApp QR"}
              </p>
              {statusData?.instanceName && (
                <p className="text-xs text-slate-400 font-mono">{statusData.instanceName}</p>
              )}
            </div>
          </div>
          <StatusBadge status={status} />
        </div>

        {/* Detalhes quando conectado */}
        {isConnected && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800 space-y-0.5">
            {statusData?.phoneNumber && (
              <p><span className="font-medium">Número:</span> {statusData.phoneNumber}</p>
            )}
            {statusData?.lastConnectedAt && (
              <p><span className="font-medium">Conectado em:</span> {formatDate(statusData.lastConnectedAt)}</p>
            )}
            <p className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Webhook ativo — mensagens geram leads automaticamente
            </p>
          </div>
        )}

        {/* Erro */}
        {status === "error" && statusData?.lastError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
            <span className="font-medium">Erro:</span> {statusData.lastError}
          </div>
        )}

        {/* Ações */}
        <div className="flex flex-wrap gap-2 pt-1">
          {!isConfigured && (
            <Button size="sm" loading={loadingCreate} onClick={handleCreate}>
              <Smartphone className="w-3.5 h-3.5" />
              Criar conexão
            </Button>
          )}

          {isConfigured && !isConnected && (
            <Button size="sm" loading={loadingQr} onClick={handleGetQr} disabled={!providerOk}>
              <QrCode className="w-3.5 h-3.5" />
              {isQrReady ? "Atualizar QR Code" : "Gerar QR Code"}
            </Button>
          )}

          {isConfigured && (
            <Button
              size="sm"
              variant="secondary"
              loading={loadingStatus}
              onClick={() => loadStatus()}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Atualizar status
            </Button>
          )}

          {isConfigured && (isConnected || isQrReady || isConnecting) && (
            <Button
              size="sm"
              variant="secondary"
              loading={loadingDisconnect}
              onClick={handleDisconnect}
              className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Desconectar
            </Button>
          )}
        </div>
      </div>

      {/* QR Code */}
      {(isQrReady || qrData) && (
        <div className="card p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <QrCode className="w-4 h-4" /> QR Code
          </p>

          {qrData?.status === "connected" ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              WhatsApp conectado com sucesso!
            </div>
          ) : qrData?.qrCodeBase64 ? (
            <div className="flex flex-col items-center gap-3">
              <div className="border-2 border-slate-200 rounded-xl p-3 bg-white shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData.qrCodeBase64}
                  alt="QR Code WhatsApp"
                  className="w-52 h-52 object-contain"
                />
              </div>
              <p className="text-xs text-slate-500 text-center">
                Escaneie o código acima com o WhatsApp do celular.
                <br />
                O QR Code expira em ~60 segundos.
              </p>
              <Button size="sm" variant="secondary" onClick={handleGetQr} loading={loadingQr}>
                <RefreshCw className="w-3.5 h-3.5" /> Novo QR Code
              </Button>
            </div>
          ) : qrData?.error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              {qrData.error}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Aguardando QR Code do provider...
            </div>
          )}
        </div>
      )}

      {/* Instruções */}
      <div className="card p-4">
        <button
          onClick={() => setShowInstructions(!showInstructions)}
          className="flex items-center justify-between w-full text-xs font-semibold text-slate-700"
        >
          <span className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" /> Como conectar
          </span>
          {showInstructions ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showInstructions && (
          <ol className="mt-3 space-y-1.5 text-xs text-slate-600 list-decimal list-inside">
            <li>Clique em <strong>Criar conexão</strong> (primeira vez) ou <strong>Gerar QR Code</strong></li>
            <li>Abra o <strong>WhatsApp</strong> no celular</li>
            <li>Vá em <strong>⋮ Menu → Aparelhos conectados</strong></li>
            <li>Toque em <strong>Conectar aparelho</strong></li>
            <li>Escaneie o QR Code exibido acima</li>
            <li>Aguarde o status mudar para <strong>Conectado</strong></li>
            <li>
              A partir daí, <strong>toda mensagem recebida</strong> gera um lead
              automaticamente no funil
            </li>
          </ol>
        )}
      </div>

      {/* Teste / simulação */}
      {isConfigured && (
        <div className="card p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Teste e simulação</p>
          <p className="text-xs text-slate-500">
            Simula uma mensagem recebida para validar o fluxo lead → funil sem precisar do provider conectado.
          </p>
          <Button size="sm" variant="secondary" onClick={handleTest}>
            Simular mensagem recebida
          </Button>
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>
      )}

      {/* Logs */}
      <div className="card p-4 space-y-2">
        <button
          onClick={() => setShowLogs(!showLogs)}
          className="flex items-center justify-between w-full text-xs font-semibold text-slate-700"
        >
          <span className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Logs da sessão
            {logs.length > 0 && (
              <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full text-[10px]">{logs.length}</span>
            )}
          </span>
          {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
        {showLogs && (
          <div className="bg-slate-900 rounded-lg p-3 max-h-40 overflow-y-auto space-y-0.5">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500">Sem logs ainda.</p>
            ) : (
              logs.map((log, i) => (
                <p key={i} className="text-xs font-mono text-emerald-400 leading-relaxed">{log}</p>
              ))
            )}
          </div>
        )}
      </div>

      {/* Documentação */}
      <div className="text-xs text-slate-400 flex items-center gap-1.5">
        <ExternalLink className="w-3 h-3" />
        <a
          href="https://doc.evolution-api.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-slate-600 underline underline-offset-2"
        >
          Documentação Evolution API
        </a>
        <span>·</span>
        <span>Provider: {providerOk ? "configurado" : "não configurado"}</span>
      </div>
    </div>
  );
}
