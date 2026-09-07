"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface SidebarState {
  collapsed: boolean;
  toggleCollapsed: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarState | null>(null);

const STORAGE_KEY = "wcapital:sidebar-collapsed";

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  // Arranca igual en servidor y cliente (evita mismatch de hidratación);
  // el valor persistido se aplica después de montar.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // Sincroniza una sola vez con la preferencia guardada — no es una
    // suscripción reactiva, así que no aplica el patrón de "derivar del
    // estado externo en cada render" que la regla espera.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
  }, []);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Cierra el drawer móvil al navegar a otra página. Se ajusta durante el
  // render (comparando contra el pathname anterior) en vez de en un efecto,
  // para no disparar un segundo render tras el commit.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }}
    >
      <div
        suppressHydrationWarning
        data-sidebar={collapsed ? "collapsed" : "expanded"}
        className="flex min-h-screen flex-1 text-[14px]"
      >
        {children}
      </div>
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar debe usarse dentro de SidebarProvider");
  return ctx;
}
