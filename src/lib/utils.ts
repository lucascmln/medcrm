import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNow, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Merge classes Tailwind sem conflito */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata data em pt-BR */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy", { locale: ptBR });
}

/** Formata data + hora em pt-BR */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
}

/** Tempo relativo (ex: "há 2 horas") */
export function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return formatDistanceToNow(new Date(date), { locale: ptBR, addSuffix: true });
}

/** Formata valor em BRL */
export function formatCurrency(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));
}

/** Formata telefone */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

/** Títulos ignorados ao gerar iniciais (com ou sem ponto, case-insensitive). */
const NAME_TITLES = new Set(["dr", "dra", "doutor", "doutora"]);

/**
 * Iniciais para avatar. Remove títulos (Dr./Dra./Doutor/Doutora), ignora espaços
 * extras e usa a PRIMEIRA e a ÚLTIMA palavra do nome (não as duas primeiras),
 * gerando até 2 letras maiúsculas. Nunca retorna vazio — fallback "?".
 *
 * Exemplos: "Dra. Ana Silva" → "AS" · "Dr. Ricardo Mendes" → "RM" ·
 *           "Ricardo" → "R" · "" / null → "?"
 */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !NAME_TITLES.has(p.replace(/\.+$/, "").toLowerCase()));

  if (parts.length === 0) return "?";

  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Verifica SLA (4h sem primeiro contato = breach) */
export function checkSla(createdAt: Date | string, firstContactAt: Date | string | null): boolean {
  if (firstContactAt) return false;
  return differenceInHours(new Date(), new Date(createdAt)) >= 4;
}

/** Labels de roles em pt-BR */
export const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  ATTENDANT: "Atendente",
  DOCTOR: "Médico",
};

/** Gera cor de avatar baseada no nome */
export function avatarColor(name: string | null | undefined): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-violet-500",
    "bg-amber-500",
    "bg-rose-500",
    "bg-cyan-500",
    "bg-indigo-500",
    "bg-teal-500",
  ];
  const str = name ?? "";
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/** Trunca texto com ellipsis */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}...`;
}
