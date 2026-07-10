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
  ChevronDown,
  ShieldCheck,
  CalendarDays,
  Bell,
  MessageCircle,
  Briefcase,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";
import { cn, getInitials, avatarColor } from "@/lib/utils";
import { BrandMark } from "@/components/shared/BrandMark";
import {
  primaryNav,
  managementNav,
  isNavGroup,
  type NavEntry,
  type NavGroup,
} from "@/lib/nav";

/** Mapa key (string, vindo de nav.ts) → componente de ícone Lucide. */
const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  commercial: Briefcase,
  kanban: Kanban,
  users: Users,
  sliders: SlidersHorizontal,
  whatsapp: MessageCircle,
  calendar: CalendarDays,
  bell: Bell,
  chart: BarChart3,
  "user-check": UserCheck,
  stethoscope: Stethoscope,
  building: Building2,
  settings: Settings,
};

function Icon({ name, className }: { name: string; className?: string }) {
  const C = ICONS[name] ?? LayoutDashboard;
  return <C className={className} />;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? "";

  // For SUPER_ADMIN: read the selected tenant name from cookie (set after clicking "Entrar")
  const [impersonatedName, setImpersonatedName] = useState<string | null>(null);
  useEffect(() => {
    if (userRole === "SUPER_ADMIN") {
      setImpersonatedName(readCookie("x-tenant-name"));
    }
  }, [userRole]);

  const displayTenant  = impersonatedName ?? session?.user?.tenantName ?? (userRole === "SUPER_ADMIN" ? "Super Admin" : "CRM Médico");

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  function groupHasActiveChild(group: NavGroup) {
    return group.children.some((c) => isActive(c.href));
  }

  return (
    <aside className="fixed inset-y-0 left-0 z-40 w-60 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <Link href="/dashboard" className="flex items-center gap-3">
          <BrandMark size={34} rounded="rounded-lg" className="shadow-sm flex-shrink-0" />
          <div>
            <p className="text-sm font-bold text-brand-900 leading-tight">InnoveCRM</p>
            <p className="text-[10px] text-slate-400 font-medium truncate max-w-[110px]">{displayTenant}</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 py-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Principal
        </p>
        {primaryNav.map((entry: NavEntry) =>
          isNavGroup(entry) ? (
            <NavGroupItem
              key={entry.label}
              group={entry}
              isActive={isActive}
              openByDefault={entry.defaultOpen || groupHasActiveChild(entry)}
            />
          ) : (
            <Link
              key={entry.href}
              href={entry.href}
              className={cn("sidebar-link", isActive(entry.href) && "sidebar-link-active")}
            >
              <Icon name={entry.icon} className="w-4 h-4 flex-shrink-0" />
              <span>{entry.label}</span>
              {isActive(entry.href) && (
                <ChevronRight className="w-3 h-3 ml-auto text-primary-500" />
              )}
            </Link>
          )
        )}

        <p className="px-3 pt-4 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          Gestão
        </p>
        {managementNav
          .filter(
            (item) =>
              !item.roles ||
              item.roles.includes(userRole) ||
              userRole === "SUPER_ADMIN"
          )
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("sidebar-link", isActive(item.href) && "sidebar-link-active")}
            >
              <Icon name={item.icon} className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {isActive(item.href) && (
                <ChevronRight className="w-3 h-3 ml-auto text-primary-500" />
              )}
            </Link>
          ))}

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

/** Grupo expansível/colapsável no estilo Kommo (ex.: "Comercial"). */
function NavGroupItem({
  group,
  isActive,
  openByDefault,
}: {
  group: NavGroup;
  isActive: (href: string) => boolean;
  openByDefault: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);

  // Reabre automaticamente quando o usuário navega para uma rota filha.
  useEffect(() => {
    if (openByDefault) setOpen(true);
  }, [openByDefault]);

  const anyChildActive = group.children.some((c) => isActive(c.href));

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn("sidebar-link w-full", anyChildActive && !open && "text-primary-700")}
      >
        <Icon name={group.icon} className="w-4 h-4 flex-shrink-0" />
        <span>{group.label}</span>
        {open ? (
          <ChevronDown className="w-3.5 h-3.5 ml-auto text-slate-400" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
        )}
      </button>

      {open && (
        <div className="mt-1 ml-3 pl-3 border-l border-slate-100 space-y-1">
          {group.children.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              className={cn("sidebar-link", isActive(child.href) && "sidebar-link-active")}
            >
              <Icon name={child.icon} className="w-4 h-4 flex-shrink-0" />
              <span>{child.label}</span>
              {isActive(child.href) && (
                <ChevronRight className="w-3 h-3 ml-auto text-primary-500" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
