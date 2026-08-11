"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

// Búsqueda global del encabezado: en /clientes sincroniza ?q= con debounce;
// en cualquier otra pantalla, Enter navega a /clientes?q=…  ⌘K la enfoca.
export function HeaderSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const onClientes = pathname === "/clientes";
  const [value, setValue] = useState(onClientes ? (searchParams.get("q") ?? "") : "");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!onClientes) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams(searchParams);
      if (value) params.set("q", value);
      else params.delete("q");
      router.replace(`/clientes?${params.toString()}`);
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, onClientes]);

  return (
    <div className="hidden h-9 min-w-[230px] items-center gap-2 rounded-[11px] border border-line bg-surface px-3 text-ink-3 shadow-card transition-shadow hover:shadow-lifted md:flex">
      <Search className="size-[15px] shrink-0" strokeWidth={1.7} />
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !onClientes) {
            router.push(`/clientes?q=${encodeURIComponent(value.trim())}`);
          }
        }}
        placeholder="Buscar cliente, folio o teléfono"
        className="min-w-0 flex-1 border-0 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-3"
      />
      <span className="rounded-[5px] bg-line-2 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-3">
        ⌘K
      </span>
    </div>
  );
}
