"use client";

import { useEffect, useState } from "react";
import { Save, Plus, Trash2, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

const TABS = ["Geral", "Funil", "Canais", "Campanhas", "Tags", "Motivos de Perda", "Integrações"];

export default function SettingsPage() {
  const [tab, setTab] = useState("Geral");

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="page-title">Configurações</h1>
        <p className="text-sm text-slate-500 mt-0.5">Personalize o seu CRM</p>
      </div>

      <div className="flex overflow-x-auto gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "flex-shrink-0 px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
              tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Geral" && <GeneralSettings />}
      {tab === "Funil" && <FunnelSettings />}
      {tab === "Canais" && <ChannelSettings />}
      {tab === "Campanhas" && <CampaignSettings />}
      {tab === "Tags" && <TagSettings />}
      {tab === "Motivos de Perda" && <LossReasonSettings />}
      {tab === "Integrações" && <IntegrationSettings />}
    </div>
  );
}

function GeneralSettings() {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const { register, handleSubmit, reset } = useForm<{ name: string; primaryColor: string }>();

  useEffect(() => {
    fetch("/api/settings").then((r) => r.json()).then((d) => {
      reset({ name: d.name, primaryColor: d.primaryColor });
    });
  }, [reset]);

  async function onSubmit(data: any) {
    setSaving(true);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="card p-5 max-w-lg space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Configurações Gerais</h3>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Nome da Clínica/Empresa</label>
        <input {...register("name")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Cor Principal</label>
        <div className="flex items-center gap-3">
          <input {...register("primaryColor")} type="color" className="h-10 w-16 rounded-lg border border-slate-200 cursor-pointer" />
          <input {...register("primaryColor")} className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="#0284c7" />
        </div>
      </div>
      <Button type="submit" loading={saving}>
        {saved ? <><Check className="w-4 h-4" /> Salvo!</> : <><Save className="w-4 h-4" /> Salvar Configurações</>}
      </Button>
    </form>
  );
}

function FunnelSettings() {
  const [stages, setStages] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#64748b");

  useEffect(() => {
    fetch("/api/funnel-stages").then((r) => r.json()).then(setStages);
  }, []);

  async function addStage() {
    if (!newName.trim()) return;
    const res = await fetch("/api/funnel-stages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor, order: stages.length + 1 }),
    });
    const stage = await res.json();
    setStages([...stages, stage]);
    setNewName("");
  }

  return (
    <div className="card p-5 max-w-lg space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Etapas do Funil</h3>
      <div className="space-y-2">
        {stages.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
            <span className="flex-1 text-sm text-slate-700">{s.name}</span>
            <div className="flex items-center gap-1">
              {s.isLost && <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded">perda</span>}
              {s.isFinal && !s.isLost && <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded">final</span>}
              <span className="text-xs text-slate-400">#{i + 1}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer"
        />
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome da nova etapa"
          className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
          onKeyDown={(e) => e.key === "Enter" && addStage()}
        />
        <Button size="sm" onClick={addStage}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
    </div>
  );
}

function ChannelSettings() {
  const [sources, setSources] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#64748b");
  const [newSubName, setNewSubName] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/lead-sources").then((r) => r.json()).then(setSources);
  }, []);

  async function addSource() {
    if (!newName.trim()) return;
    const res = await fetch("/api/lead-sources", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    const src = await res.json();
    setSources([...sources, src]);
    setNewName("");
  }

  async function addSubsource(sourceId: string) {
    const name = newSubName[sourceId];
    if (!name?.trim()) return;
    await fetch(`/api/lead-sources/${sourceId}/subsources`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNewSubName((prev) => ({ ...prev, [sourceId]: "" }));
    fetch("/api/lead-sources").then((r) => r.json()).then(setSources);
  }

  return (
    <div className="card p-5 max-w-lg space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Canais e Suborigens</h3>
      {sources.map((src) => (
        <div key={src.id} className="border border-slate-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: src.color ?? "#64748b" }} />
            <span className="text-sm font-medium text-slate-800">{src.name}</span>
          </div>
          <div className="ml-5 space-y-1">
            {src.subsources?.map((sub: any) => (
              <div key={sub.id} className="text-xs text-slate-500 flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-slate-300" /> {sub.name}
              </div>
            ))}
            <div className="flex items-center gap-2 mt-2">
              <input
                type="text"
                value={newSubName[src.id] ?? ""}
                onChange={(e) => setNewSubName((prev) => ({ ...prev, [src.id]: e.target.value }))}
                placeholder="+ Suborigem"
                className="flex-1 text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
                onKeyDown={(e) => e.key === "Enter" && addSubsource(src.id)}
              />
              <button onClick={() => addSubsource(src.id)} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Adicionar</button>
            </div>
          </div>
        </div>
      ))}
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer" />
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Novo canal" className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" onKeyDown={(e) => e.key === "Enter" && addSource()} />
        <Button size="sm" onClick={addSource}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
    </div>
  );
}

function CampaignSettings() {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { register, handleSubmit, reset } = useForm<any>();

  useEffect(() => { fetch("/api/campaigns").then((r) => r.json()).then(setCampaigns); }, []);

  async function onSubmit(data: any) {
    await fetch("/api/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    reset();
    setShowForm(false);
    fetch("/api/campaigns").then((r) => r.json()).then(setCampaigns);
  }

  return (
    <div className="card p-5 max-w-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Campanhas</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}><Plus className="w-3.5 h-3.5" /> Nova Campanha</Button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-200">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className="text-xs font-medium text-slate-600 block mb-1">Nome *</label><input {...register("name", { required: true })} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
            <div><label className="text-xs font-medium text-slate-600 block mb-1">Canal</label><input {...register("channel")} className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" placeholder="Meta Ads, Google..." /></div>
            <div><label className="text-xs font-medium text-slate-600 block mb-1">Budget (R$)</label><input {...register("budget")} type="number" className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" /></div>
          </div>
          <div className="flex justify-end gap-2"><Button variant="secondary" size="sm" type="button" onClick={() => setShowForm(false)}>Cancelar</Button><Button size="sm" type="submit">Criar</Button></div>
        </form>
      )}
      <div className="space-y-2">
        {campaigns.map((c) => (
          <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-slate-800">{c.name}</p>
              {c.channel && <p className="text-xs text-slate-400">{c.channel}</p>}
            </div>
            <span className="text-xs text-slate-400">{c._count?.leads ?? 0} leads</span>
          </div>
        ))}
        {campaigns.length === 0 && <p className="text-sm text-slate-400 text-center py-4">Nenhuma campanha cadastrada</p>}
      </div>
    </div>
  );
}

function TagSettings() {
  const [tags, setTags] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  useEffect(() => { fetch("/api/tags").then((r) => r.json()).then(setTags); }, []);

  async function addTag() {
    if (!newName.trim()) return;
    const res = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, color: newColor }),
    });
    const tag = await res.json();
    setTags([...tags, tag]);
    setNewName("");
  }

  async function deleteTag(id: string) {
    await fetch(`/api/tags?id=${id}`, { method: "DELETE" });
    setTags(tags.filter((t) => t.id !== id));
  }

  return (
    <div className="card p-5 max-w-lg space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Tags</h3>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <div key={tag.id} className="flex items-center gap-1.5 pl-2.5 pr-1 py-1 rounded-full border text-xs font-medium" style={{ backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}40` }}>
            {tag.name}
            <button onClick={() => deleteTag(tag.id)} className="w-4 h-4 rounded-full hover:bg-black/10 flex items-center justify-center"><Trash2 className="w-2.5 h-2.5" /></button>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
        <input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="h-9 w-12 rounded-lg border border-slate-200 cursor-pointer" />
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome da tag" className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" onKeyDown={(e) => e.key === "Enter" && addTag()} />
        <Button size="sm" onClick={addTag}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
    </div>
  );
}

function LossReasonSettings() {
  const [reasons, setReasons] = useState<any[]>([]);
  const [newName, setNewName] = useState("");

  useEffect(() => { fetch("/api/loss-reasons").then((r) => r.json()).then(setReasons); }, []);

  async function addReason() {
    if (!newName.trim()) return;
    const res = await fetch("/api/loss-reasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const reason = await res.json();
    setReasons([...reasons, reason]);
    setNewName("");
  }

  return (
    <div className="card p-5 max-w-lg space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Motivos de Perda</h3>
      <div className="space-y-2">
        {reasons.map((r) => (
          <div key={r.id} className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
            <span className="text-sm text-slate-700">{r.name}</span>
          </div>
        ))}
        {reasons.length === 0 && <p className="text-sm text-slate-400 text-center py-2">Nenhum motivo cadastrado</p>}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-slate-200">
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Preço, Concorrente, Sem interesse..." className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500" onKeyDown={(e) => e.key === "Enter" && addReason()} />
        <Button size="sm" onClick={addReason}><Plus className="w-3.5 h-3.5" /> Adicionar</Button>
      </div>
    </div>
  );
}

function IntegrationSettings() {
  const [copied, setCopied] = useState(false);
  const webhookUrl = typeof window !== "undefined" ? `${window.location.origin}/api/webhooks/leads` : "/api/webhooks/leads";

  function copyUrl() {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const examplePayload = JSON.stringify({
    name: "Maria Silva",
    phone: "11999990000",
    email: "maria@email.com",
    observations: "Interesse em rinoplastia",
  }, null, 2);

  return (
    <div className="card p-5 max-w-2xl space-y-5">
      <h3 className="text-sm font-semibold text-slate-900">Integrações via Webhook</h3>
      <p className="text-sm text-slate-500">
        Use o endpoint abaixo para receber leads automaticamente de formulários, landing pages e sistemas externos.
      </p>

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-2">URL do Webhook</label>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-sm bg-slate-900 text-emerald-400 rounded-lg px-3 py-2 font-mono overflow-x-auto">
            POST {webhookUrl}
          </code>
          <button onClick={copyUrl} className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500">
            {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-2">Header de Autenticação</label>
        <code className="block text-sm bg-slate-900 text-amber-400 rounded-lg px-3 py-2 font-mono">
          X-API-Key: sua_chave_aqui
        </code>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-600 block mb-2">Exemplo de Payload (JSON)</label>
        <pre className="text-sm bg-slate-900 text-slate-300 rounded-lg px-3 py-3 font-mono overflow-x-auto">
          {examplePayload}
        </pre>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <strong>Campos disponíveis:</strong> name*, phone*, email, sourceId, subsourceId, campaignId, observations
          <br />
          <span className="text-xs text-blue-500 mt-1 block">* obrigatórios · Solicite sua API Key ao administrador do sistema</span>
        </p>
      </div>
    </div>
  );
}
