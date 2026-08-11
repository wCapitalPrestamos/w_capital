"use client";

import { useRef, useState, type CSSProperties } from "react";

// Zoom de tablero kanban (diseño): controles − / % / + y "Ajustar",
// aplicado con la propiedad CSS zoom sobre el contenedor de columnas.
export function BoardZoom({ children }: { children: React.ReactNode }) {
  const [zoom, setZoomState] = useState(1);
  const boardRef = useRef<HTMLDivElement>(null);

  const setZoom = (z: number) =>
    setZoomState(Math.min(1, Math.max(0.35, Math.floor(z * 100) / 100)));

  const fitZoom = () => {
    const el = boardRef.current;
    if (!el || !el.parentElement) return;
    const parent = el.parentElement;
    const cs = getComputedStyle(parent);
    const avail =
      parent.clientWidth -
      parseFloat(cs.paddingLeft) -
      parseFloat(cs.paddingRight);
    const needed = el.offsetWidth / (zoom || 1);
    setZoom(needed > avail ? avail / needed : 1);
  };

  const ctrl =
    "inline-flex size-7 cursor-pointer items-center justify-center rounded-lg text-base leading-none text-ink-2 transition-colors hover:bg-line-2 hover:text-ink";

  return (
    <>
      <div className="mb-4 flex items-center justify-end gap-1.5">
        <div className="flex items-center gap-0.5 rounded-[11px] border border-line-2 bg-surface p-[3px] shadow-card">
          <button type="button" onClick={() => setZoom(zoom - 0.1)} title="Alejar" className={ctrl}>
            −
          </button>
          <span className="min-w-[44px] text-center font-mono text-[11.5px] text-ink-2">
            {Math.round(zoom * 100)}%
          </span>
          <button type="button" onClick={() => setZoom(zoom + 0.1)} title="Acercar" className={ctrl}>
            +
          </button>
        </div>
        <button
          type="button"
          onClick={fitZoom}
          title="Ajustar a la pantalla"
          className="h-[34px] cursor-pointer rounded-[11px] border border-line-2 bg-surface px-3 text-[12.5px] font-medium text-ink-2 shadow-card transition-colors hover:text-brand"
        >
          Ajustar
        </button>
      </div>
      <div
        ref={boardRef}
        className="flex min-h-[62vh] w-max items-start gap-[18px]"
        style={{ zoom } as CSSProperties}
      >
        {children}
      </div>
    </>
  );
}
