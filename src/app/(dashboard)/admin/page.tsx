"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Plus, Building2, LogIn, Pencil, Power, Copy, Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { formatDate, cn } from "@/lib/utils";
import { useForm } from "react-hook-form";

interface Tenant {
  id: string; name: string; slug: string; plan: string; isActive: boolean;
  createdAt: string; primaryColor: string;
  _count: { users: number; leads: number };
}

interface CreateForm {
  name: string; slug: string; adminName: string;
  adminEmail: string; adminPassword: string; primaryColor: string;
}

interface EditForm {
  name: string; slug: string; primaryColor: string; plan: string;
}

interface CreatedCredentials {
  tenantName: string;
  adminEmail: string;
  adminPassword: string;
}

// Converts a name to a URL-safe slug
function toSlug(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tenants, setTenants]         = useState<Tenant[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showCreate, setShowCreate]   = useState(false);
  const [editTenant, setEditTenant]   = useState<Tenant | null>(null);
  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");
  const [enteringId, setEnteringId]   = useState<string | null>(null);
  const [togglingId, setTogglingId]   = useState<string | null>(null);
  const [copied, setCopied]           = useState<string | null>(null);

  const createForm = useForm<CreateForm>({ defaultValues: { primaryColor: "#0284c7" } });
  const editForm   = useForm<EditForm>();

  // Guard: only SUPER_ADMIN
  useEffect(() => {
    if (status === "authenticated" && session?.user?.role !== "SUPER_ADMIN") {
      router.replace("/dashboard");
    }
  }, [session, status, router]);

  const fetchTenants = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tenants");
      if (res.ok) setTenants(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.role === "SUPER_ADMIN") {
      fetchTenants();
    }
  }, [status, session, fetchTenants]);

  // Auto-fill slug from name in the create form
  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    createForm.setValue("name", e.target.value);
    // Only auto-fill slug if user hasn't manually edited it
    const currentSlug = createForm.getValues("slug");
    const expectedSlug = toSlug(createForm.getValues("name"));
    if (!currentSlug || currentSlug === expectedSlug) {
      createForm.setValue("slug", toSlug(e.target.value));
    }
  }

  // ─── Create tenant ────────────────────────────────────────────────────────
  async function onCreate(data: CreateForm) {
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
      setShowCreate(false);
      createForm.reset({ primaryColor: "#0284c7" });
      fetchTenants();
      // Show credentials panel if admin was created
      if (data.adminEmail && data.adminPassword) {
        setCredentials({
          tenantName: data.name,
          adminEmail: data.adminEmail,
          adminPassword: data.adminPassword,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  // ─── Edit tenant ──────────────────────────────────────────────────────────
  function openEdit(tenant: Tenant) {
    setEditTenant(tenant);
    editForm.reset({
      name:         tenant.name,
      slug:         tenant.slug,
      primaryColor: tenant.primaryColor,
      plan:         tenant.plan,
    });
    setError("");
  }

  async function onEdit(data: EditForm) {
    if (!editTenant) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/tenants/${editTenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Erro ao atualizar tenant");
        return;
      }
      setEditTenant(null);
      fetchTenants();
    } finally {
      setSaving(false);
    }
  }

  // ─── Toggle active ────────────────────────────────────────────────────────
  async function toggleActive(tenant: Tenant) {
    setTogglingId(tenant.id);
    try {
      await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tenant.isActive }),
      });
      fetchTenants();
    } finally {
      setTogglingId(null);
    }
  }

  // ─── Enter tenant ─────────────────────────────────────────────────────────
  async function enterTenant(tenant: Tenant) {
    setEnteringId(tenant.id);
    try {
      const res = await fetch("/api/admin/select-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: tenant.id }),
      });
      if (res.ok) window.location.href = "/dashboard";
      else setEnteringId(null);
    } catch {
      setEnteringId(null);
    }
  }

  // ─── Copy to clipboard ────────────────────────────────────────────────────
  async function copyText(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  if (status === "loading") {
    return <div className="p-6 flex justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" /></div>;
  }
  if (session?.user?.role !== "SUPER_ADMIN") return null;

  const inputClass = "w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500";

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="page-title">Administração Global</h1>
            <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-medium">Super Admin</span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">{tenants.length} tenant{tenants.length !== 1 ? "s" : ""} na plataforma</p>
        </div>
        <Button onClick={() => { createForm.reset({ primaryColor: "#0284c7" }); setError(""); setShowCreate(true); }}>
          <Plus className="w-4 h-4" /> Novo Tenant
        </Button>
      </div>

      {/* Tenants table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">Clínica / Tenant</th>
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
                  <tr key={tenant.id} className={cn("hover:bg-slate-50 transition-colors", !tenant.isActive && "opacity-60")}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${tenant.primaryColor}20`, border: `2px solid ${tenant.primaryColor}50` }}>
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
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {/* Edit */}
                        <button
                          onClick={() => openEdit(tenant)}
                          title="Editar tenant"
                          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {/* Toggle active */}
                        <button
                          onClick={() => toggleActive(tenant)}
                          disabled={togglingId === tenant.id}
                          title={tenant.isActive ? "Desativar tenant" : "Ativar tenant"}
                          className={cn("p-1.5 rounded-lg transition-colors disabled:opacity-40",
                            tenant.isActive
                              ? "hover:bg-red-50 text-slate-400 hover:text-red-500"
                              : "hover:bg-emerald-50 text-slate-400 hover:text-emerald-600")}>
                          <Power className="w-3.5 h-3.5" />
                        </button>
                        {/* Enter */}
                        <button
                          onClick={() => enterTenant(tenant)}
                          disabled={enteringId === tenant.id || !tenant.isActive}
                          title="Entrar no tenant"
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ml-1"
                          style={{ backgroundColor: tenant.primaryColor }}>
                          <LogIn className="w-3.5 h-3.5" />
                          {enteringId === tenant.id ? "Entrando..." : "Entrar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Create tenant modal ───────────────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Criar Novo Tenant" size="md">
        <form onSubmit={createForm.handleSubmit(onCreate)} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nome da Clínica *</label>
              <input
                {...createForm.register("name", { required: true })}
                onChange={handleNameChange}
                className={inputClass}
                placeholder="Clínica Estética Bella"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Slug * <span className="font-normal text-slate-400">(gerado automaticamente)</span></label>
              <input {...createForm.register("slug", { required: true })} className={inputClass} placeholder="clinica-bella" />
              <p className="text-[10px] text-slate-400 mt-0.5">Apenas letras minúsculas, números e hífens</p>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cor Principal</label>
              <input {...createForm.register("primaryColor")} type="color" className="h-10 w-full rounded-lg border border-slate-200 cursor-pointer" />
            </div>

            <div className="col-span-2 pt-2 border-t border-slate-200">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Usuário Administrador da Clínica</p>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-600 block mb-1">Nome do Admin *</label>
              <input {...createForm.register("adminName", { required: true })} className={inputClass} placeholder="Nome Sobrenome" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">E-mail do Admin *</label>
              <input {...createForm.register("adminEmail", { required: true })} type="email" className={inputClass} placeholder="admin@clinica.com" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Senha do Admin *</label>
              <input {...createForm.register("adminPassword", { required: true, minLength: 6 })} type="text" className={inputClass} placeholder="Mínimo 6 caracteres" />
              <p className="text-[10px] text-slate-400 mt-0.5">Senha visível — copie para enviar ao cliente</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Criar Tenant</Button>
          </div>
        </form>
      </Modal>

      {/* ── Edit tenant modal ─────────────────────────────────────────────── */}
      <Modal open={!!editTenant} onClose={() => setEditTenant(null)} title="Editar Tenant" size="sm">
        <form onSubmit={editForm.handleSubmit(onEdit)} className="p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Nome da Clínica *</label>
            <input {...editForm.register("name", { required: true })} className={inputClass} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Slug *</label>
            <input {...editForm.register("slug", { required: true })} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Cor Principal</label>
              <input {...editForm.register("primaryColor")} type="color" className="h-10 w-full rounded-lg border border-slate-200 cursor-pointer" />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Plano</label>
              <select {...editForm.register("plan")} className={inputClass}>
                <option value="starter">Starter</option>
                <option value="pro">Pro</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" type="button" onClick={() => setEditTenant(null)}>Cancelar</Button>
            <Button type="submit" loading={saving}>Salvar</Button>
          </div>
        </form>
      </Modal>

      {/* ── Credentials panel — shown after successful tenant creation ─────── */}
      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Tenant criado com sucesso!" size="sm">
        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600">
            O tenant <strong>{credentials?.tenantName}</strong> foi criado. Copie as credenciais abaixo e envie ao cliente.
          </p>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-emerald-700">
              <KeyRound className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">Credenciais de Acesso</span>
            </div>

            <CredentialRow label="URL de acesso" value={typeof window !== "undefined" ? window.location.origin : ""} copied={copied} onCopy={copyText} />
            <CredentialRow label="E-mail" value={credentials?.adminEmail ?? ""} copied={copied} onCopy={copyText} />
            <CredentialRow label="Senha" value={credentials?.adminPassword ?? ""} copied={copied} onCopy={copyText} />
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            Oriente o cliente a alterar a senha no primeiro acesso em <strong>Configurações → Conta</strong>.
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                const text =
                  `Acesso ao MedCrm — ${credentials?.tenantName}\n` +
                  `URL: ${typeof window !== "undefined" ? window.location.origin : ""}\n` +
                  `E-mail: ${credentials?.adminEmail}\n` +
                  `Senha: ${credentials?.adminPassword}\n\n` +
                  `Altere sua senha no primeiro acesso.`;
                await navigator.clipboard.writeText(text);
                setCopied("all");
                setTimeout(() => setCopied(null), 2000);
              }}
            >
              {copied === "all" ? <><Check className="w-3.5 h-3.5" /> Copiado!</> : <><Copy className="w-3.5 h-3.5" /> Copiar tudo</>}
            </Button>
            <Button onClick={() => setCredentials(null)}>Fechar</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─── Small helper component ───────────────────────────────────────────────────
function CredentialRow({
  label, value, copied, onCopy,
}: {
  label: string;
  value: string;
  copied: string | null;
  onCopy: (v: string, k: string) => void;
}) {
  const key = label;
  return (
    <div className="flex items-center justify-between gap-2 bg-white rounded-lg border border-emerald-100 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-mono text-slate-900 truncate">{value}</p>
      </div>
      <button
        onClick={() => onCopy(value, key)}
        className="flex-shrink-0 p-1.5 rounded-md hover:bg-emerald-100 text-emerald-600 transition-colors"
        title="Copiar"
      >
        {copied === key ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
