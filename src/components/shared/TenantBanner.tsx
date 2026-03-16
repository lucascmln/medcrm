"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Building2, ArrowLeft } from "lucide-react";

interface TenantInfo {
  name: string;
  color: string;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function TenantBanner() {
  const { data: session } = useSession();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (session?.user?.role !== "SUPER_ADMIN") {
      setTenant(null);
      return;
    }
    // x-tenant-id is httpOnly — use x-tenant-name as the impersonation signal
    const name  = readCookie("x-tenant-name");
    const color = readCookie("x-tenant-color");
    if (name) {
      setTenant({ name, color: color ?? "#0284c7" });
    } else {
      setTenant(null);
    }
  }, [session]);

  if (!tenant || session?.user?.role !== "SUPER_ADMIN") return null;

  async function handleExit() {
    setExiting(true);
    try {
      await fetch("/api/admin/select-tenant", { method: "DELETE" });
    } finally {
      // Full reload so server components re-read the (now-cleared) cookie
      window.location.href = "/admin";
    }
  }

  return (
    <div
      className="flex items-center gap-3 px-5 py-2 text-white text-sm flex-shrink-0"
      style={{ backgroundColor: tenant.color }}
    >
      <Building2 className="w-4 h-4 flex-shrink-0 opacity-80" />
      <span className="flex-1 font-medium">
        Visualizando:{" "}
        <span className="font-bold">{tenant.name}</span>
        <span className="ml-2 opacity-70 text-xs font-normal">— Modo Super Admin</span>
      </span>
      <button
        onClick={handleExit}
        disabled={exiting}
        className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-black/20 hover:bg-black/30 transition-colors text-xs font-semibold disabled:opacity-60"
      >
        <ArrowLeft className="w-3 h-3" />
        {exiting ? "Saindo..." : "Sair do tenant"}
      </button>
    </div>
  );
}
