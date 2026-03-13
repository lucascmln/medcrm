"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserCheck,
  Building2,
  Kanban,
  BarChart3,
  Settings,
  LogOut,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  CalendarDays,
  Bell,
} from "lucide-react";
import { cn, getInitials, avatarColor } from "@/lib/utils";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Leads", href: "/leads", icon: Users },
  { label: "Funil / Kanban", href: "/kanban", icon: Kanban },
  { label: "Agenda", href: "/agenda", icon: CalendarDays },
  { label: "Follow-up", href: "/follow-up", icon: Bell },
  { label: "Relatórios", href: "/reports", icon: BarChart3 },
];

const managementItems = [
  {
    label: "Usuários",
    href: "/users",
    icon: UserCheck,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  },
  {
    label: "Médicos",
    href: "/doctors",
    icon: Stethoscope,
    roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"],
  },
  {
    label: "Unidades",
    href: "/units",
    icon: Building2,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
  {
    label: "Configurações",
    href: "/settings",
    icon: Settings,
    roles: ["SUPER_ADMIN", "ADMIN"],
  },
];

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";
  const tenantColor = session?.user?.tenantColor ?? "#0284c7";

  // For SUPER_ADMIN: read the selected tenant name from cookie (set after clicking "Entrar")
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  const [impersonatedColor, setImpersonatedColor] = useState<string | null>(null);
  useEffect(() => {
    if (userRole === "SUPER_ADMIN") {
      setImpersonatedName(readCookie("x-tenant-name"));
      setImpersonatedColor(readCookie("x-tenant-color"));
    }
  }, [userRole]);

  const displayColor   = impersonatedColor ?? tenantColor;
  const displayTenant  = impersonatedName ?? session?.user?.tenantName ?? (userRole === "SUPER_ADMIN" ? "Super Admin" : "CRM Médico");

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
            style={{ backgroundColor: displayColor }}
          >
            <Stethoscope className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900 leading-tight">MedCrm Innove</p>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[110px]">{displayTenant}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Principal
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "sidebar-link",
                active && "sidebar-link-active"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {active && (
                <ChevronRight className="w-3 h-3 ml-auto text-primary-500" />
              )}
            </Link>
          );
        })}

        <p className="px-3 pt-4 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Gestão
        </p>
        {managementItems
          .filter(
            (item) =>
              !item.roles ||
              item.roles.includes(userRole) ||
              userRole === "SUPER_ADMIN"
          )
          .map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "sidebar-link",
                  active && "sidebar-link-active"
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{item.label}</span>
                {active && (
                  <ChevronRight className="w-3 h-3 ml-auto text-primary-500" />
                )}
              </Link>
            );
          })}

        {userRole === "SUPER_ADMIN" && (
          <>
            <p className="px-3 pt-4 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Sistema
            </p>
            <Link
              href="/admin"
              className={cn("sidebar-link", isActive("/admin") && "sidebar-link-active")}
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              <span>Super Admin</span>
            </Link>
          </>
        )}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0",
              avatarColor(session?.user?.name ?? "U")
            )}
          >
            {getInitials(session?.user?.name ?? "U")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-900 truncate">
              {session?.user?.name}
            </p>
            <p className="text-[10px] text-slate-400 truncate">
              {session?.user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Sair"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
