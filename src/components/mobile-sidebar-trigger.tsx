"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "@/components/sidebar-context";

export function MobileSidebarTrigger() {
  const { setMobileOpen } = useSidebar();

  return (
    <button
      type="button"
      onClick={() => setMobileOpen(true)}
      className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line-2 text-ink-2 hover:bg-surface-2 md:hidden"
      aria-label="Abrir menú"
    >
      <Menu className="size-[18px]" strokeWidth={1.8} />
    </button>
  );
}
