import { cn } from "@/lib/utils";

// Semáforo de mora: verde al corriente, amarillo 1-7 días,
// rojo >7 días o 2+ cuotas vencidas.
export function Semaphore({
  daysLate,
  overdueCount,
  withLabel = false,
}: {
  daysLate: number;
  overdueCount: number;
  withLabel?: boolean;
}) {
  const level =
    daysLate > 7 || overdueCount >= 2 ? "red" : daysLate >= 1 ? "yellow" : "green";

  const color = {
    green: "bg-success",
    yellow: "bg-warning",
    red: "bg-destructive",
  }[level];

  const label = {
    green: "Al corriente",
    yellow: `${daysLate} día${daysLate === 1 ? "" : "s"} de atraso`,
    red: `${overdueCount} cuota${overdueCount === 1 ? "" : "s"} vencida${overdueCount === 1 ? "" : "s"} · ${daysLate} días`,
  }[level];

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("size-2.5 rounded-full", color)} aria-hidden />
      {withLabel && <span className="text-muted-foreground">{label}</span>}
    </span>
  );
}
