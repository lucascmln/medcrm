/**
 * nav.ts
 *
 * Configuração pura (sem React/ícones importados) da navegação lateral.
 * O componente Sidebar mapeia `icon` (string) → componente Lucide.
 *
 * Estilo Kommo: a seção "Comercial" é um grupo expansível/colapsável com
 * Funil de vendas, Todos os leads e Configurar funil.
 */

export interface NavLink {
  label: string;
  href: string;
  icon: string;
}

export interface NavGroup {
  label: string;
  icon: string;
  /** Começa aberto por padrão. */
  defaultOpen?: boolean;
  children: NavLink[];
}

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry && Array.isArray((entry as NavGroup).children);
}

/** Navegação principal ("Principal"). */
export const primaryNav: NavEntry[] = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  {
    label: "Comercial",
    icon: "commercial",
    defaultOpen: true,
    children: [
      { label: "Funil de vendas", href: "/kanban", icon: "kanban" },
      { label: "Todos os leads", href: "/leads", icon: "users" },
      { label: "Configurar funil", href: "/settings/funnel", icon: "sliders" },
    ],
  },
  { label: "Mensagens WhatsApp", href: "/whatsapp", icon: "whatsapp" },
  { label: "Agenda", href: "/agenda", icon: "calendar" },
  { label: "Follow-up", href: "/follow-up", icon: "bell" },
  { label: "Relatórios", href: "/reports", icon: "chart" },
];

/** Navegação de gestão ("Gestão"), com controle por papel. */
export interface ManagementLink extends NavLink {
  roles: string[];
}

export const managementNav: ManagementLink[] = [
  { label: "Usuários", href: "/users", icon: "user-check", roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "Médicos", href: "/doctors", icon: "stethoscope", roles: ["SUPER_ADMIN", "ADMIN", "MANAGER"] },
  { label: "Unidades", href: "/units", icon: "building", roles: ["SUPER_ADMIN", "ADMIN"] },
  { label: "Configurações", href: "/settings", icon: "settings", roles: ["SUPER_ADMIN", "ADMIN"] },
];

/** Todos os rótulos (grupos + filhos) — útil para testes e verificações. */
export function allNavLabels(entries: NavEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    out.push(e.label);
    if (isNavGroup(e)) out.push(...e.children.map((c) => c.label));
  }
  return out;
}

/** Todos os hrefs navegáveis (filhos de grupos incluídos). */
export function allNavHrefs(entries: NavEntry[]): string[] {
  const out: string[] = [];
  for (const e of entries) {
    if (isNavGroup(e)) out.push(...e.children.map((c) => c.href));
    else out.push(e.href);
  }
  return out;
}
