"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const emptySubscribe = () => () => { };

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  // false en SSR, true al hidratar: evita desajuste del icono
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <button
      type="button"
      aria-label="Cambiar tema"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-[11px] border border-line bg-surface text-ink-2 shadow-card transition-[transform,color] duration-150 hover:-translate-y-px hover:text-brand"
    >
      {mounted && resolvedTheme === "dark" ? (
        <Sun className="size-4" strokeWidth={1.7} />
      ) : (
        <Moon className="size-4" strokeWidth={1.7} />
      )}
    </button>
  );
}
