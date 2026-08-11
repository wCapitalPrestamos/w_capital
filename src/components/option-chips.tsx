"use client";

import { cn } from "@/lib/utils";

// Selectores de opción del rediseño: chips (canal, método de pago)
// y pastillas grandes (tipo de acreditado, garantía)

export function ChipOptions<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 cursor-pointer rounded-full border px-[13px] text-[12.5px] font-medium transition-all",
            value === o.value
              ? "border-brand bg-brand-soft text-brand-ink"
              : "border-line-2 bg-surface-2 text-ink-2 hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function PillOptions<T extends string>({
  options,
  value,
  onChange,
  columns = 2,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "flex cursor-pointer flex-col items-start gap-[3px] rounded-[14px] border p-[12px_14px] text-left transition-all",
            value === o.value
              ? "border-brand bg-brand-soft"
              : "border-line-2 bg-surface-2",
          )}
        >
          <span className="text-[13px] font-semibold">{o.label}</span>
          {o.hint && <span className="text-[11.5px] text-ink-3">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}
