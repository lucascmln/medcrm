import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className }: BadgeProps) {
  return (
    <span
      className={cn("badge", className)}
      style={
        color
          ? {
              backgroundColor: `${color}20`,
              color: color,
              border: `1px solid ${color}40`,
            }
          : undefined
      }
    >
      {children}
    </span>
  );
}

// Badge de status para leads
export function StatusBadge({
  stage,
}: {
  stage: { name: string; color: string };
}) {
  return <Badge color={stage.color}>{stage.name}</Badge>;
}

// Badge de role
const roleColors: Record<string, string> = {
  SUPER_ADMIN: "#7c3aed",
  ADMIN: "#0284c7",
  MANAGER: "#059669",
  ATTENDANT: "#d97706",
  DOCTOR: "#0891b2",
};

const roleLabels: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  MANAGER: "Gestor",
  ATTENDANT: "Atendente",
  DOCTOR: "Médico",
};

export function RoleBadge({ role }: { role: string }) {
  return (
    <Badge color={roleColors[role] ?? "#64748b"}>
      {roleLabels[role] ?? role}
    </Badge>
  );
}
