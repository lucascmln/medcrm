"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { getInitials, avatarColor, formatDate, cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

interface User {
  id: string; name: string; email: string; role: string;
  isActive: boolean; createdAt: string;
  unit?: { id: string; name: string };
}

interface FormData {
  name: string; email: string; password: string;
  role: string; unitId: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormData>();

  const fetchUsers = useCallback(async () => {
    const [u, un] = await Promise.all([
      fetch("/api/users").then((r) => r.json()),
      fetch("/api/units").then((r) => r.json()),
    ]);
    setUsers(u);
    setUnits(un);
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openCreate() {
    setEditUser(null);
    reset({ name: "", email: "", password: "", role: "ATTENDANT", unitId: "" });
    setError("");
    setShowModal(true);
  }

  function openEdit(user: User) {
    setEditUser(user);
    reset({ name: user.name, email: user.email, password: "", role: user.role, unitId: user.unit?.id ?? "" });
    setError("");
    setShowModal(true);
  }

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError("");
    try {
      const payload: any = {
        name: data.name, email: data.email, role: data.role,
        unitId: data.unitId || null,
      };
      if (data.password) payload.password = data.password;

      const url = editUser ? `/api/users/${editUser.id}` : "/api/users";
      const method = editUser ? "PUT" : "POST";
      if (!editUser) payload.password = data.password;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Erro ao salvar usuário");
        return;
      }
      setShowModal(false);
      fetchUsers();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    await fetch(`/api/users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    fetchUsers();
  }

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Usuários</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado{users.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4" /> Novo Usuário
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Usuário</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Papel</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Unidade</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Cadastro</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-8 bg-slate-100 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                    <td className="px-4 py-3"><div className="h-5 bg-slate-100 rounded w-16" /></td>
                    <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20" /></td>
                    <td className="px-4 py-3"><div className="h-6 bg-slate-100 rounded w-16" /></td>
                  </tr>
                ))
              ) : users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold", avatarColor(user.name))}>
                        {getInitials(user.name)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{user.name}</p>
                        <p className="text-xs text-slate-400">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RoleBadge role={user.role} /></td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-600">{user.unit?.name ?? "—"}</span></td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", user.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                      {user.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className="text-sm text-slate-400">{formatDate(user.createdAt)}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => openEdit(user)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => toggleActive(user)} className={cn("p-1.5 rounded-lg transition-colors", user.isActive ? "hover:bg-red-50 text-slate-400 hover:text-red-500" : "hover:bg-emerald-50 text-slate-400 hover:text-emerald-600")}>
                        <Power className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editUser ? "Editar Usuário" : "Novo Usuário"} size="sm">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nome *</label>
            <input {...register("name", { required: true })} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">E-mail *</label>
            <input {...register("email", { required: true })} type="email" className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">
              {editUser ? "Nova Senha (deixe vazio para não alterar)" : "Senha *"}
            </label>
            <input
              {...register("password", { required: !editUser })}
              type="password"
              className={inputClass}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Papel</label>
            <select {...register("role")} className={inputClass}>
              <option value="ATTENDANT">Atendente</option>
              <option value="MANAGER">Gestor</option>
              <option value="ADMIN">Admin</option>
              <option value="DOCTOR">Médico</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Unidade</label>
            <select {...register("unitId")} className={inputClass}>
              <option value="">Sem unidade</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
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
