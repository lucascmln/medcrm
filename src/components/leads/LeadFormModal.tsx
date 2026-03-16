"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface FormData {
  name: string;
  phone: string;
  email: string;
  sourceId: string;
  subsourceId: string;
  campaignId: string;
  funnelStageId: string;
  doctorId: string;
  unitId: string;
  assignedToId: string;
  procedure: string;
  potentialValue: string;
  observations: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  leadId?: string; // if set, editing
}

export function LeadFormModal({ open, onClose, onSuccess, leadId }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sources, setSources] = useState<any[]>([]);
  const [subsources, setSubsources] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const { register, handleSubmit, watch, reset, setValue, formState: { errors } } = useForm<FormData>();
  const watchedSourceId = watch("sourceId");

  // Load reference data
  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/lead-sources").then((r) => r.json()),
      fetch("/api/funnel-stages").then((r) => r.json()),
      fetch("/api/doctors").then((r) => r.json()),
      fetch("/api/units").then((r) => r.json()),
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/tags").then((r) => r.json()),
    ]).then(([src, stg, doc, unt, usr, cmp, tgs]) => {
      setSources(src);
      setStages(stg);
      setDoctors(doc);
      setUnits(unt);
      setUsers(usr);
      setCampaigns(cmp);
      setTags(tgs);
      if (stg.length > 0 && !leadId) setValue("funnelStageId", stg[0].id);
    });
  }, [open, leadId, setValue]);

  // Load lead data if editing
  useEffect(() => {
    if (!open || !leadId) { reset(); setSelectedTags([]); return; }
    fetch(`/api/leads/${leadId}`).then((r) => r.json()).then((lead) => {
      reset({
        name: lead.name,
        phone: lead.phone,
        email: lead.email ?? "",
        sourceId: lead.sourceId ?? "",
        subsourceId: lead.subsourceId ?? "",
        campaignId: lead.campaignId ?? "",
        funnelStageId: lead.funnelStageId,
        doctorId: lead.doctorId ?? "",
        unitId: lead.unitId ?? "",
        assignedToId: lead.assignedToId ?? "",
        procedure: lead.procedure ?? "",
        potentialValue: lead.potentialValue?.toString() ?? "",
        observations: lead.observations ?? "",
      });
      setSelectedTags(lead.tags?.map((t: any) => t.tagId) ?? []);
    });
  }, [open, leadId, reset]);

  // Load subsources when source changes
  useEffect(() => {
    if (!watchedSourceId) { setSubsources([]); return; }
    const source = sources.find((s) => s.id === watchedSourceId);
    setSubsources(source?.subsources ?? []);
    setValue("subsourceId", "");
  }, [watchedSourceId, sources, setValue]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    setError("");
    try {
      // Capture current page URL so the backend can extract UTM params from it
      const currentUrl = typeof window !== "undefined" ? window.location.href : null;

      const payload = {
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        sourceId: data.sourceId || null,
        subsourceId: data.subsourceId || null,
        campaignId: data.campaignId || null,
        funnelStageId: data.funnelStageId,
        doctorId: data.doctorId || null,
        unitId: data.unitId || null,
        assignedToId: data.assignedToId || null,
        potentialValue: data.potentialValue || null,
        procedure: data.procedure || null,
        observations: data.observations || null,
        tagIds: selectedTags,
        // Pass landing page so backend can extract UTMs from query params
        landingPage: currentUrl,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      };

      const url = leadId ? `/api/leads/${leadId}` : "/api/leads";
      const method = leadId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Erro ao salvar lead");
        return;
      }

      onSuccess();
      reset();
      setSelectedTags([]);
    } finally {
      setLoading(false);
    }
  }

  function toggleTag(id: string) {
    setSelectedTags((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent";
  const labelClass = "text-xs font-medium text-slate-600 block mb-1";

  return (
    <Modal open={open} onClose={onClose} title={leadId ? "Editar Lead" : "Novo Lead"} size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="p-5">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Nome */}
          <div>
            <label className={labelClass}>Nome *</label>
            <input
              {...register("name", { required: "Nome é obrigatório" })}
              className={inputClass}
              placeholder="Nome completo"
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Telefone */}
          <div>
            <label className={labelClass}>Telefone *</label>
            <input
              {...register("phone", { required: "Telefone é obrigatório" })}
              className={inputClass}
              placeholder="(11) 99999-9999"
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className={labelClass}>E-mail</label>
            <input {...register("email")} type="email" className={inputClass} placeholder="email@exemplo.com" />
          </div>

          {/* Etapa do Funil */}
          <div>
            <label className={labelClass}>Etapa do Funil *</label>
            <select {...register("funnelStageId", { required: true })} className={inputClass}>
              <option value="">Selecionar etapa</option>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Canal */}
          <div>
            <label className={labelClass}>Canal de Origem</label>
            <select {...register("sourceId")} className={inputClass}>
              <option value="">Selecionar canal</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Suborigem */}
          <div>
            <label className={labelClass}>Suborigem</label>
            <select {...register("subsourceId")} className={inputClass} disabled={subsources.length === 0}>
              <option value="">Selecionar suborigem</option>
              {subsources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          {/* Campanha */}
          <div>
            <label className={labelClass}>Campanha</label>
            <select {...register("campaignId")} className={inputClass}>
              <option value="">Selecionar campanha</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Unidade */}
          <div>
            <label className={labelClass}>Unidade</label>
            <select {...register("unitId")} className={inputClass}>
              <option value="">Selecionar unidade</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Médico */}
          <div>
            <label className={labelClass}>Médico de Interesse</label>
            <select {...register("doctorId")} className={inputClass}>
              <option value="">Selecionar médico</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}{d.specialty ? ` — ${d.specialty}` : ""}</option>)}
            </select>
          </div>

          {/* Atendente */}
          <div>
            <label className={labelClass}>Atendente Responsável</label>
            <select {...register("assignedToId")} className={inputClass}>
              <option value="">Selecionar atendente</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Procedimento */}
          <div>
            <label className={labelClass}>Procedimento de Interesse</label>
            <input {...register("procedure")} className={inputClass} placeholder="Ex: Rinoplastia, Implante..." />
          </div>

          {/* Valor Potencial */}
          <div>
            <label className={labelClass}>Valor Potencial (R$)</label>
            <input {...register("potentialValue")} type="number" min="0" step="0.01" className={inputClass} placeholder="0,00" />
          </div>

          {/* Observações */}
          <div className="sm:col-span-2">
            <label className={labelClass}>Observações</label>
            <textarea {...register("observations")} rows={3} className={inputClass} placeholder="Observações internas sobre o lead..." />
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="sm:col-span-2">
              <label className={labelClass}>Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="px-3 py-1 rounded-full text-xs font-medium border transition-all"
                    style={
                      selectedTags.includes(tag.id)
                        ? { backgroundColor: `${tag.color}20`, color: tag.color, borderColor: `${tag.color}60` }
                        : { backgroundColor: "transparent", color: "#94a3b8", borderColor: "#e2e8f0" }
                    }
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-200">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {leadId ? "Salvar Alterações" : "Criar Lead"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
