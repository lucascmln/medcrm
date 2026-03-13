"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Power, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { getInitials, avatarColor, cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

interface Doctor {
  id: string; name: string; crm?: string; specialty?: string;
  phone?: string; email?: string; isActive: boolean;
  unit?: { id: string; name: string };
}

interface FormData {
  name: string; crm: string; specialty: string;
  phone: string; email: string; unitId: string;
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editDoctor, setEditDoctor] = useState<Doctor | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset } = useForm<FormData>();

  const fetchDoctors = useCallback(async () => {
    const [d, u] = await Promise.all([
      fetch("/api/doctors").then((r) => r.json()),
      fetch("/api/units").then((r) => r.json()),
    ]);
    setDoctors(d);
    setUnits(u);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDoctors(); }, [fetchDoctors]);

  function openCreate() {
    setEditDoctor(null);
    reset({ name: "", crm: "", specialty: "", phone: "", email: "", unitId: "" });
    setError("");
    setShowModal(true);
  }

  function openEdit(doc: Doctor) {
    setEditDoctor(doc);
    reset({ name: doc.name, crm: doc.crm ?? "", specialty: doc.specialty ?? "", phone: doc.phone ?? "", email: doc.email ?? "", unitId: doc.unit?.id ?? "" });
    setError("");
    setShowModal(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError("");
    try {
      const payload = { ...data, unitId: data.unitId || null };
      const url = editDoctor ? `/api/doctors/${editDoctor.id}` : "/api/doctors";
      const method = editDoctor ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError("Erro ao salvar médico"); return; }
      setShowModal(false);
      fetchDoctors();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(doc: Doctor) {
    await fetch(`/api/doctors/${doc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !doc.isActive }),
    });
    fetchDoctors();
  }

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Médicos</h1>
          <p className="text-sm text-slate-500 mt-0.5">{doctors.length} médico{doctors.length !== 1 ? "s" : ""} cadastrado{doctors.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate}><Plus className="w-4 h-4" /> Novo Médico</Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Médico</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">CRM</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Especialidade</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Unidade</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Contato</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-8 bg-slate-100 rounded" /></td>
                    <td colSpan={5} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-6 bg-slate-100 rounded w-16" /></td>
                  </tr>
                ))
              ) : doctors.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Stethoscope className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Nenhum médico cadastrado</p>
                  </td>
                </tr>
              ) : (
                doctors.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColor(doc.name))}>
                          {getInitials(doc.name)}
                        </div>
                        <span className="text-sm font-medium text-slate-900">{doc.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3"><span className="text-sm text-slate-600">{doc.crm ?? "—"}</span></td>
                    <td className="px-4 py-3"><span className="text-sm text-slate-600">{doc.specialty ?? "—"}</span></td>
                    <td className="px-4 py-3"><span className="text-sm text-slate-600">{doc.unit?.name ?? "—"}</span></td>
                    <td className="px-4 py-3"><span className="text-sm text-slate-400">{doc.phone ?? doc.email ?? "—"}</span></td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", doc.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                        {doc.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(doc)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                        <button onClick={() => toggleActive(doc)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"><Power className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editDoctor ? "Editar Médico" : "Novo Médico"} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nome *</label>
              <input {...register("name", { required: true })} className={inputClass} placeholder="Dr. Nome Sobrenome" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">CRM</label>
              <input {...register("crm")} className={inputClass} placeholder="12345-SP" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Especialidade</label>
              <input {...register("specialty")} className={inputClass} placeholder="Cirurgia Plástica" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Telefone</label>
              <input {...register("phone")} className={inputClass} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">E-mail</label>
              <input {...register("email")} type="email" className={inputClass} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Unidade</label>
              <select {...register("unitId")} className={inputClass}>
                <option value="">Sem unidade</option>
                {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
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
