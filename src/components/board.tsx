import { cn } from "@/lib/utils";

// Piezas visuales compartidas de los tableros kanban (leads y solicitudes)

export const boardCardClass =
  "rounded-2xl border border-line-2 bg-surface p-[15px_16px] shadow-card cursor-pointer transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-lifted";

export function BoardColumn({
  label,
  dotColor,
  count,
  sum,
  width = 284,
  highlight = false,
  children,
}: {
  label: string;
  dotColor: string;
  count: number;
  sum?: string;
  width?: number;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col rounded-2xl px-1 py-1.5 transition-colors",
        highlight && "bg-brand-soft",
      )}
      style={{ width }}
    >
      <div className="flex items-center gap-2 px-1.5 pb-3.5 pt-1">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ background: dotColor }}
        />
        <h3 className="text-[13px] font-semibold tracking-[-.005em]">{label}</h3>
        <span className="font-mono text-[11.5px] text-ink-3">{count}</span>
        <span className="flex-1" />
        {sum && <span className="font-mono text-[11.5px] text-ink-3">{sum}</span>}
      </div>
      <div className="flex flex-col gap-2.5">
        {children}
        {count === 0 && (
          <div className="rounded-2xl border border-dashed border-line p-[26px_12px] text-center text-xs text-ink-3">
            Sin tarjetas
          </div>
        )}
      </div>
    </div>
  );
}

export function BoardCardMeta({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="mt-[11px] flex items-center justify-between gap-2 border-t border-line-2 pt-[11px] text-[11.5px] text-ink-3">
      <span className="truncate">{left}</span>
      <span className="shrink-0">{right}</span>
    </div>
  );
}
