import { cn } from "@/lib/utils";

const statusConfig = {
  Rascunho: {
    color: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/50",
    label: "Rascunho",
  },
  Agendado: {
    color: "bg-primary/15 text-foreground border-primary/25",
    dot: "bg-primary",
    label: "Agendado",
  },
  Publicado: {
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "Publicado",
  },
  Cancelado: {
    color: "bg-destructive/10 text-destructive border-destructive/20",
    dot: "bg-destructive",
    label: "Cancelado",
  },
  Pendente: {
    color: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800",
    dot: "bg-amber-500",
    label: "Pendente",
  },
  Aprovado: {
    color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
    dot: "bg-emerald-500",
    label: "Aprovado",
  },
  "Revisão": {
    color: "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border-orange-200 dark:border-orange-800",
    dot: "bg-orange-500",
    label: "Revisão",
  },
  Revisado: {
    color: "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800",
    dot: "bg-blue-500",
    label: "Revisado",
  },
  Refeito: {
    color: "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800",
    dot: "bg-purple-500",
    label: "Refeito",
  },
} as const;

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Rascunho;

  return (
    <span className={cn(
      "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
      config.color
    )}>
      <span className={cn("w-1.5 h-1.5 rounded-full mr-1.5", config.dot)} />
      {config.label}
    </span>
  );
}
