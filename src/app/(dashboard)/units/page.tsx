"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MapPin, Phone, Building2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

interface Unit {
  id: string; name: string; address?: string; phone?: string;
  isActive: boolean;
  _count: { leads: number; doctors: number };
}

interface FormData { name: string; address: string; phone: string; }

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, reset } = useForm<FormData>();

  const fetchUnits = useCallback(async () => {
    try {
      const res = await fetch("/api/units");
      const data = res.ok ? await res.json() : [];
      setUnits(Array.isArray(data) ? data : []);
    } catch {
      // network error — keep empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  function openCreate() {
    setEditUnit(null);
    reset({ name: "", address: "", phone: "" });
    setShowModal(true);
  }

  function openEdit(unit: Unit) {
    setEditUnit(unit);
    reset({ name: unit.name, address: unit.address ?? "", phone: unit.phone ?? "" });
    setShowModal(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    try {
      const url = editUnit ? `/api/units/${editUnit.id}` : "/api/units";
      const method = editUnit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, address: data.address || null, phone: data.phone || null }),
      });
      if (res.ok) { setShowModal(false); fetchUnits(); }
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Unidades</h1>
          <p className="text-sm text-slate-500 mt-0.5">{units.length} unidade{units.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Nova Unidade</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-slate-100 rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((unit) => (
            <div key={unit.id} className={cn("card p-5 relative", !unit.isActive && "opacity-60")}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex items-center gap-1">
                  {!unit.isActive && (
                    <span className="text-[10px] bg-slate-100 text-slate-400 px-2 py-0.5 rounded-full">Inativa</span>
                  )}
                  <button onClick={() => openEdit(unit)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="font-semibold text-slate-900 mb-2">{unit.name}</h3>

              {unit.address && (
                <div className="flex items-start gap-1.5 text-xs text-slate-500 mb-1">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{unit.address}</span>
                </div>
              )}
              {unit.phone && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                  <Phone className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{unit.phone}</span>
                </div>
              )}

              <div className="flex items-center gap-4 pt-3 border-t border-slate-100 mt-3">
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{unit._count.leads}</p>
                  <p className="text-[10px] text-slate-400">Leads</p>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{unit._count.doctors}</p>
                  <p className="text-[10px] text-slate-400">Médicos</p>
                </div>
              </div>
            </div>
          ))}

          {units.length === 0 && (
            <div className="col-span-3 text-center py-12">
              <Building2 className="w-10 h-10 text-slate-200 mx-auto mb-2" />
              <p className="text-sm text-slate-400">Nenhuma unidade cadastrada</p>
              <Button className="mt-4" onClick={openCreate}><Plus className="w-4 h-4" /> Criar Unidade</Button>
            </div>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUnit ? "Editar Unidade" : "Nova Unidade"} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nome *</label>
            <input {...register("name", { required: true })} className={inputClass} placeholder="Clínica Centro" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Endereço</label>
            <input {...register("address")} className={inputClass} placeholder="Rua, número, bairro, cidade" />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Telefone</label>
            <input {...register("phone")} className={inputClass} placeholder="(11) 3333-4444" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
