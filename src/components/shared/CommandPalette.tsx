"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search, LayoutDashboard, Users, Kanban, CalendarDays, Bell, BarChart3,
  Plus, CalendarPlus, CornerDownLeft, Phone, Loader2,
} from "lucide-react";
import { cn, formatPhone, getInitials, avatarColor } from "@/lib/utils";
import { getTrafficSourceConfig } from "@/lib/traffic-source-ui";
import { leadMatchesSearch } from "@/lib/lead-search";

interface LeadHit {
  id: string; name: string; phone: string; email?: string;
  procedure?: string; trafficSource?: string | null;
  funnelStage?: { name: string; color: string };
  source?: { name: string };
}

interface Item {
  key: string;
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  run: () => void;
  group: string;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<LeadHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const close = useCallback(() => { setOpen(false); setQuery(""); setHits([]); setActive(0); }, []);

  // Global Cmd/Ctrl+K toggle
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);

  // Debounced lead search
  useEffect(() => {
    if (!open) return;
    if (timer.current) clearTimeout(timer.current);
    const q = query.trim();
    if (q.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(async () => {
      try {
        // Same endpoint and same match rules as the Leads page — the palette must
        // never drift from it. `leadMatchesSearch` (the shared, unit-tested rule)
        // is applied as a safety net so results stay consistent even if the API
        // response ever changes shape. Matches any part of the full name (first
        // name, surname, any slice), phone (formatted or not), e-mail, procedure.
        const res = await fetch(`/api/leads?search=${encodeURIComponent(q)}&limit=8`);
        const json = res.ok ? await res.json() : { leads: [] };
        const leads: LeadHit[] = Array.isArray(json.leads) ? json.leads : [];
        setHits(leads.filter((l) => leadMatchesSearch(l, q)));
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, open]);

  const go = useCallback((path: string) => { router.push(path); close(); }, [router, close]);

  const NAV: Item[] = [
    { key: "nav-dash", group: "Ir para", label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" />, run: () => go("/dashboard") },
    { key: "nav-leads", group: "Ir para", label: "Todos os leads", icon: <Users className="w-4 h-4" />, run: () => go("/leads") },
    { key: "nav-kanban", group: "Ir para", label: "Funil de vendas", icon: <Kanban className="w-4 h-4" />, run: () => go("/kanban") },
    { key: "nav-funnel-config", group: "Ir para", label: "Configurar funil", icon: <Kanban className="w-4 h-4" />, run: () => go("/settings/funnel") },
    { key: "nav-agenda", group: "Ir para", label: "Agenda", icon: <CalendarDays className="w-4 h-4" />, run: () => go("/agenda") },
    { key: "nav-fu", group: "Ir para", label: "Follow-up", icon: <Bell className="w-4 h-4" />, run: () => go("/follow-up") },
    { key: "nav-reports", group: "Ir para", label: "Relatórios", icon: <BarChart3 className="w-4 h-4" />, run: () => go("/reports") },
  ];
  const ACTIONS: Item[] = [
    { key: "act-lead", group: "Ações", label: "Criar lead", icon: <Plus className="w-4 h-4" />, run: () => go("/leads/new") },
    { key: "act-appt", group: "Ações", label: "Novo agendamento", icon: <CalendarPlus className="w-4 h-4" />, run: () => go("/agenda") },
  ];

  const q = query.trim().toLowerCase();
  const leadItems: Item[] = hits.map((l) => {
    const origin = l.trafficSource ? getTrafficSourceConfig(l.trafficSource).label : (l.source?.name ?? "—");
    return {
      key: `lead-${l.id}`,
      group: "Leads",
      label: l.name,
      sublabel: `${formatPhone(l.phone)} · ${origin} · ${l.funnelStage?.name ?? "—"}`,
      icon: (
        <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-white text-[9px] font-bold", avatarColor(l.name))}>
          {getInitials(l.name)}
        </span>
      ),
      run: () => go(`/leads/${l.id}`),
    };
  });

  const staticMatches = q
    ? [...NAV, ...ACTIONS].filter((i) => i.label.toLowerCase().includes(q))
    : [...NAV, ...ACTIONS];

  const items: Item[] = q ? [...leadItems, ...staticMatches] : staticMatches;

  useEffect(() => { setActive(0); }, [query, hits.length]);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); items[active]?.run(); }
  }

  if (!open) return null;

  // group in render order while keeping a flat index for keyboard nav
  let idx = -1;
  const groups: string[] = [];
  for (const it of items) if (!groups.includes(it.group)) groups.push(it.group);

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center pt-[12vh] px-4" onKeyDown={onKeyDown}>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-fade-in" onClick={close} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-fade-in">
        {/* Search */}
        <div className="flex items-center gap-2 px-4 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar leads ou navegar… (nome, telefone, e-mail, procedimento)"
            className="flex-1 py-3.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
          />
          {loading && <Loader2 className="w-4 h-4 text-slate-300 animate-spin" />}
          <kbd className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-[52vh] overflow-y-auto py-2">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-400">
              {q.length >= 2 ? "Nenhum resultado" : "Digite ao menos 2 letras para buscar leads"}
            </p>
          ) : (
            groups.map((group) => (
              <div key={group} className="mb-1">
                <p className="px-4 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                {items.filter((i) => i.group === group).map((it) => {
                  idx++;
                  const isActive = idx === active;
                  const myIdx = idx;
                  return (
                    <button
                      key={it.key}
                      onMouseEnter={() => setActive(myIdx)}
                      onClick={() => it.run()}
                      className={cn("w-full flex items-center gap-3 px-4 py-2 text-left transition-colors",
                        isActive ? "bg-primary-50" : "hover:bg-slate-50")}
                    >
                      <span className={cn("flex-shrink-0", isActive ? "text-primary-600" : "text-slate-400")}>{it.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-sm font-medium truncate", isActive ? "text-primary-800" : "text-slate-700")}>{it.label}</span>
                        {it.sublabel && <span className="block text-xs text-slate-400 truncate">{it.sublabel}</span>}
                      </span>
                      {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-primary-400 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-slate-100 text-[10px] text-slate-400">
          <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> busca por nome, telefone, e-mail, procedimento</span>
          <span className="ml-auto">↑↓ navegar · ↵ abrir</span>
        </div>
      </div>
    </div>
  );
}
