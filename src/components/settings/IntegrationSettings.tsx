"use client";

import { useEffect, useState } from "react";
import {
  Plus, Trash2, Copy, Check, Pencil, X, ExternalLink,
  CheckCircle2, AlertTriangle, Circle, Wifi, WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Tipos ───────────────────────────────────────────────────────────────────

interface Integration {
  id: string;
  provider: "meta" | "whatsapp";
  externalId: string;
  label: string;
  isActive: boolean;
  hasAccessToken: boolean;
  displayPhone: string | null;
  createdAt: string;
}

interface EnvVar {
  configured: boolean;
  preview: string | null;
}

interface EnvStatus {
  APP_BASE_URL:          EnvVar;
  META_VERIFY_TOKEN:     EnvVar;
  WHATSAPP_VERIFY_TOKEN: EnvVar;
}

interface FormState {
  label: string;
  externalId: string;
  accessToken: string;
  displayPhone: string;
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  label: "", externalId: "", accessToken: "", displayPhone: "", isActive: true,
};

// ─── Componente principal ─────────────────────────────────────────────────────

export function IntegrationSettings() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [envStatus, setEnvStatus]       = useState<EnvStatus | null>(null);
  const [loading, setLoading]           = useState(true);
  const [loadError, setLoadError]       = useState<string | null>(null);

  // form de criação por provider
  const [showForm, setShowForm] = useState<"meta" | "whatsapp" | null>(null);
  const [form, setForm]         = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving]     = useState(false);
  const [formError, setFormError] = useState("");

  // edição inline
  const [editId, setEditId]       = useState<string | null>(null);
  const [editForm, setEditForm]   = useState<FormState>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);

  // cópia de URL
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const WEBHOOK_ENDPOINTS = [
    { key: "meta-leads", label: "Meta Lead Ads",    url: `${origin}/api/webhooks/meta-leads`, color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
    { key: "whatsapp",   label: "WhatsApp Cloud",   url: `${origin}/api/webhooks/whatsapp`,   color: "text-green-700",  bg: "bg-green-50",   border: "border-green-200" },
    { key: "leads-api",  label: "Webhook Genérico", url: `${origin}/api/webhooks/leads`,      color: "text-slate-700",  bg: "bg-slate-50",   border: "border-slate-200" },
  ];

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/integrations");
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // 401 = não autenticado (não deve chegar aqui), 403 = sem tenant
        // Em ambos os casos, mostramos tela vazia em vez de crashar
        console.warn("[IntegrationSettings] API retornou", res.status, data?.error);
        setIntegrations([]);
        // Ainda tenta usar envStatus se veio na resposta de erro (500 inclui)
        if (data?.envStatus) setEnvStatus(data.envStatus);
        if (res.status === 500) setLoadError("Erro ao carregar integrações. Tente novamente.");
        return;
      }

      setIntegrations(data.integrations ?? []);
      setEnvStatus(data.envStatus ?? null);
    } catch (err) {
      console.error("[IntegrationSettings] fetch falhou:", err);
      setLoadError("Não foi possível conectar à API. Verifique sua conexão.");
      setIntegrations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  // ── Criar ──────────────────────────────────────────────────────────────────
  function validateExternalId(provider: "meta" | "whatsapp", value: string): string | null {
    if (!value.trim()) return "O ID externo é obrigatório.";
    if (!/^\d+$/.test(value.trim())) {
      return provider === "meta"
        ? "Page ID inválido — deve conter apenas números (ex: 123456789012345)."
        : "Phone Number ID inválido — deve conter apenas números (ex: 109876543210123).";
    }
    if (value.trim().length < 10 || value.trim().length > 22) {
      return provider === "meta"
        ? "Page ID inválido — normalmente tem entre 10 e 20 dígitos."
        : "Phone Number ID inválido — normalmente tem entre 10 e 20 dígitos.";
    }
    return null;
  }

  async function handleCreate() {
    if (!form.label.trim()) {
      setFormError("O nome amigável (label) é obrigatório.");
      return;
    }
    if (showForm) {
      const idErr = validateExternalId(showForm, form.externalId);
      if (idErr) { setFormError(idErr); return; }
    }
    setSaving(true);
    setFormError("");
    try {
      const res = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider:    showForm,
          label:       form.label.trim(),
          externalId:  form.externalId.trim(),
          accessToken: form.accessToken.trim() || undefined,
          displayPhone: form.displayPhone.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setFormError(data.error ?? "Erro ao salvar."); return; }
      setShowForm(null);
      setForm(EMPTY_FORM);
      await load();
    } finally {
      setSaving(false);
    }
  }

  // ── Editar ─────────────────────────────────────────────────────────────────
  function startEdit(i: Integration) {
    setEditId(i.id);
    setEditForm({
      label:       i.label,
      externalId:  i.externalId,
      accessToken: "",           // nunca pré-preenche token
      displayPhone: i.displayPhone ?? "",
      isActive:    i.isActive,
    });
  }

  async function handleSaveEdit() {
    if (!editId) return;
    setEditSaving(true);
    try {
      const res = await fetch(`/api/integrations/${editId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label:       editForm.label.trim(),
          externalId:  editForm.externalId.trim(),
          isActive:    editForm.isActive,
          ...(editForm.accessToken.trim()  ? { accessToken:  editForm.accessToken.trim()  } : {}),
          ...(editForm.displayPhone.trim() ? { displayPhone: editForm.displayPhone.trim() } : {}),
        }),
      });
      if (!res.ok) return;
      setEditId(null);
      await load();
    } finally {
      setEditSaving(false);
    }
  }

  // ── Excluir ────────────────────────────────────────────────────────────────
  async function handleDelete(id: string, label: string) {
    if (!confirm(`Remover a integração "${label}"?\n\nO webhook parará de rotear eventos para este tenant.`)) return;
    await fetch(`/api/integrations/${id}`, { method: "DELETE" });
    await load();
  }

  const metaIntegrations      = integrations.filter((i) => i.provider === "meta");
  const whatsappIntegrations  = integrations.filter((i) => i.provider === "whatsapp");

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Banner de erro de carregamento ─────────────────────────────────── */}
      {loadError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{loadError}</p>
          <button onClick={load} className="ml-auto text-xs text-red-600 underline hover:text-red-800">
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Endpoints prontos ──────────────────────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Endpoints de Webhook</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Estes endpoints já estão funcionando. Cadastre a URL pública no Meta Developers após publicar o sistema.
          </p>
        </div>

        <div className="space-y-2">
          {WEBHOOK_ENDPOINTS.map((ep) => (
            <div key={ep.key} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 border", ep.bg, ep.border)}>
              <CheckCircle2 className={cn("w-3.5 h-3.5 flex-shrink-0", ep.color)} />
              <div className="flex-1 min-w-0">
                <p className={cn("text-xs font-semibold", ep.color)}>{ep.label}</p>
                <code className="text-[11px] text-slate-600 font-mono truncate block">{ep.url}</code>
              </div>
              <button
                onClick={() => copy(ep.key, ep.url)}
                className="p-1.5 rounded hover:bg-white/60 transition-colors text-slate-500 flex-shrink-0"
                title="Copiar URL"
              >
                {copiedKey === ep.key
                  ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                  : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Status das variáveis de ambiente ───────────────────────────────── */}
      <div className="card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Variáveis de Ambiente</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configure no arquivo <code className="font-mono">.env.local</code> (dev) ou nas variáveis do servidor (produção).
          </p>
        </div>

        {loading || !envStatus ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-2">
            {(Object.entries(envStatus) as [keyof EnvStatus, EnvVar][]).map(([key, val]) => (
              <div key={key} className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 border",
                val.configured ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
              )}>
                {val.configured
                  ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                <code className="flex-1 text-xs font-mono font-semibold text-slate-700">{key}</code>
                {val.configured ? (
                  <span className="text-xs text-emerald-700 font-medium">
                    {val.preview ? val.preview : "configurado"}
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 font-medium">não configurado</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
          <p className="text-xs text-slate-600 font-mono leading-relaxed">
            APP_BASE_URL=&quot;https://crm.suaclinica.com.br&quot;<br />
            META_VERIFY_TOKEN=&quot;string-aleatoria-segura&quot;<br />
            WHATSAPP_VERIFY_TOKEN=&quot;outra-string-segura&quot;
          </p>
        </div>
      </div>

      {/* ── Integrações Meta Lead Ads ───────────────────────────────────────── */}
      <IntegrationSection
        title="Meta Lead Ads"
        description="Vincule uma página do Facebook a este tenant para receber leads automaticamente via webhook."
        provider="meta"
        providerColor="bg-blue-600"
        integrations={metaIntegrations}
        loading={loading}
        showForm={showForm === "meta"}
        form={form}
        formError={formError}
        saving={saving}
        editId={editId}
        editForm={editForm}
        editSaving={editSaving}
        copiedKey={copiedKey}
        onOpenForm={() => { setShowForm("meta"); setForm(EMPTY_FORM); setFormError(""); }}
        onCloseForm={() => { setShowForm(null); setFormError(""); }}
        onFormChange={(f) => setForm((p) => ({ ...p, ...f }))}
        onCreate={handleCreate}
        onStartEdit={startEdit}
        onEditChange={(f) => setEditForm((p) => ({ ...p, ...f }))}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={() => setEditId(null)}
        onDelete={handleDelete}
        onCopy={copy}
        externalIdLabel="Page ID da Página do Facebook"
        externalIdPlaceholder="123456789012345"
        externalIdHint="Somente números — é o ID numérico da página, não o nome nem o @username."
        externalIdWhere="Meta Business Suite → Configurações da Página → Informações da Página → ID da Página"
        showDisplayPhone={false}
        showAccessToken={true}
      />

      {/* ── Integrações WhatsApp ────────────────────────────────────────────── */}
      <IntegrationSection
        title="WhatsApp Cloud API"
        description="Vincule um número de WhatsApp Business a este tenant para receber mensagens automaticamente."
        provider="whatsapp"
        providerColor="bg-green-500"
        integrations={whatsappIntegrations}
        loading={loading}
        showForm={showForm === "whatsapp"}
        form={form}
        formError={formError}
        saving={saving}
        editId={editId}
        editForm={editForm}
        editSaving={editSaving}
        copiedKey={copiedKey}
        onOpenForm={() => { setShowForm("whatsapp"); setForm(EMPTY_FORM); setFormError(""); }}
        onCloseForm={() => { setShowForm(null); setFormError(""); }}
        onFormChange={(f) => setForm((p) => ({ ...p, ...f }))}
        onCreate={handleCreate}
        onStartEdit={startEdit}
        onEditChange={(f) => setEditForm((p) => ({ ...p, ...f }))}
        onSaveEdit={handleSaveEdit}
        onCancelEdit={() => setEditId(null)}
        onDelete={handleDelete}
        onCopy={copy}
        externalIdLabel="Phone Number ID do WhatsApp"
        externalIdPlaceholder="109876543210123"
        externalIdHint="ID técnico do Meta Developers — diferente do número de telefone visível (+55...)."
        externalIdWhere="Meta Developers → WhatsApp → Configuração → Phone Number ID (campo técnico)"
        showDisplayPhone={true}
        showAccessToken={false}
      />

      {/* ── Próximos passos ─────────────────────────────────────────────────── */}
      <div className="card p-5 space-y-3">
        <h3 className="text-sm font-semibold text-slate-900">Próximos Passos para Conectar</h3>
        <ol className="space-y-2 text-sm text-slate-600 list-none">
          {[
            "Publicar o sistema em uma URL pública (ex: crm.suaclinica.com.br)",
            "Configurar APP_BASE_URL, META_VERIFY_TOKEN e WHATSAPP_VERIFY_TOKEN no servidor",
            "Cadastrar as integrações acima (page_id e phone_number_id)",
            "No Meta Developers → App → Webhooks → Adicionar callback URL e verify token",
            "Para Meta Lead Ads: assinar o campo leadgen na página",
            "Para WhatsApp: assinar o campo messages no número",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                {i + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// ─── Seção reutilizável por provider ─────────────────────────────────────────

interface IntegrationSectionProps {
  title: string;
  description: string;
  provider: "meta" | "whatsapp";
  providerColor: string;
  integrations: Integration[];
  loading: boolean;
  showForm: boolean;
  form: FormState;
  formError: string;
  saving: boolean;
  editId: string | null;
  editForm: FormState;
  editSaving: boolean;
  copiedKey: string | null;
  onOpenForm: () => void;
  onCloseForm: () => void;
  onFormChange: (f: Partial<FormState>) => void;
  onCreate: () => void;
  onStartEdit: (i: Integration) => void;
  onEditChange: (f: Partial<FormState>) => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: (id: string, label: string) => void;
  onCopy: (key: string, text: string) => void;
  externalIdLabel: string;
  externalIdPlaceholder: string;
  externalIdHint: string;       // "somente números, não é o nome..."
  externalIdWhere: string;      // onde encontrar no painel Meta
  showDisplayPhone: boolean;
  showAccessToken: boolean;
}

function IntegrationSection({
  title, description, provider, providerColor,
  integrations, loading, showForm, form, formError, saving,
  editId, editForm, editSaving, copiedKey,
  onOpenForm, onCloseForm, onFormChange, onCreate,
  onStartEdit, onEditChange, onSaveEdit, onCancelEdit, onDelete, onCopy,
  externalIdLabel, externalIdPlaceholder, externalIdHint, externalIdWhere,
  showDisplayPhone, showAccessToken,
}: IntegrationSectionProps) {
  // Restringe input a dígitos — IDs do Meta são sempre numéricos
  function handleExternalIdChange(raw: string, setter: (v: Partial<FormState>) => void) {
    setter({ externalId: raw.replace(/\D/g, "") });
  }
  return (
    <div className="card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", providerColor)}>
            {provider === "meta"
              ? <span className="text-white text-xs font-bold">f</span>
              : <Wifi className="w-4 h-4 text-white" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
        </div>
        {!showForm && (
          <Button size="sm" onClick={onOpenForm}>
            <Plus className="w-3.5 h-3.5" /> Nova
          </Button>
        )}
      </div>

      {/* Formulário de criação */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-slate-700">Nova Integração — {title}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Label (nome amigável) *</label>
              <input
                value={form.label}
                onChange={(e) => onFormChange({ label: e.target.value })}
                placeholder="ex: Página Clínica Bella"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">
                {externalIdLabel} *
              </label>
              <input
                value={form.externalId}
                onChange={(e) => handleExternalIdChange(e.target.value, onFormChange)}
                placeholder={externalIdPlaceholder}
                inputMode="numeric"
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
              />
              {/* hint principal — atenção ao tipo de dado */}
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 mt-1.5 leading-relaxed">
                ⚠ {externalIdHint}
              </p>
              {/* onde encontrar */}
              <p className="text-[10px] text-slate-400 mt-1">
                Onde encontrar: {externalIdWhere}
              </p>
            </div>
            {showDisplayPhone && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 block mb-1">Número visível (opcional)</label>
                <input
                  value={form.displayPhone}
                  onChange={(e) => onFormChange({ displayPhone: e.target.value })}
                  placeholder="ex: +55 11 99999-0000"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            )}
            {showAccessToken && (
              <div className="col-span-2">
                <label className="text-xs font-medium text-slate-600 block mb-1">Access Token da Página (opcional)</label>
                <input
                  type="password"
                  value={form.accessToken}
                  onChange={(e) => onFormChange({ accessToken: e.target.value })}
                  placeholder="Necessário para buscar dados de leads na Graph API"
                  className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Armazenado de forma segura. Nunca exibido após salvar.</p>
              </div>
            )}
          </div>

          {formError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onCloseForm}>Cancelar</Button>
            <Button size="sm" loading={saving} onClick={onCreate}>Salvar Integração</Button>
          </div>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-lg animate-pulse" />)}
        </div>
      ) : integrations.length === 0 ? (
        <div className="text-center py-6 border border-dashed border-slate-200 rounded-xl">
          <WifiOff className="w-7 h-7 text-slate-200 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhuma integração cadastrada</p>
          <p className="text-xs text-slate-300 mt-0.5">Clique em "Nova" para vincular {provider === "meta" ? "uma página" : "um número"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {integrations.map((i) => (
            <div key={i.id}>
              {editId === i.id ? (
                /* ─ Inline edit ─ */
                <div className="bg-slate-50 border border-primary-200 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-slate-700">Editando: {i.label}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">Label</label>
                      <input
                        value={editForm.label}
                        onChange={(e) => onEditChange({ label: e.target.value })}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600 block mb-1">{externalIdLabel}</label>
                      <input
                        value={editForm.externalId}
                        onChange={(e) => handleExternalIdChange(e.target.value, onEditChange)}
                        inputMode="numeric"
                        placeholder={externalIdPlaceholder}
                        className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-400 mt-0.5">{externalIdHint}</p>
                    </div>
                    {showDisplayPhone && (
                      <div>
                        <label className="text-xs font-medium text-slate-600 block mb-1">Número visível</label>
                        <input
                          value={editForm.displayPhone}
                          onChange={(e) => onEditChange({ displayPhone: e.target.value })}
                          placeholder="+55 11 99999-0000"
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    )}
                    {showAccessToken && (
                      <div className="col-span-2">
                        <label className="text-xs font-medium text-slate-600 block mb-1">
                          Novo Access Token {i.hasAccessToken ? "(deixe vazio para manter o atual)" : ""}
                        </label>
                        <input
                          type="password"
                          value={editForm.accessToken}
                          onChange={(e) => onEditChange({ accessToken: e.target.value })}
                          placeholder={i.hasAccessToken ? "••••••••••••••••" : "Cole o token aqui"}
                          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        />
                      </div>
                    )}
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`active-${i.id}`}
                        checked={editForm.isActive}
                        onChange={(e) => onEditChange({ isActive: e.target.checked })}
                        className="rounded"
                      />
                      <label htmlFor={`active-${i.id}`} className="text-xs text-slate-600">Integração ativa</label>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={onCancelEdit}>
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </Button>
                    <Button size="sm" loading={editSaving} onClick={onSaveEdit}>
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </Button>
                  </div>
                </div>
              ) : (
                /* ─ Card normal ─ */
                <div className="flex items-center gap-3 p-3 border border-slate-200 rounded-xl hover:border-slate-300 transition-colors">
                  {/* Status dot */}
                  <div className="flex-shrink-0">
                    {i.isActive
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      : <Circle className="w-4 h-4 text-slate-300" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-800 truncate">{i.label}</p>
                      {!i.isActive && (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">inativo</span>
                      )}
                      {showAccessToken && i.hasAccessToken && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded font-medium">token ✓</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-[11px] text-slate-400 font-mono truncate">{i.externalId}</code>
                      {i.displayPhone && (
                        <span className="text-[11px] text-slate-500">· {i.displayPhone}</span>
                      )}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => onCopy(`id-${i.id}`, i.externalId)}
                      title={`Copiar ${externalIdLabel}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      {copiedKey === `id-${i.id}`
                        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
                        : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => onStartEdit(i)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onDelete(i.id, i.label)}
                      title="Remover"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
