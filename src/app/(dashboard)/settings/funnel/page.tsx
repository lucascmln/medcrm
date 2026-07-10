"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Plus, ArrowUp, ArrowDown, Trash2, Archive, ArchiveRestore, Star,
  Trophy, XCircle, Save, ArrowLeft, Loader2, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { reorderStages, applySingleDefault, DEFAULT_STAGE_COLOR, type StageLike } from "@/lib/funnel";

interface Stage extends StageLike {
  id: string;
  isDefault: boolean;
  isFinal: boolean;
  isLost: boolean;
  isArchived: boolean;
}

export default function FunnelSettingsPage() {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(DEFAULT_STAGE_COLOR);
  const [creating, setCreating] = useState(false);

  // Exclusão
  const [deleteTarget, setDeleteTarget] = useState<Stage | null>(null);
  const [needsMove, setNeedsMove] = useState(false);
  const [moveToId, setMoveToId] = useState("");
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/funnel-stages?includeArchived=1");
      const data = res.ok ? await res.json() : [];
      setStages(
        (Array.isArray(data) ? data : []).sort((a: Stage, b: Stage) => a.order - b.order)
      );
      setDirty(false);
    } catch {
      toast.error("Não foi possível carregar as etapas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function patchStage(id: string, patch: Partial<Stage>) {
    setStages((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
  }

  function move(id: string, dir: -1 | 1) {
    setStages((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const j = idx + dir;
      if (idx < 0 || j < 0 || j >= prev.length) return prev;
      const ids = prev.map((s) => s.id);
      [ids[idx], ids[j]] = [ids[j], ids[idx]];
      return reorderStages(prev, ids) as Stage[];
    });
    setDirty(true);
  }

  function setDefault(id: string) {
    setStages((prev) => applySingleDefault(prev, id) as Stage[]);
    setDirty(true);
  }

  function toggleWon(id: string) {
    setStages((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isFinal: !s.isFinal, isLost: false } : s
      )
    );
    setDirty(true);
  }

  function toggleLost(id: string) {
    setStages((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, isLost: !s.isLost, isFinal: false } : s
      )
    );
    setDirty(true);
  }

  async function saveAll() {
    setSaving(true);
    try {
      const res = await fetch("/api/funnel-stages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stages: stages.map((s, i) => ({
            id: s.id,
            order: i + 1,
            name: s.name,
            color: s.color,
            isDefault: s.isDefault,
            isFinal: s.isFinal,
            isLost: s.isLost,
            isArchived: s.isArchived,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Funil atualizado com sucesso.");
      await load();
    } catch {
      toast.error("Não foi possível salvar o funil.");
    } finally {
      setSaving(false);
    }
  }

  async function createStage() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/funnel-stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), color: newColor }),
      });
      if (!res.ok) throw new Error();
      setNewName("");
      setNewColor(DEFAULT_STAGE_COLOR);
      toast.success("Etapa criada.");
      await load();
    } catch {
      toast.error("Não foi possível criar a etapa.");
    } finally {
      setCreating(false);
    }
  }

  function openDelete(stage: Stage) {
    setDeleteTarget(stage);
    setNeedsMove(false);
    setMoveToId("");
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const qs = needsMove && moveToId ? `?id=${deleteTarget.id}&moveTo=${moveToId}` : `?id=${deleteTarget.id}`;
      const res = await fetch(`/api/funnel-stages${qs}`, { method: "DELETE" });
      if (res.status === 409) {
        // Etapa possui leads — exige mover para outra etapa antes de excluir.
        const data = await res.json().catch(() => ({}));
        setNeedsMove(true);
        toast.error(data.error ?? "Esta etapa possui leads. Mova os leads antes de excluir.");
        return;
      }
      if (!res.ok) throw new Error();
      toast.success("Etapa excluída.");
      setDeleteTarget(null);
      await load();
    } catch {
      toast.error("Não foi possível excluir a etapa.");
    } finally {
      setDeleting(false);
    }
  }

  const otherStages = deleteTarget ? stages.filter((s) => s.id !== deleteTarget.id && !s.isArchived) : [];

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <Link href="/settings" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Configurações
          </Link>
          <h1 className="page-title">Configurar funil</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Organize as etapas do seu funil de vendas: ordem, cores, etapa inicial, ganho e perdido.
          </p>
        </div>
        <Button onClick={saveAll} loading={saving} disabled={!dirty}>
          <Save className="w-4 h-4" /> Salvar
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <>
          {/* Lista de etapas */}
          <div className="space-y-2">
            {stages.map((s, i) => (
              <div
                key={s.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border bg-white",
                  s.isArchived ? "border-slate-200 opacity-60" : "border-slate-200/80"
                )}
              >
                {/* Reordenar */}
                <div className="flex flex-col">
                  <button onClick={() => move(s.id, -1)} disabled={i === 0}
                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20" title="Subir">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => move(s.id, 1)} disabled={i === stages.length - 1}
                    className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-20" title="Descer">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Cor */}
                <input
                  type="color"
                  value={s.color}
                  onChange={(e) => patchStage(s.id, { color: e.target.value })}
                  className="w-8 h-8 rounded cursor-pointer border border-slate-200 flex-shrink-0"
                  title="Cor da etapa"
                />

                {/* Nome */}
                <input
                  value={s.name}
                  onChange={(e) => patchStage(s.id, { name: e.target.value })}
                  className="flex-1 min-w-0 text-sm font-medium border border-transparent hover:border-slate-200 focus:border-primary-400 rounded-lg px-2 py-1.5 focus:outline-none"
                />

                {/* Flags */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <FlagButton
                    active={s.isDefault}
                    onClick={() => setDefault(s.id)}
                    title="Etapa inicial (padrão)"
                    activeClass="text-amber-600 bg-amber-50 border-amber-200"
                    icon={<Star className="w-3.5 h-3.5" />}
                  />
                  <FlagButton
                    active={s.isFinal}
                    onClick={() => toggleWon(s.id)}
                    title="Etapa de ganho / fechado"
                    activeClass="text-emerald-600 bg-emerald-50 border-emerald-200"
                    icon={<Trophy className="w-3.5 h-3.5" />}
                  />
                  <FlagButton
                    active={s.isLost}
                    onClick={() => toggleLost(s.id)}
                    title="Etapa de perdido"
                    activeClass="text-red-600 bg-red-50 border-red-200"
                    icon={<XCircle className="w-3.5 h-3.5" />}
                  />
                  <FlagButton
                    active={s.isArchived}
                    onClick={() => patchStage(s.id, { isArchived: !s.isArchived })}
                    title={s.isArchived ? "Desarquivar etapa" : "Arquivar etapa"}
                    activeClass="text-slate-600 bg-slate-100 border-slate-300"
                    icon={s.isArchived ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  />
                  <button
                    onClick={() => openDelete(s)}
                    title="Excluir etapa"
                    className="p-1.5 rounded-lg border border-transparent text-slate-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Criar nova etapa */}
          <div className="flex items-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/50">
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border border-slate-200 flex-shrink-0"
              title="Cor"
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createStage(); }}
              placeholder="Nome da nova etapa…"
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <Button variant="secondary" onClick={createStage} loading={creating} disabled={!newName.trim()}>
              <Plus className="w-4 h-4" /> Adicionar
            </Button>
          </div>

          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Star className="w-3 h-3 text-amber-500" /> inicial ·
            <Trophy className="w-3 h-3 text-emerald-500" /> ganho ·
            <XCircle className="w-3 h-3 text-red-500" /> perdido ·
            <Archive className="w-3 h-3 text-slate-400" /> arquivada (some do funil)
          </p>
        </>
      )}

      {/* Modal de exclusão */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Excluir etapa" size="sm">
        <div className="p-5 space-y-4">
          {needsMove ? (
            <>
              <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Esta etapa possui leads. Mova os leads para outra etapa antes de excluir.</span>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Mover leads para</label>
                <select
                  value={moveToId}
                  onChange={(e) => setMoveToId(e.target.value)}
                  className="mt-1 w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Selecione uma etapa…</option>
                  {otherStages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Tem certeza que deseja excluir a etapa <strong>{deleteTarget?.name}</strong>? Essa ação não pode ser desfeita.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={confirmDelete}
              loading={deleting}
              disabled={needsMove && !moveToId}
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {needsMove ? "Mover e excluir" : "Excluir etapa"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FlagButton({
  active, onClick, title, icon, activeClass,
}: {
  active: boolean; onClick: () => void; title: string; icon: React.ReactNode; activeClass: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        "p-1.5 rounded-lg border transition-colors",
        active ? activeClass : "text-slate-300 border-transparent hover:text-slate-500 hover:bg-slate-50"
      )}
    >
      {icon}
    </button>
  );
}
