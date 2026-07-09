"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { MessageCircle, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { LeadConversationPanel } from "./LeadConversationPanel";
import { WhatsAppConnectionBanner } from "./WhatsAppConnectionBanner";
import { WhatsAppQrModal } from "./WhatsAppQrModal";
import type {
  WaConnectionStatus,
  WaConversationSummary,
  WaConversationDetail,
  WaMessage,
  WaStageRef,
  WaFilter,
} from "./types";

async function safeJson<T>(res: Response): Promise<T | null> {
  try {
    const t = await res.text();
    return t.trim() ? (JSON.parse(t) as T) : null;
  } catch {
    return null;
  }
}

export function WhatsAppInboxPage() {
  const [status, setStatus] = useState<WaConnectionStatus | null>(null);
  const [conversations, setConversations] = useState<WaConversationSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<WaFilter>("open");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<WaConversationDetail | null>(null);
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [stages, setStages] = useState<WaStageRef[]>([]);
  const [changingStage, setChangingStage] = useState(false);

  const [qrOpen, setQrOpen] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const selectedRef = useRef<string | null>(null);
  selectedRef.current = selectedId;

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/integrations/whatsapp-qr/status");
    const data = await safeJson<WaConnectionStatus>(res);
    if (data) setStatus(data);
  }, []);

  const fetchConversations = useCallback(async () => {
    const params = new URLSearchParams({ filter });
    if (query.trim()) params.set("q", query.trim());
    const res = await fetch(`/api/whatsapp/conversations?${params}`);
    const data = await safeJson<{ conversations: WaConversationSummary[] }>(res);
    if (data) setConversations(data.conversations);
    setLoadingList(false);
  }, [filter, query]);

  const fetchDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/whatsapp/conversations/${id}`);
    const data = await safeJson<{
      conversation: WaConversationDetail;
      messages: WaMessage[];
      stages: WaStageRef[];
    }>(res);
    if (data && selectedRef.current === id) {
      setDetail(data.conversation);
      setMessages(data.messages);
      setStages(data.stages);
    }
  }, []);

  // ── Polling: status + lista ───────────────────────────────────────────────────
  useEffect(() => {
    fetchStatus();
    const t = setInterval(fetchStatus, 15000);
    return () => clearInterval(t);
  }, [fetchStatus]);

  useEffect(() => {
    setLoadingList(true);
    const debounce = setTimeout(fetchConversations, 250);
    return () => clearTimeout(debounce);
  }, [fetchConversations]);

  useEffect(() => {
    const t = setInterval(fetchConversations, 10000);
    return () => clearInterval(t);
  }, [fetchConversations]);

  // ── Detalhe da conversa selecionada (+ poll para novas mensagens) ──────────────
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setMessages([]);
      return;
    }
    fetchDetail(selectedId);
    const t = setInterval(() => fetchDetail(selectedId), 6000);
    return () => clearInterval(t);
  }, [selectedId, fetchDetail]);

  // ── Ações ─────────────────────────────────────────────────────────────────────
  const handleSend = useCallback(
    async (text: string) => {
      if (!selectedId) return;
      const optimistic: WaMessage = {
        id: `opt_${Date.now()}`,
        direction: "OUTBOUND",
        type: "TEXT",
        body: text,
        status: "PENDING",
        sentAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        optimistic: true,
      };
      setMessages((prev) => [...prev, optimistic]);

      const res = await fetch(`/api/whatsapp/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await safeJson<{ message?: WaMessage; error?: string }>(res);

      if (res.ok && data?.message) {
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? data.message! : m)));
        fetchConversations();
      } else {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, failed: true, status: "FAILED", optimistic: false } : m))
        );
        toast.error(data?.error ?? "Falha ao enviar mensagem.");
      }
    },
    [selectedId, fetchConversations]
  );

  const handleChangeStage = useCallback(
    async (stageId: string) => {
      if (!selectedId || !detail?.lead) return;
      setChangingStage(true);
      const res = await fetch(`/api/whatsapp/conversations/${selectedId}/lead-stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ funnelStageId: stageId }),
      });
      const data = await safeJson<{ ok?: boolean; funnelStage?: WaStageRef; error?: string }>(res);
      setChangingStage(false);
      if (res.ok && data?.funnelStage) {
        const stage = data.funnelStage;
        setDetail((prev) =>
          prev && prev.lead
            ? { ...prev, lead: { ...prev.lead, funnelStageId: stage.id, funnelStage: stage } }
            : prev
        );
        fetchConversations();
        toast.success(`Etapa alterada para "${stage.name}".`);
      } else {
        toast.error(data?.error ?? "Não foi possível mudar a etapa.");
      }
    },
    [selectedId, detail, fetchConversations]
  );

  const handleSimulate = useCallback(async () => {
    setSimulating(true);
    const res = await fetch("/api/whatsapp/simulate", { method: "POST" });
    const data = await safeJson<{ error?: string }>(res);
    setSimulating(false);
    if (res.ok) {
      toast.success("Mensagem simulada recebida! Lead criado no funil.");
      fetchConversations();
    } else {
      toast.error(data?.error ?? "Falha ao simular mensagem.");
    }
  }, [fetchConversations]);

  const connected = status?.status === "connected";
  const isMock = status?.providerMode === "mock";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Cabeçalho da área */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200 bg-white">
        <MessageCircle className="w-5 h-5 text-primary-600" />
        <h1 className="text-base font-bold text-slate-800">Mensagens WhatsApp</h1>
        {isMock && (
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 hover:bg-primary-100 disabled:opacity-50"
          >
            <Wand2 className="w-3.5 h-3.5" /> Simular mensagem recebida
          </button>
        )}
      </div>

      {/* Banner de conexão */}
      <WhatsAppConnectionBanner
        status={status}
        onConnect={() => setQrOpen(true)}
        onRefresh={fetchStatus}
      />

      {/* Corpo: lista | conversa | painel */}
      <div className="flex-1 min-h-0 flex">
        <ConversationList
          conversations={conversations}
          selectedId={selectedId}
          query={query}
          filter={filter}
          loading={loadingList}
          onQueryChange={setQuery}
          onFilterChange={setFilter}
          onSelect={setSelectedId}
        />

        {detail ? (
          <>
            <ConversationThread
              conversation={detail}
              messages={messages}
              canReply={connected}
              onSend={handleSend}
            />
            <LeadConversationPanel
              conversation={detail}
              stages={stages}
              changingStage={changingStage}
              onChangeStage={handleChangeStage}
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-slate-400 bg-slate-50">
            <MessageCircle className="w-12 h-12" />
            {conversations.length === 0 && !connected ? (
              <p className="text-sm max-w-xs">
                Conecte seu WhatsApp para começar a receber mensagens.
              </p>
            ) : (
              <p className="text-sm">Selecione uma conversa para começar.</p>
            )}
          </div>
        )}
      </div>

      <WhatsAppQrModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onConnected={() => {
          setQrOpen(false);
          fetchStatus();
          toast.success("WhatsApp conectado!");
        }}
      />
    </div>
  );
}
