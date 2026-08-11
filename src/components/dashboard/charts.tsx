import { formatMoney } from "@/lib/format";

// Gráficas del rediseño: barras y filas CSS puras (animadas), sin recharts.
// Server-safe: sin estado ni efectos; tooltips nativos vía title.

const EXPECTED_COLOR = "#2E7DB2";

export function CollectionBars({
  data,
}: {
  data: { label: string; expected: number; collected: number }[];
}) {
  const max = Math.max(1, ...data.flatMap((d) => [d.expected, d.collected])) * 1.06;

  return (
    <>
      <div className="flex items-center justify-end gap-3.5 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <i
            className="inline-block size-[9px] rounded-[3px]"
            style={{ background: EXPECTED_COLOR }}
          />
          Esperado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <i className="inline-block size-[9px] rounded-[3px] bg-brand" />
          Cobrado
        </span>
      </div>
      <div className="mt-4 flex h-[210px] items-end gap-[18px]">
        {data.map((w, i) => (
          <div
            key={w.label}
            className="flex h-full flex-1 flex-col items-center gap-2.5"
          >
            <div className="flex w-full flex-1 items-end justify-center gap-[5px]">
              <div
                title={`Esperado ${formatMoney(w.expected)}`}
                className="w-5 origin-bottom animate-grow-bar rounded-t-[6px] rounded-b-[2px] opacity-85"
                style={{
                  height: `${(w.expected / max) * 100}%`,
                  background: EXPECTED_COLOR,
                  animationDelay: `${i * 0.06}s`,
                }}
              />
              <div
                title={`Cobrado ${formatMoney(w.collected)}`}
                className="w-5 origin-bottom animate-grow-bar rounded-t-[6px] rounded-b-[2px] bg-brand"
                style={{
                  height: `${(w.collected / max) * 100}%`,
                  animationDelay: `${i * 0.06 + 0.08}s`,
                }}
              />
            </div>
            <span className="font-mono text-[11px] text-ink-3">{w.label}</span>
          </div>
        ))}
        {data.length === 0 && (
          <p className="w-full self-center text-center text-sm text-ink-3">
            Aún no hay semanas registradas.
          </p>
        )}
      </div>
    </>
  );
}

export function FunnelRows({
  data,
}: {
  data: { label: string; value: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-3.5">
      {data.map((f, i) => (
        <div key={f.label}>
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="text-[13px] text-ink-2">{f.label}</span>
            <span className="font-mono text-[13px] font-medium">{f.value}</span>
          </div>
          <div className="h-[9px] overflow-hidden rounded-full bg-line-2">
            <div
              className="h-full origin-left animate-grow-row rounded-full bg-brand"
              style={{
                width: `${(f.value / max) * 100}%`,
                opacity: 1 - i * 0.13,
                animationDelay: `${i * 0.07}s`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const pad = span * 0.12;
  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = 100 - ((p - (min - pad)) / (span + pad * 2)) * 100;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="block h-24 w-full overflow-visible"
      aria-hidden
    >
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,100 ${coords.join(" ")} 100,100`} fill="url(#sparkFill)" />
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="var(--brand)"
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
