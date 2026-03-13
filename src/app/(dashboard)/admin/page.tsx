"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Building2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate, cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

interface Tenant {
  id: string; name: string; slug: string; plan: string; isActive: boolean;
  createdAt: string; primaryColor: string;
  _count: { users: number; leads: number };
}

interface FormData {
  name: string; slug: string; adminName: string;
  adminEmail: string; adminPassword: string; primaryColor: string;
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [enteringId, setEnteringId] = useState<string | null>(null);

  const { register, handleSubmit, reset } = useForm<FormData>({ defaultValues: { primaryColor: "#0284c7" } });

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  const fetchTenants = useCallback(async () => {
    const res = await fetch("/api/admin/tenants");
    if (res.ok) setTenants(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "SUPER_ADMIN") {
      fetchTenants();
    }
  }, [status, session, fetchTenants]);

  async function onSubmit(data: FormData) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Erro ao criar tenant");
        return;
      }
      setShowModal(false);
      reset();
      fetchTenants();
    } finally {
      setSaving(false);
    }
  }

  async function enterTenant(tenant: Tenant) {
    setEnteringId(tenant.id);
    try {
      const res = await fetch("/api/admin/select-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      if (!res.ok) {
        setEnteringId(null);
        return;
      }
      // Full page reload so all server components and cookies re-initialize correctly
      window.location.href = "/dashboard";
    } catch {
      setEnteringId(null);
    }
  }

  if (status === "loading") {
    return <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }

  if (session?.user?.role !== "SUPER_ADMIN") return null;

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Administração Global</h1>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Super Admin</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{tenants.length} tenant{tenants.length !== 1 ? "s" : ""} na plataforma</p>
        </div>
        <Button onClick={() => { reset(); setError(""); setShowModal(true); }}>
          <Plus className="w-4 h-4" /> Novo Tenant
        </Button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Tenant</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Slug</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Plano</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Usuários</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Leads</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Criado em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-8 bg-slate-100 rounded" /></td>
                    <td colSpan={7} className="px-4 py-3"><div className="h-4 bg-slate-100 rounded" /></td>
                  </tr>
                ))
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <Building2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">Nenhum tenant cadastrado</p>
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr
                    key={tenant.id}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => enterTenant(tenant)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${tenant.primaryColor}20`, border: `2px solid ${tenant.primaryColor}50` }}
                        >
                          <Building2 className="w-3.5 h-3.5" style={{ color: tenant.primaryColor }} />
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{tenant.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-slate-600">{tenant.slug}</code>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600 capitalize">{tenant.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-900">{tenant._count.users}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-900">{tenant._count.leads}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full",
                        tenant.isActive ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400")}>
                        {tenant.isActive ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-400">{formatDate(tenant.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => enterTenant(tenant)}
                        disabled={enteringId === tenant.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-60"
                        style={{ backgroundColor: tenant.primaryColor }}
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        {enteringId === tenant.id ? "Entrando..." : "Entrar"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Criar Novo Tenant" size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nome da Empresa/Clínica *</label>
              <input {...register("name", { required: true })} className={inputClass} placeholder="Clínica Estética Bella" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Slug * (único)</label>
              <input {...register("slug", { required: true })} className={inputClass} placeholder="clinica-bella" />
              <p className="text-[10px] text-slate-400 mt-0.5">Apenas letras, números e hífens</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cor Principal</label>
              <input {...register("primaryColor")} type="color" className="h-10 w-full rounded-lg border border-slate-200 cursor-pointer" />
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Usuário Administrador</p>
            </div>

            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nome do Admin</label>
              <input {...register("adminName")} className={inputClass} placeholder="Nome Sobrenome" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">E-mail do Admin</label>
              <input {...register("adminEmail")} type="email" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Senha do Admin</label>
              <input {...register("adminPassword")} type="password" className={inputClass} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowModal(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Criar Tenant</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
